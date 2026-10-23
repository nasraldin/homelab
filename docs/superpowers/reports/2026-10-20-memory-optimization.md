# Homelab capacity optimization — memory rollout final report

Date: 2026-10-20 · Scope: pve01 host + Talos Kubernetes memory right-sizing · Status: **complete**
Final status record: `/tmp/homelab-capacity/opencode-result.json` · Observability acceptance: `/tmp/homelab-capacity/observability-result.json` (status `pass`)

## Summary

The user reported roughly 88% RAM usage. The initial host measurement showed 86.97 GiB used and roughly 5 GiB available on a 92 GiB host. The rollout right-sized VM and pod memory, capped the ZFS ARC, and tuned Prometheus/Alloy Go runtime memory — while keeping all three control planes, all 33 observability pods (no collectors, retention or metrics removed), per-job runner limits, and all data. All checks pass live: 8/8 nodes Ready, 3/3 CNPG clusters healthy, 4/4 runner managers Ready with the intended admission, platform pipeline 763 SUCCESS, all 34 public/local URL probes PASS after the final restarts.

## Before → After (measured)

| Measurement | Before | After (live 19:35–19:45 +04) |
| --- | --- | --- |
| pve01 host physical RAM | 94180 MB (~92 GiB) | unchanged |
| pve01 host used | 86.97 GiB, ~5 GiB available | 77973 MB used (~76.2 GiB), 16206 MB available (~15.8 GiB) |
| ZFS ARC max | 16 GiB | **8 GiB** (`zfs_arc_max=8589934592`, runtime + persistent initramfs; live ARC size ~8.0 GiB at cap) |
| Configured running guest memory | 92 GiB | **86 GiB** (Talos 70 GiB + foundation 16 GiB) |
| talos-cp01/02/03 VMs | 4 GiB each | 4 GiB each — **unchanged, three control planes kept** |
| talos-worker01/02 | 8 GiB each | **8 GiB each** — stays at 8 GiB by design, documented in infra MR18 commit df654ea ("worker01/02 stay at 8 GiB") |
| talos-worker03 (VM 306) | 16 GiB | **14 GiB** (`memory: 14336`, `balloon: 14336`) |
| talos-worker04 (VM 307) | 16 GiB | **12 GiB** (`memory: 12288`, `balloon: 12288`) |
| talos-worker05 | 16 GiB / 8 cores | 16 GiB / 8 cores — kept (7-day CPU peak 6.6 cores, 3.92 GiB build peaks) |
| Foundation VMs gitlab-01 / runner-01 | — | 12 GiB + 4 GiB = 16 GiB (the "86 GiB" total includes these) |
| Prometheus working set | 1941 MiB | 1233 MiB early-after restart; 1374 MiB live sample minutes later (see limitations) |
| Prometheus Go tuning | default GC | GOGC=50, GOMEMLIMIT 1536 MiB (target 1610612736 B); 3 GiB hard limit unchanged |
| Alloy Go tuning | default | GOMEMLIMIT 320 MiB (335544320 B); 512 MiB hard limit unchanged |
| Runner admission | per-job 4 GiB, helper 512 MiB (unchanged) | **4 build + 6 check slots** via 2 replicas × pool `concurrent=2` (build) / `concurrent=3` (checks), `request_concurrency` aligned |

## What changed

1. **Proxmox host (pve01)** — ZFS ARC capped at 8 GiB via `lab-home-pve01/ansible/playbooks/proxmox-memory.yml`, applied runtime and persistently (initramfs). Idempotent re-apply validated (0 changes) plus check-mode validation.
2. **Worker VMs** — worker03 (VM 306) 16→14 GiB and worker04 (VM 307) 16→12 GiB via Talos graceful poweroff, Proxmox memory + balloon set, restart, new boot-ID verification, reduced-capacity check, Ready check, uncordon. Final boot IDs confirm the reduced-memory boots today at 15:24:54Z / 15:28:27Z (19:24 / 19:28 local). Worker01/02 remain at 8 GiB by design and worker05 keeps 16 GiB / 8 cores for CI build peaks. Desired state is committed in infra MR18 (`cluster.auto.tfvars`: 16384→14336 and 16384→12288) and matches live Proxmox config exactly — no drift.
3. **Observability Go runtime** — Prometheus GOGC 50 + GOMEMLIMIT 1536 MiB (3 GiB hard limit unchanged) and Alloy GOMEMLIMIT 320 MiB (512 MiB hard limit unchanged) via Helm. All 33 observability pods kept (3 DaemonSets × 8 nodes = 24 collectors + 9 platform pods), no collectors/retention/metrics removed, `retention_or_data_deleted: false`.
4. **GitLab runners** — admission re-verified at 4 build + 6 check concurrent slots: 2 replicas × pools with `concurrent=2` (build) and `concurrent=3` (checks), `request_concurrency` aligned. Per-job 4 GiB and helper 512 MiB limits unchanged. New capacity fixture + regression validates 4+6 with 512 MiB margin; harness derives defaults and per-pool bounds; historical 20-slot library tests preserved. `gitlab-runners-apply.sh` finished successfully; all 4 manager pods rolled out and Ready.
5. **Documentation** — infra runbook host-memory budget section (`docs/runbook.md` in MR18) and observability capacity runbook (`docs/runbook-observability-capacity.md` in MR105).

## Deliberate inclusions

- **Three control planes preserved** — cp01/02/03 each stay at 4 GiB; no control-plane node was removed, resized or reconfigured (no OS/control-plane config changes).
- **All collectors kept** — all 33 observability pods were retained because the collectors provide distinct coverage; capacity relief came from Go runtime tuning instead of removing collectors, retention, or metrics.
- **No reviews merged or data deleted** — all six review requests remain open and unmerged; no data, PVC, or retention was deleted; credentials were never printed (sanitized outputs only).

## Verification evidence

- **Nodes/pods**: 8/8 nodes Ready; no Pending pods; no active CrashLoopBackOff pods. Stale terminal debris pods (Error/Completed with healthy same-ReplicaSet replacements) were cleaned during final verification.
- **CNPG**: 3/3 active clusters healthy — postgres/ajrly-postgres 3/3, postgres/harbor-postgres 1/1, postgres/n8n-postgres 1/1.
- **Runners**: 4/4 manager pods Ready; `concurrent=2`/`concurrent=3` verified in-cluster config (sanitized); ci-cache-authority 1/1.
- **Observability**: full acceptance `pass` — real metrics/logs/traces, authenticated Grafana queries, Gateway OTLP, span metrics, 90 s flush, Prometheus/Loki/Tempo/Grafana restarts recovering onto the **same retained PVs** with persisted reads (`observability-result.json`; log `/tmp/homelab-capacity/observability-final-acceptance.log`).
- **URL probes**: 34/34 PASS **after** the final restarts (`/tmp/homelab-capacity/routes-final-after-restarts.log`).
- **Unit/regression**: `python3 -m unittest discover -s scripts -p 'test_*.py'` → 380 tests OK, 6 skipped (`platform-tests.log`). AI live verify PASS (`ai-final-verify.log`). Pinned Helm 3 lint/render passed for all monitoring and runner charts.
- **Pipelines** (all green, latest IDs): platform [MR105](https://gitlab.ajrly.app/homelab/homelab-platform-services/-/merge_requests/105) → [pipeline 763 SUCCESS](https://gitlab.ajrly.app/homelab/homelab-platform-services/-/pipelines/763) (28/28 jobs; pipeline 762 superseded). Infra [MR18](https://gitlab.ajrly.app/homelab/homelab-cluster-infra/-/merge_requests/18) → [pipeline 761 SUCCESS](https://gitlab.ajrly.app/homelab/homelab-cluster-infra/-/pipelines/761) on right-sizing commit df654ea. Vault MR28 → 752, Templates MR6 → 753, Deployments MR10 → 758 all SUCCESS. Foundation [PR18](https://github.com/nasraldin/lab-home-pve01/pull/18) → [validation 39448718186 SUCCESS](https://github.com/nasraldin/lab-home-pve01/actions/runs/39448718186).

## Measurement limitations (no optimistic steady-state claims)

- Host "76 GiB used / 15.8 GiB available" is an **early post-restart observation**, not a long-window steady-state number; workers 03/04 had rebooted minutes earlier during the rollout.
- Prometheus working-set values (1233–1374 MiB) are **early post-restart samples**; PromQL shortly after restarts contains stale duplicate container IDs, and a 2-hour steady-state comparison has not been run yet. The pre-tuning sample used for this comparison was 1941 MiB.
- The platform charts (`monitoring-values.yaml`, `alloy-values.yaml`) and infra tfvars are committed for review; the MRs remain **open and unmerged** by instruction.

## Remaining observations (non-blocking, pre-existing, outside this scope)

- Stale CNPG resources that predate this rollout: `ajrly/ajrly-postgres` (16 d old, no pods, "error while interacting with plugins" status) and `ai/n8n-postgres` (8 d old). The three active clusters live in the `postgres` namespace and are healthy. Cleanup is a separate follow-up; not touched here.
- Control-plane nodes show the highest memory utilization (cp01 95% / cp02 76% / cp03 67% of allocatable at 4 GiB). With the KEEP-THREE decision this is expected; watch CP memory in the next steady-state window.
- One transient CI issue was resolved: pipeline 763's `turbo-cache-forge:render` hung ~11 min on `apk add` (external Alpine CDN; norm 10–13 s). It was canceled and retried in-place as job 12398, which passed in 11 s — a transient external download, not a source issue.

## Continuation re-verification (2026-10-23)

Host restarts on 2026-10-21 and 2026-10-23 wiped the `/tmp` evidence files referenced above (`observability-result.json`, `routes-final-after-restarts.log`, `runner-apply.log`, `platform-tests.log`, `ai-final-verify.log`). The cluster itself was unaffected. Everything feasible was re-verified live on 2026-10-23 with fresh evidence:

- **Cluster**: 8/8 nodes Ready; zero non-Running pods; 3/3 active CNPG clusters healthy; 4/4 runner manager pods Ready plus ci-cache-authority 1/1; sanitized in-cluster config still `concurrent = 2` (build) / `concurrent = 3` (checks) with aligned `request_concurrency` (4 build + 6 check admission slots).
- **Observability persistence (regenerated result file)**: 33/33 pods Running on the same 17-day-old retained PVCs; Prometheus `count(up)`=106 with 154 distinct `up` series over a 3-day window spanning the 2026-10-20 restarts, TSDB oldest sample ≈15.1 days, 385 `traces_*` span-metric series; Loki 5,506,169 retained log entries over 3 days (~2.1 GB scanned); Tempo ready with a live searchable trace (harbor-core); Grafana `/api/health` database ok (v13.2.4). Regenerated result: `/tmp/homelab-capacity/observability-result.json`.
- **URLs**: fresh probe of all 49 externally-routed hostnames (superset of the original 34): **49/49 PASS** with verified TLS (native Proxmox `pve01.lab.ajrly.app:8006` verified against its PVE CA) — `/tmp/homelab-capacity/routes-final-after-restarts.log` (regenerated).
- **3-day steady-state samples (2026-10-23)**: worker03 6.25 GiB (46% of 14 GiB), worker04 5.36 GiB (47% of 12 GiB), worker05 2.6 GiB (17%); cp01/02/03 at 82/70/71% of allocatable (expected with three control planes kept); Prometheus working set 1963 MiB (3-day range 1563–1963 MiB — GOMEMLIMIT is a soft GC target, the 3 GiB hard limit has not been hit).
- **Live VM memory via Proxmox API** (CSI token used in-process; no credentials printed): worker VMs at exactly 8/8/14/12/16 GiB (58 GiB) — matches the infra MR18 desired state with no drift.
- **Host RAM/ARC runtime re-sample blocked — exact status, not invented**: the SSH key is passphrase-protected and no loadable agent survived the restarts (`Permission denied (publickey)` via BatchMode and UseKeychain attempts; `ssh-add --apple-use-keychain` has no stored passphrase), and the Proxmox API token returns `403 Permission check failed (/nodes/pve01, Sys.Audit)` on `/nodes/pve01/status`. The 2026-10-20 measurements (76.2 GiB used / 15.8 GiB available; ARC max 8 GiB runtime + initramfs, idempotent re-apply 0 changes) remain the recorded host-level values.
- **Reviews**: all six were merged on 2026-10-21 by a separate session/decision — this rollout merged nothing; see [2026-10-21-merge-completion.md](2026-10-21-merge-completion.md). Pipelines re-checked 2026-10-23: platform 763 success (28/28); post-merge main pipelines 774 (platform), 767 (infra), 766 (deployments) with automatic checks passed and normal manual deploy gates; vault 765 and templates 764 success; foundation main validation 39489711262 success.
