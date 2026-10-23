# Rootless BuildKit security exception review (draft)

Status: **draft for root coordinator review — not user-approved, not applied.**  
Date: 2026-10-14 (finalize pass: complete OCI profile + hashed provenance).  
Author roles: `rootless-security-design` (initial diagnosis/stub) → `rootless-exception-finalize` (complete profile).  
Related approved design: [2026-10-13-ci-registry-cache-performance-design.md](./2026-10-13-ci-registry-cache-performance-design.md) §4 (rootless canary; broader exceptions need separate review).  
Related plan: [2026-10-14-ci-docker-cache.md](../plans/2026-10-14-ci-docker-cache.md) Task 3.

This document proposes the **smallest separately reviewable** exception alternatives after the live worker05 canary failed under the current hard constraints. It does **not** authorize apply, publication, PSS changes, or sandbox flag enablement. **No exception was applied by either worker.**

## 1. Verified failure (live evidence)

| Field | Value |
|---|---|
| Node | `talos-worker05` / `192.168.68.38` only |
| Talos | `v1.14.1` |
| Kernel | `6.18.51-talos` |
| kubelet | `v1.37.0` |
| containerd | `2.3.5` |
| Sysctl during attempt | `user.max_user_namespaces=16384` (then rolled back to `0`) |
| Image | `moby/buildkit:v0.33.1-rootless@sha256:f8a833b2de9d68e27f0815e4a737abdfaf8a2e4c615650557df11025101557b4` |
| Pod policy | `hostUsers: false`, `seccompProfile.type: RuntimeDefault`, drop `ALL`, `allowPrivilegeEscalation: false`, no hostPath/socket, no `--oci-worker-no-process-sandbox` |
| Namespace PSS | `gitlab-runners` enforce **baseline** (rejects `seccompProfile: Unconfined`) |
| Exit | container exit `1` in ~1s |

Exact log:

```text
[rootlesskit:parent] error: failed to start the child: fork/exec /proc/self/exe: operation not permitted
```

Evidence: `delegation/rootless-live-canary/RESULT.md` and `evidence/canary-logs.txt`. Publication remains false. Worker05 canary label/sysctl rolled back.

## 2. Diagnosis (primary docs — not Unconfined guesswork)

### 2.1 What the error means

RootlessKit re-execs itself via `fork/exec /proc/self/exe` while creating a **new user namespace**. Upstream treats the same symptom as an inability to create an unprivileged user namespace (seccomp/AppArmor/`max_user_namespaces`), not as a literal execute bit on `/proc/self/exe`.

Primary references:

- BuildKit v0.33.1 [`docs/rootless.md`](https://raw.githubusercontent.com/moby/buildkit/v0.33.1/docs/rootless.md) — troubleshooting for `fork/exec /proc/self/exe` (max_user_namespaces / AppArmor); Docker guidance uses `seccomp=unconfined` so syscalls such as `unshare`/`mount` work; Kubernetes examples use `seccompProfile: Unconfined` **and** `--oci-worker-no-process-sandbox`.
- RootlessKit issue [#172](https://github.com/rootless-containers/rootlesskit/issues/172) — same error inside containers without seccomp/apparmor relaxation.
- Rootless image entrypoint is `["rootlesskit", "buildkitd"]` ([BuildKit Dockerfile rootless stage](https://github.com/moby/buildkit/blob/v0.33.1/Dockerfile)).

### 2.2 Why `max_user_namespaces=16384` was insufficient

The live canary already raised `user.max_user_namespaces` to **16384** on worker05. The process still died at rootlesskit parent start. Therefore the first-gate failure is **not** the Talos default of `0` alone.

### 2.3 RuntimeDefault / containerd v2.3.5 syscall filter (pinned)

Kubernetes `RuntimeDefault` uses the **container runtime** default profile. Live worker05 runs **containerd 2.3.5**.

Pinned source:

`https://raw.githubusercontent.com/containerd/containerd/v2.3.5/contrib/seccomp/seccomp_default.go`

For containers **without** `CAP_SYS_ADMIN` (our drop-ALL canary):

| Syscall | RuntimeDefault behavior |
|---|---|
| `clone` | Allowed **only** when `(flags & NS_MASK) == 0` (`SCMP_CMP_MASKED_EQ` with mask including `CLONE_NEWUSER` / `NEWNS` / `NEWPID` / `NEWNET` / `NEWUTS` / `NEWIPC` / `NEWCGROUP`). Any namespace-creating clone is denied → **EPERM**. |
| `clone3` | Forced **ENOSYS** (not allow). |
| `unshare` | **Not** in the non-admin allow list → default **EPERM**. |
| `mount` / `umount` / `setns` | Admin-gated → **EPERM**. |

`NS_MASK = 0x7e020000`.

This matches the observed first error **without** needing `Unconfined` as the explanation. Unconfined would mask many later failures too; it is **not** an accepted candidate here (PSS baseline rejects it; policy forbids it).

### 2.4 Nested rootlesskit vs `hostUsers: false`

The canary already places the pod in a Kubernetes user namespace (`hostUsers: false`). The rootless image still starts **RootlessKit**, which tries to create **another** user namespace and apply `/etc/subuid` mappings via `newuidmap`/`newgidmap`.

Independent operational guidance (CERN, 2025-06-19): *“We can not use buildkit rootless with user namespaces, rootlesskit needs to be able to create user mappings.”* Upstream’s compatible pattern is [`pod.userns.yaml`](https://raw.githubusercontent.com/moby/buildkit/v0.33.1/examples/kubernetes/pod.userns.yaml): **non-rootless** image + `hostUsers: false` + `privileged: true` (comment: “Not really privileged”).

### 2.5 Helper uid/gid mapping / setuid (must never be silent)

If Candidate A clears seccomp and RootlessKit proceeds to subordinate ID mapping:

- `newuidmap` / `newgidmap` are **setuid-root helpers** writing host-visible mapping files for the nested userns.
- Pod `allowPrivilegeEscalation: false` sets **NoNewPrivileges**, which blocks setuid privilege gain.
- **Threat if flipped true:** any setuid binary in the image/filesystem can escalate inside the container credential model; combined with nested userns, mapping helpers can rearrange UID visibility for child processes.
- **Host mapping reality under `hostUsers: false`:** kubelet already remaps the pod’s UIDs to high host UIDs. Nested RootlessKit mappings are an additional translation layer; they are not “free” isolation and are the reason CERN rejects rootless+k8s-userns.
- **Bound request rule:** do not silently set `allowPrivilegeEscalation: true` or add `SETUID`/`SETGID` caps. Any such change is a **separate** exception with explicit threat text.

### 2.6 Process sandbox / `/proc` (out of scope unless separately approved)

Upstream documents the next common failure: `mount proc:/proc ... operation not permitted` without `systempaths=unconfined`, and Kubernetes examples add `--oci-worker-no-process-sandbox`. That flag remains **forbidden** here. `securityContext.procMount: Unmasked` is related but depends on `hostUsers: false` and is also **not** proposed in this draft.

## 3. Talos `seccompProfiles` support (v1.14.1 verified)

Primary docs:

- [Seccomp Profiles](https://docs.siderolabs.com/kubernetes-guides/security/seccomp-profiles) — `machine.seccompProfiles[]` writes `/var/lib/kubelet/seccomp/profiles/<name>`; pods use `seccompProfile.type: Localhost` and `localhostProfile: profiles/<name>`.
- [MachineConfig v1.14 reference](https://docs.siderolabs.com/talos/v1.14/reference/configuration/v1alpha1/config) — `machine.seccompProfiles` field is first-class in v1alpha1 (`name` + unstructured `value`).

Homelab pin: `TALOS_VERSION=v1.14.1` in cluster-infra `versions.env`.

**No** hand-coded allow-all label. Profiles must keep `defaultAction: SCMP_ACT_ERRNO`.

## 4. Candidate exceptions (unapplied)

### 4.0 Artifact locations

| Generation | Path | Status |
|---|---|---|
| Initial (annotated/stub) | `delegation/rootless-security-design/candidates/` | Intentionally incomplete Talos stub; **do not approve from stub alone** |
| **Finalize (complete)** | `delegation/rootless-exception-finalize/candidates/` | **Authoritative Candidate A files** for review |
| Root commands (gated) | `delegation/rootless-exception-finalize/candidates/ROOT-COMMANDS-PENDING-APPROVAL.md` | Apply blocked until user approval |
| Hashed provenance | `delegation/rootless-exception-finalize/evidence/` | Baseline + candidate SHA-256 |

### Candidate A — narrow Localhost seccomp (worker05 only) — **smallest diagnostic probe (not a readiness claim)**

**Intent:** keep the rootless image + `hostUsers: false` + drop ALL + `allowPrivilegeEscalation: false` + process sandbox retained; replace `RuntimeDefault` with a **Localhost** profile that is the **exact** containerd **v2.3.5 / amd64 / no capabilities** `DefaultProfile` JSON (Go `seccomp.DefaultProfile` emitted under `linux/amd64`), plus explicit delta:

- allow `clone` (including namespace flags) — removes RuntimeDefault `SCMP_CMP_MASKED_EQ` mask `0x7e020000` / `valueTwo=0`
- allow `clone3` — removes RuntimeDefault `ENOSYS(38)` force
- allow `unshare` — was absent (!admin) → default EPERM

**Not** included in delta: `mount`, `umount`, `umount2`, `setns`, `bpf`, `reboot`, or `defaultAction: SCMP_ACT_ALLOW`. All other original DefaultProfile rules preserved; `defaultAction: SCMP_ACT_ERRNO` (+ `defaultErrnoRet: 1`).

**Provenance (finalize):**

| Item | Value |
|---|---|
| Emitter | `delegation/rootless-exception-finalize/tools/emit-default-profile` → `github.com/containerd/containerd/v2@v2.3.5/contrib/seccomp.DefaultProfile` |
| Baseline SHA-256 | `f6070df8be68a897cef707a4741b019d3b7175374c4be65ffc00e1b056969ffa` |
| Talos-value SHA-256 | `1ab03b800a4d7560ca73689bf335ec5b6f7ece6e1255bd5dbc3fb74c33555f07` |
| Talos on-node path | `/var/lib/kubelet/seccomp/profiles/buildkit-rootless-nested-userns.json` |
| Pod `localhostProfile` | `profiles/buildkit-rootless-nested-userns.json` |

**Delivery:** Talos `machine.seccompProfiles` on **worker05 only** + canary sysctl/label; pod uses Localhost path above. Patch embeds the **full** talos-value JSON (no stub).

**Why this small probe vs upstream direct-daemon userns:** Candidate A only changes three syscall policies while keeping every other hard constraint. Upstream’s compatible k8s userns pattern (`pod.userns.yaml`) uses the **non-rootless** image + `hostUsers: false` + **userns-scoped `privileged: true`** — a larger PSS/capability exception class, not a three-syscall delta.

**Residual blockers (unchanged; require separate future review):** nested rootlesskit userns under k8s userns; `allowPrivilegeEscalation: false` / NoNewPrivileges vs setuid `newuidmap`/`newgidmap`; `mount`/`proc` / process-sandbox. **Do not claim Candidate A will work.**

**Honest likelihood:** **A is unlikely to yield a ready rootless builder.** It is useful only to confirm the *next* errno after seccomp. If operator credits/time are scarce, **prefer skipping the live A canary** and deciding architecture (abandon nested rootlesskit under `hostUsers: false`, or separately review upstream userns+privileged) rather than burning an apply cycle that probably stops on NoNewPrivileges or mount.

### Candidate B — direct daemon in existing pod userns — **compatibility probe**

**Intent:** skip RootlessKit; run `buildkitd` from **non-rootless** `moby/buildkit:v0.33.1@sha256:cec9f139f45e93c5c69c60f8b07cfad9f43f4ef6b6a6cd917527fea5ff2e3dea` as UID 0 **inside** `hostUsers: false`, still drop ALL / RuntimeDefault / no privileged in the candidate YAML.

**Why listed:** matches upstream’s userns direction (daemon uses the kubelet userns instead of nested rootlesskit).

**Explicit conflict:** upstream/CERN working form uses **`privileged: true` (userns-scoped)**. PSS **baseline** rejects privileged containers and rejects adding `CAP_SYS_ADMIN`. This draft’s Candidate B YAML therefore **does not** enable privileged; it is a fail-closed measurement pod. Enabling userns-scoped privileged is a **larger** exception than A and must be requested with:

- Threat: CAP_SYS_ADMIN-equivalent inside the pod userns (mounts, device nodes, kill across the userns); host UID is remapped but this is still a major workload capability expansion.
- Bound: worker05 + canary label + single namespace + no hostPath/socket + no global PSS relax; still violates current “no host priv” stance unless the user explicitly redefines userns-scoped privileged as acceptable.
- Never silently allow.

## 5. Rejected / out-of-scope in this draft

| Option | Why rejected here |
|---|---|
| `seccompProfile: Unconfined` | PSS baseline deny; not a minimal syscall exception; hides root cause |
| Global / namespace PSS relaxation | Forbidden by assignment |
| `--oci-worker-no-process-sandbox` | Separate discouraged sandbox exception |
| hostPath / docker.sock / containerd.sock | Forbidden |
| New VM / privileged host builder | Forbidden |
| Hand-coded allow-all seccomp (`defaultAction: ALLOW`) | Forbidden |
| Publication / `AJRLY_BUILDKIT_READY` / broker write enable | Gated on isolation proof |

## 6. Identity / permissions / root-broker readiness (independent map)

| Control | Current readiness | Exception coupling |
|---|---|---|
| Rootless canary isolation | **Failed** (rolled back) | Must pass before any builder publication |
| `CI_CACHE_AUTHORITY_BUILDKIT_ROOTLESS_READY` | Default **false** (fail-closed) | Root flips only after isolation + review |
| BuildKit write grants (Ed25519) | Implemented but gated on readiness flag | No Harbor/publisher creds in grant responses |
| Turbo / dependency broker writes | Separate; still fail-closed without durable identity binding | Not unlocked by seccomp exception alone |
| App private keys / credentials | **Must not** appear in this review or candidate docs | Reference public trust material only after rootless proof |
| Reference identity permissions | JOB-TOKEN limited to `GET /job`; metadata token server-side; allowlists bind commit SHA + include pin | Unchanged by this exception |

This exception review **does not** mint secrets, rotate keys, or enable brokers.

## 7. Risk / test / rollback / review criteria

### Risks

1. **Candidate A seccomp widening:** namespace-creating `clone`/`unshare` enable nested container runtimes inside the canary pod → breakout impact still constrained by userns + drop ALL, but higher than RuntimeDefault.
2. **False confidence:** passing rootlesskit start ≠ build isolation; `/proc` mount and snapshotter checks still required.
3. **Candidate B privileged request (if later approved):** largest capability jump; must stay worker05-only and reversible.
4. **Setuid helper enablement:** high risk; treat as separate from seccomp.

### Tests

**Completed by finalize worker (no apply):**

1. Go emit of containerd v2.3.5 `DefaultProfile` (linux/amd64, empty caps) + SHA-256.
2. Independent syscall-diff verifier (baseline ⊕ exactly `clone`/`clone3`/`unshare`).
3. OCI LinuxSeccomp structural validation (ERRNO default, arches, args ops).
4. Fail-closed candidate checks; `APPLY=1` refused.
5. `kubectl apply --server-side --dry-run=server` on Candidate A pod (admission shape only; profile file not on node yet).

**Still root-owned live (only after user approval):**

1. Talos worker05 `seccompProfiles` apply + `talosctl read` hash match.
2. Deploy Candidate A pod; expect either (i) progress past rootlesskit EPERM, or (ii) next precise errno — **not** readiness.
3. Isolation checklist from `docs/ci-rootless-canary.md`.
4. Candidate B only as a separate approved experiment.

### Rollback

1. Delete canary pod(s).
2. Strip worker05 `seccompProfiles` entry + canary label + `user.max_user_namespaces` (live strip of those keys only; preserve other machine fields).
3. Confirm sysctl `0`, label absent, profile file gone (`talosctl read` / `get seccompprofiles`).
4. Keep publication false; keep authority rootless-ready false.

### Review criteria before any user approval ask

- [x] Diagnosis pinned to containerd v2.3.5 NS-clone/unshare deny (not Unconfined narrative).
- [x] Complete Localhost profile generated from real `DefaultProfile` + hashed provenance + independent diff.
- [x] No Unconfined / allow-all / process-sandbox / hostPath / socket / global PSS in finalize candidates.
- [x] Setuid / userns-privileged / mount residuals explicitly labeled as separate future review.
- [x] Broker/publication controls remain fail-closed.
- [x] Worker05-only scope + rollback + gated root commands documented.
- [ ] Root coordinator confirms whether burning a live A canary is worth it given low readiness likelihood.
- [ ] **User approval** (not requested by finalize worker).

## 8. Recommendation

1. **Candidate A is the smallest *diagnostic* exception** (three syscalls, hard constraints otherwise unchanged). Artifacts are now complete enough to approve a canary *if* desired.
2. **Do not expect A to finish rootless readiness.** Nested rootlesskit + `hostUsers: false` + NoNewPrivileges + denied `mount` remain probable blockers. If credits/time matter, **skip applying A** and choose architecture instead of probing the next errno.
3. Candidate B without privileged remains a measurement-only path; upstream-complete B needs an explicit larger exception (PSS/capability) conflicting with current no-host-priv stance.
4. If A is applied and dies on `newuidmap`/NoNewPrivileges or nested-userns mapping, **stop** — do not silently enable setuid; open a dedicated helper-mapping exception or abandon nested rootlesskit under `hostUsers: false`.
5. Upstream userns+privileged BuildKit is a **different** exception class and must be user-approved explicitly against the current “no host priv” rule.

## 9. Coordinator gate

Root coordinator reviews this draft and `delegation/rootless-exception-finalize/RESULT.md` / complete candidates **before** asking the user for approval. Finalize worker: **no live apply**.
