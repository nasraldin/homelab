# Lab refresh issues tracker (2026-07)

Symptom → cause → fix log from the **full factory-reset + Terraform + Ansible**
rebuild. Use with the checklist in [lab-refresh-runbook.md](lab-refresh-runbook.md).
Install-time Proxmox issues stay in [installation/issues-tracker.md](../installation/issues-tracker.md).

Statuses: `resolved` | `workaround` | `open` | `expected`.

## Summary

| ID | Title | Status |
| -- | ----- | ------ |
| [REF-001](#ref-001-ssh-host-key-changed-after-recreate) | SSH host key changed after recreate | resolved |
| [REF-002](#ref-002-terraform-already-exists-on-opshub) | Terraform “already exists” on OpsHub | resolved |
| [REF-003](#ref-003-zfs-data01-device-already-in-use) | ZFS `data01` “device already in use” | resolved |
| [REF-004](#ref-004-mac-remote-empty-argv-broke-wrappers) | Mac remote empty argv broke wrappers | resolved |
| [REF-005](#ref-005-host-cleanup-unsafe-kernel-purge) | Host cleanup unsafe kernel purge | resolved |
| [REF-006](#ref-006-vault-transit-init-wrong-flags) | Vault Transit init used Shamir flags | resolved |
| [REF-007](#ref-007-vault-shamir-unseal-on-transit-primary) | Shamir unseal loop on Transit primary | resolved |
| [REF-008](#ref-008-apt-repository-deprecation) | `apt_repository` deprecation warnings | resolved |
| [REF-009](#ref-009-ansible-remote-tmp-on-fresh-vm) | Ansible `remote_tmp` on fresh VM | expected |
| [REF-010](#ref-010-lan-dns-death-while-replacing-adguard) | LAN DNS death while replacing AdGuard | resolved |
| [REF-011](#ref-011-vzdump-backups-opt-in-wipe) | vzdump backups accidentally wiped | resolved |
| [REF-012](#ref-012-factory-reset-keeps-users-by-design) | Confusion: users/tokens “left behind” | resolved |
| [REF-013](#ref-013-factory-reset-residual-wipe-hit-os-disk-nvme0n1) | Factory-reset GPT wipe hit OS disk | resolved (script) |

---

## REF-001: SSH host key changed after recreate

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | Immediately after `terraform apply` recreates guests (any wipe/replace) |
| **Symptom** | `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!` / `Host key verification failed.` / Ansible `unreachable` |
| **Root cause** | Cloud-init mints **new** SSH host keys on new disks. Mac `~/.ssh/known_hosts` still has keys from the previous guests at the same IPs |
| **Fix** | Scripted clear + optional re-learn: `ansible-lab/scripts/refresh-ssh-known-hosts.sh` |
| **Prevention** | Runbook step **D** after every wipe + TF apply — always `--check` then apply |
| **Verify** | `./scripts/refresh-ssh-known-hosts.sh --check` → no `[STALE]`; `ansible all -m ping` |

```bash
cd ~/homelab/ansible-lab
./scripts/refresh-ssh-known-hosts.sh --check
./scripts/refresh-ssh-known-hosts.sh
./scripts/refresh-ssh-known-hosts.sh --accept-new   # once :22 answers
```

Manual equivalent (do not prefer over the script):

```bash
for ip in 10 11 12 14 15 16 17 18 19 20; do
  ssh-keygen -R "192.168.68.${ip}"
done
```

---

## REF-002: Terraform “already exists” on OpsHub

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | First `terraform apply` after factory-reset with **empty state** |
| **Symptom** | Create fails for OpsHub role / `opshub@pve` / token / ACL — object already exists on Proxmox |
| **Root cause** | Factory-reset **keeps** Proxmox users/tokens by default (intentional). Empty TF state tries to create them again |
| **Fix** | `terraform-lab/scripts/adopt-existing.sh` imports role, user, token, ACL into state |
| **Prevention** | Runbook step **C** — adopt before plan/apply after wipe |
| **Verify** | `terraform plan` shows no create for OpsHub identity objects |

```bash
cd ~/homelab/terraform-lab
./scripts/adopt-existing.sh --check
./scripts/adopt-existing.sh
```

Do **not** delete OpsHub just to make apply green unless you deliberately used
`--include-tokens` on the wipe.

---

## REF-003: ZFS `data01` “device already in use”

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | Terraform recreates `proxmox_virtual_environment_hagroup` / node disk ZFS after wipe |
| **Symptom** | `cannot create 'data01': … device already in use` (or equivalent) |
| **Root cause** | `zpool destroy` left residual GPT / `zfs_member` signatures on the Kingston (or data) disk |
| **Fix** | 1) Factory-reset now wipes residual GPT after `zpool destroy`. 2) Adopt script can force wipe: `--wipe-stale-zfs-disks` |
| **Prevention** | Prefer current `factory-reset-lab.sh`; if an older wipe left signatures, run adopt wipe once |
| **Verify** | `zpool list` shows `data01`; TF plan clean for ZFS |

```bash
./scripts/adopt-existing.sh --wipe-stale-zfs-disks
terraform apply
```

---

## REF-004: Mac remote empty argv broke wrappers

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | Running `./mac/apply-updates.sh` (and similar) via `lib/mac-remote.sh` |
| **Symptom** | Remote script received a spurious empty argument; wrappers failed or behaved oddly |
| **Root cause** | Bash `${arr[@]:-}` expanded to a single empty string when the array was empty |
| **Fix** | `proxmox-bootstrap/lib/mac-remote.sh` — do not forward empty `''` placeholders |
| **Prevention** | Covered by bootstrap lib; re-pull `proxmox-bootstrap` before host ops |
| **Verify** | `./mac/apply-updates.sh --check` (or target wrapper) completes without empty-arg errors |

---

## REF-005: Host cleanup unsafe kernel purge

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | Host cleanup / old-kernel purge on Proxmox |
| **Symptom** | Risk of removing `proxmox-ve` meta or whole kernel series packages |
| **Root cause** | Naive package matching removed series metas (e.g. `proxmox-kernel-7.0`) instead of only concrete installed old kernels |
| **Fix** | `host-cleanup.sh` only purges concrete `ii` old kernels; never removes `proxmox-ve` / series metas; supports simulate |
| **Prevention** | Use bootstrap `host-cleanup` / docs `15-host-cleanup.md`; always simulate first |
| **Verify** | Simulate output lists only concrete old kernel packages |

---

## REF-006: Vault Transit init wrong flags

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | `object-storage.yml` / Vault role init on **Transit** primary (`vault-01`) |
| **Symptom** | `vault operator init` failed or produced wrong key type for auto-unseal |
| **Root cause** | Transit-sealed Vault needs **`-recovery-shares` / `-recovery-threshold`**, not `-key-shares` / `-key-threshold` (Shamir) |
| **Fix** | `ansible-lab/roles/vault/tasks/main.yml` — choose init flags from seal type |
| **Prevention** | Re-run object-storage playbook from current role; do not hand-init with Shamir flags on Transit |
| **Verify** | Init JSON has recovery keys; primary unseals via Transit without Shamir loop |

---

## REF-007: Vault Shamir unseal on Transit primary

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | After Transit primary init |
| **Symptom** | Playbook attempted Shamir unseal with recovery keys (wrong day-2 path) |
| **Root cause** | Recovery keys are break-glass; Transit primaries **auto-unseal** |
| **Fix** | Skip Shamir unseal loop when seal type is Transit; wait for auto-unseal |
| **Prevention** | Keep seal helper (`.19`) healthy before primary; copy both init JSONs offline |
| **Verify** | `vault status` on `.18` → `Sealed false` without manual unseal |

**Ops note:** After wipe, copy `/root/vault-init.json` from **both** `vault-seal` (`.19`) and `vault-01` (`.18`) into the password manager. Never commit.

---

## REF-008: `apt_repository` deprecation

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | Ansible Vault / Infisical roles on ansible-core with deprecation warnings |
| **Symptom** | `[DEPRECATION WARNING]: apt_repository … use deb822_repository` |
| **Root cause** | Legacy one-line `.list` module; removed before ansible-core 2.25 |
| **Fix** | Migrated to `ansible.builtin.deb822_repository` (HashiCorp + Docker); remove leftover `.list` files; `install_python_debian: true` |
| **Prevention** | Match `infra_operator` / `gitlab_runner` pattern for new apt repos |
| **Verify** | Re-run roles — no apt_repository deprecation; `/etc/apt/sources.list.d/*.sources` present |

---

## REF-009: Ansible `remote_tmp` on fresh VM

| Field | Detail |
| ----- | ------ |
| **Status** | expected |
| **When** | First Ansible connection to a brand-new guest |
| **Symptom** | Warning about creating `/root/.ansible/tmp` (or user remote_tmp) |
| **Root cause** | Fresh cloud image has no Ansible temp dir yet |
| **Fix** | None required — warning clears on subsequent runs |
| **Prevention** | Ignore on first contact; fail only if ping/unreachable |

---

## REF-010: LAN DNS death while replacing AdGuard

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | Destroy/recreate of `adguard-01` without failover |
| **Symptom** | Mac/Ansible hang on name resolution; phones look “offline” |
| **Root cause** | AdGuard is DHCP **Primary** DNS; blank/missing VM until `dns.yml` finishes |
| **Fix** | Router Secondary `1.1.1.1`; Mac `dns-failover-public.sh` before wipe; `dns.yml` then `dns-restore-adguard.sh` |
| **Prevention** | Runbook steps **A** + **E**; see [lan-dns-resilience.md](lan-dns-resilience.md) |
| **Verify** | `dig @192.168.68.10 …` works; Mac DNS shows `.10` after restore |

---

## REF-011: vzdump backups opt-in wipe

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | Designing factory-reset “wipe everything” |
| **Symptom** | Risk of deleting vzdump archives under `/var/lib/vz/backups` (etc.) unintentionally |
| **Root cause** | Early “all” scope could include backup files |
| **Fix** | Backups **kept by default** even with `--only all`. Wipe only with `--include-backups` or `--only backups` |
| **Prevention** | Always `--check` first; read plan for backup file lines |
| **Verify** | Dry-run without include flags shows backups not destroyed |

---

## REF-012: Factory-reset keeps users by design

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **When** | After wipe operators expected “clean” identity |
| **Symptom** | Confusion that wipe “failed” because `opshub@pve` / tokens remained |
| **Root cause** | Design: keep users/tokens so TF can adopt; avoid minting new secrets every refresh |
| **Fix** | Documented + `adopt-existing.sh`; optional `--include-tokens` for true identity wipe |
| **Prevention** | Read factory-reset “what is protected / opt-in” tables before destroy |
| **Verify** | After default wipe: tokens still on node; adopt → plan clean |

---

## REF-013: Factory-reset residual wipe hit OS disk (`nvme0n1`)

| Field | Detail |
| ----- | ------ |
| **Status** | resolved (script); node needs rescue/reinstall |
| **When** | 2026-07-25 redesign refresh — `factory-reset-lab.sh --yes --i-understand-destroy` |
| **Symptom** | After later crash/reboot, machine looks like “no OS / disks wiped”; Proxmox does not boot |
| **Root cause (verified in log)** | After `zpool destroy data01`, orphan GPT wipe ran `wipefs` + `sgdisk --zap-all` on **`/dev/nvme0n1`** (Samsung / `rpool`) as well as `nvme1n1`. Guard used `basename` (`nvme0n1`) against `zpool status` **by-id** paths, so the rpool check failed open. Pool stayed imported in memory → Terraform/Ansible still worked until reboot |
| **Not verified** | Live hang / SSH timeouts were **not** proven as OOM. No `dmesg` OOM lines or `free -h` were collected (SSH already timed out). Oversubscription (~174 GiB dedicated vs ~91 GiB) remains a **hypothesis** for the mid-run unresponsiveness only |
| **Fix** | `proxmox-bootstrap`: refuse wipe if disk belongs to `rpool` via `readlink` / `lsblk PKNAME` (commit on main). Docs note in `14-factory-reset.md` |
| **Prevention** | Never wipe by short device name alone; always map to rpool vdevs; `--check` must list every wipe target |
| **Verify** | Rescue: `zpool import`; confirm script dry-run never plans wipe of rpool’s disk |

---

## Refresh timeline (condensed)

| Phase | What happened |
| ----- | ------------- |
| 1 | Factory-reset on `pve01` (guests + lab storage/ZFS); users/tokens + backups kept |
| 2 | Residual GPT blocked `data01` recreate → wipe residual / adopt `--wipe-stale-zfs-disks` |
| 3 | Empty TF state hit OpsHub “already exists” → `adopt-existing.sh` |
| 4 | `terraform apply` → VMs 110–123 + CT 200 up |
| 5 | SSH to guests failed (host key changed) → clear known_hosts (now scripted) |
| 6 | `dns.yml` → `infra.yml` → object-storage (Vault init flags fixed) → GitLab |
| 7 | Migrated apt repos to deb822; documented runbook + this tracker |

---

## Adding a new REF entry

1. Assign next `REF-NNN`.
2. Fill Status / When / Symptom / Root cause / Fix / Prevention / Verify.
3. Link any script or task path that encodes the fix.
4. Mention the ID in the runbook checklist note if it changes procedure order.
