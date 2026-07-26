# Lab refresh issues tracker (2026-07)

Symptom → cause → fix log from the **full factory-reset + Terraform + Ansible**
rebuild. Use with the checklist in [lab-refresh-runbook.md](lab-refresh-runbook.md).
Install-time Proxmox issues stay in [installation/issues-tracker.md](../installation/issues-tracker.md).

Statuses: `resolved` | `workaround` | `open` | `expected`.

## Summary

| ID                                                                  | Title                                 | Status            |
| ------------------------------------------------------------------- | ------------------------------------- | ----------------- |
| [REF-001](#ref-001-ssh-host-key-changed-after-recreate)             | SSH host key changed after recreate   | resolved          |
| [REF-002](#ref-002-terraform-already-exists-on-opshub)              | Terraform “already exists” on OpsHub  | resolved          |
| [REF-003](#ref-003-zfs-data01-device-already-in-use)                | ZFS `data01` “device already in use”  | resolved          |
| [REF-004](#ref-004-mac-remote-empty-argv-broke-wrappers)            | Mac remote empty argv broke wrappers  | resolved          |
| [REF-005](#ref-005-host-cleanup-unsafe-kernel-purge)                | Host cleanup unsafe kernel purge      | resolved          |
| [REF-006](#ref-006-vault-transit-init-wrong-flags)                  | Vault Transit init used Shamir flags  | resolved          |
| [REF-007](#ref-007-vault-shamir-unseal-on-transit-primary)          | Shamir unseal loop on Transit primary | resolved          |
| [REF-008](#ref-008-apt-repository-deprecation)                      | `apt_repository` deprecation warnings | resolved          |
| [REF-009](#ref-009-ansible-remote-tmp-on-fresh-vm)                  | Ansible `remote_tmp` on fresh VM      | expected          |
| [REF-010](#ref-010-lan-dns-death-while-replacing-adguard)           | LAN DNS death while replacing AdGuard | resolved          |
| [REF-011](#ref-011-vzdump-backups-opt-in-wipe)                      | vzdump backups accidentally wiped     | resolved          |
| [REF-012](#ref-012-factory-reset-keeps-users-by-design)             | Confusion: users/tokens “left behind” | resolved          |
| [REF-013](#ref-013-factory-reset-residual-wipe-hit-os-disk-nvme0n1) | Factory-reset GPT wipe hit OS disk    | resolved (script) |
| [REF-014](#ref-014-gitlab-omnibus-lets-encrypt-half-configured)    | GitLab apt postinst / LE half-config  | resolved          |
| [REF-015](#ref-015-vault-file-audit-pipefail-sigpipe)              | Vault `Enable file audit device`      | resolved          |
| [REF-016](#ref-016-gitlab-runner-register-via-public-url-530)      | Runner register fails (CF 530)        | resolved          |
| [REF-017](#ref-017-postgres-18-mount-and-init-permissions)         | Postgres stack unhealthy on first up  | resolved          |
| [REF-018](#ref-018-gitlab-public-url-cloudflare-530-after-rebuild) | Public GitLab HTTPS returns 530       | resolved          |
| [REF-019](#ref-019-mariadb-not-oracle-mysql-by-design)             | “Why MariaDB not MySQL?”              | expected          |
| [REF-020](#ref-020-infisical-port-80-conflicts-with-npm)           | Infisical bind `:80` vs NPM           | resolved          |
| [REF-021](#ref-021-it-tools-image-tag-404)                         | it-tools image tag not found          | resolved          |
| [REF-022](#ref-022-keycloak-pgcat-prepared-statements)             | Keycloak vs PgCat prepared stmts      | resolved          |
| [REF-023](#ref-023-guest-common-apt-on-fedora-podman)              | `guest_common` apt on Fedora podman   | resolved          |
| [REF-024](#ref-024-chrony-on-unprivileged-lxc-dockhand)            | chrony on unprivileged LXC dockhand   | resolved          |
| [REF-025](#ref-025-dockhand-ghcr-image-denied)                     | Dockhand GHCR image pull denied       | resolved          |
| [REF-026](#ref-026-kibana-elastic-superuser-forbidden)             | Kibana forbids `elastic` username     | resolved          |
| [REF-027](#ref-027-sonarqube-skip-upgrade-path)                    | SonarQube skip-upgrade / ES downgrade | resolved          |
| [REF-028](#ref-028-prometheus-loki-config-permission-denied)       | Prometheus/Loki config permission denied | resolved       |
| [REF-029](#ref-029-node-exporter-blocked-by-ufw)                    | node_exporter `:9100` blocked by UFW  | resolved          |

---

## REF-001: SSH host key changed after recreate

| Field          | Detail                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                              |
| **When**       | Immediately after `terraform apply` recreates guests (any wipe/replace)                                                               |
| **Symptom**    | `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!` / `Host key verification failed.` / Ansible `unreachable`                          |
| **Root cause** | Cloud-init mints **new** SSH host keys on new disks. Mac `~/.ssh/known_hosts` still has keys from the previous guests at the same IPs |
| **Fix**        | Scripted clear + optional re-learn: `ansible-lab/scripts/refresh-ssh-known-hosts.sh`                                                  |
| **Prevention** | Runbook step **D** after every wipe + TF apply — always `--check` then apply                                                          |
| **Verify**     | `./scripts/refresh-ssh-known-hosts.sh --check` → no `[STALE]`; `ansible all -m ping`                                                  |

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

| Field          | Detail                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                         |
| **When**       | First `terraform apply` after factory-reset with **empty state**                                                 |
| **Symptom**    | Create fails for OpsHub role / `opshub@pve` / token / ACL — object already exists on Proxmox                     |
| **Root cause** | Factory-reset **keeps** Proxmox users/tokens by default (intentional). Empty TF state tries to create them again |
| **Fix**        | `terraform-lab/scripts/adopt-existing.sh` imports role, user, token, ACL into state                              |
| **Prevention** | Runbook step **C** — adopt before plan/apply after wipe                                                          |
| **Verify**     | `terraform plan` shows no create for OpsHub identity objects                                                     |

```bash
cd ~/homelab/terraform-lab
./scripts/adopt-existing.sh --check
./scripts/adopt-existing.sh
```

Do **not** delete OpsHub just to make apply green unless you deliberately used
`--include-tokens` on the wipe.

---

## REF-003: ZFS `data01` “device already in use”

| Field          | Detail                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                |
| **When**       | Terraform recreates `proxmox_virtual_environment_hagroup` / node disk ZFS after wipe                                    |
| **Symptom**    | `cannot create 'data01': … device already in use` (or equivalent)                                                       |
| **Root cause** | `zpool destroy` left residual GPT / `zfs_member` signatures on the Kingston (or data) disk                              |
| **Fix**        | 1) Factory-reset now wipes residual GPT after `zpool destroy`. 2) Adopt script can force wipe: `--wipe-stale-zfs-disks` |
| **Prevention** | Prefer current `factory-reset-lab.sh`; if an older wipe left signatures, run adopt wipe once                            |
| **Verify**     | `zpool list` shows `data01`; TF plan clean for ZFS                                                                      |

```bash
./scripts/adopt-existing.sh --wipe-stale-zfs-disks
terraform apply
```

---

## REF-004: Mac remote empty argv broke wrappers

| Field          | Detail                                                                                  |
| -------------- | --------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                |
| **When**       | Running `./mac/apply-updates.sh` (and similar) via `lib/mac-remote.sh`                  |
| **Symptom**    | Remote script received a spurious empty argument; wrappers failed or behaved oddly      |
| **Root cause** | Bash `${arr[@]:-}` expanded to a single empty string when the array was empty           |
| **Fix**        | `proxmox-bootstrap/lib/mac-remote.sh` — do not forward empty `''` placeholders          |
| **Prevention** | Covered by bootstrap lib; re-pull `proxmox-bootstrap` before host ops                   |
| **Verify**     | `./mac/apply-updates.sh --check` (or target wrapper) completes without empty-arg errors |

---

## REF-005: Host cleanup unsafe kernel purge

| Field          | Detail                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                               |
| **When**       | Host cleanup / old-kernel purge on Proxmox                                                                             |
| **Symptom**    | Risk of removing `proxmox-ve` meta or whole kernel series packages                                                     |
| **Root cause** | Naive package matching removed series metas (e.g. `proxmox-kernel-7.0`) instead of only concrete installed old kernels |
| **Fix**        | `host-cleanup.sh` only purges concrete `ii` old kernels; never removes `proxmox-ve` / series metas; supports simulate  |
| **Prevention** | Use bootstrap `host-cleanup` / docs `15-host-cleanup.md`; always simulate first                                        |
| **Verify**     | Simulate output lists only concrete old kernel packages                                                                |

---

## REF-006: Vault Transit init wrong flags

| Field          | Detail                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Status**     | resolved                                                                                                                 |
| **When**       | `object-storage.yml` / Vault role init on **Transit** primary (`vault-01`)                                               |
| **Symptom**    | `vault operator init` failed or produced wrong key type for auto-unseal                                                  |
| **Root cause** | Transit-sealed Vault needs **`-recovery-shares` / `-recovery-threshold`**, not `-key-shares` / `-key-threshold` (Shamir) |
| **Fix**        | `ansible-lab/roles/vault/tasks/main.yml` — choose init flags from seal type                                              |
| **Prevention** | Re-run object-storage playbook from current role; do not hand-init with Shamir flags on Transit                          |
| **Verify**     | Init JSON has recovery keys; primary unseals via Transit without Shamir loop                                             |

---

## REF-007: Vault Shamir unseal on Transit primary

| Field          | Detail                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| **Status**     | resolved                                                                      |
| **When**       | After Transit primary init                                                    |
| **Symptom**    | Playbook attempted Shamir unseal with recovery keys (wrong day-2 path)        |
| **Root cause** | Recovery keys are break-glass; Transit primaries **auto-unseal**              |
| **Fix**        | Skip Shamir unseal loop when seal type is Transit; wait for auto-unseal       |
| **Prevention** | Keep seal helper (`.19`) healthy before primary; copy both init JSONs offline |
| **Verify**     | `vault status` on `.18` → `Sealed false` without manual unseal                |

**Ops note:** After wipe, copy `/root/vault-init.json` from **both** `vault-seal` (`.19`) and `vault-01` (`.18`) into the password manager. Never commit.

---

## REF-008: `apt_repository` deprecation

| Field          | Detail                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                           |
| **When**       | Ansible Vault / Infisical roles on ansible-core with deprecation warnings                                                          |
| **Symptom**    | `[DEPRECATION WARNING]: apt_repository … use deb822_repository`                                                                    |
| **Root cause** | Legacy one-line `.list` module; removed before ansible-core 2.25                                                                   |
| **Fix**        | Migrated to `ansible.builtin.deb822_repository` (HashiCorp + Docker); remove leftover `.list` files; `install_python_debian: true` |
| **Prevention** | Match `infra_operator` / `gitlab_runner` pattern for new apt repos                                                                 |
| **Verify**     | Re-run roles — no apt_repository deprecation; `/etc/apt/sources.list.d/*.sources` present                                          |

---

## REF-009: Ansible `remote_tmp` on fresh VM

| Field          | Detail                                                           |
| -------------- | ---------------------------------------------------------------- |
| **Status**     | expected                                                         |
| **When**       | First Ansible connection to a brand-new guest                    |
| **Symptom**    | Warning about creating `/root/.ansible/tmp` (or user remote_tmp) |
| **Root cause** | Fresh cloud image has no Ansible temp dir yet                    |
| **Fix**        | None required — warning clears on subsequent runs                |
| **Prevention** | Ignore on first contact; fail only if ping/unreachable           |

---

## REF-010: LAN DNS death while replacing AdGuard

| Field          | Detail                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                      |
| **When**       | Destroy/recreate of `adguard-01` without failover                                                             |
| **Symptom**    | Mac/Ansible hang on name resolution; phones look “offline”                                                    |
| **Root cause** | AdGuard is DHCP **Primary** DNS; blank/missing VM until `dns.yml` finishes                                    |
| **Fix**        | Router Secondary `1.1.1.1`; Mac `dns-failover-public.sh` before wipe; `dns.yml` then `dns-restore-adguard.sh` |
| **Prevention** | Runbook steps **A** + **E**; see [lan-dns-resilience.md](lan-dns-resilience.md)                               |
| **Verify**     | `dig @192.168.68.10 …` works; Mac DNS shows `.10` after restore                                               |

---

## REF-011: vzdump backups opt-in wipe

| Field          | Detail                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                   |
| **When**       | Designing factory-reset “wipe everything”                                                                  |
| **Symptom**    | Risk of deleting vzdump archives under `/var/lib/vz/backups` (etc.) unintentionally                        |
| **Root cause** | Early “all” scope could include backup files                                                               |
| **Fix**        | Backups **kept by default** even with `--only all`. Wipe only with `--include-backups` or `--only backups` |
| **Prevention** | Always `--check` first; read plan for backup file lines                                                    |
| **Verify**     | Dry-run without include flags shows backups not destroyed                                                  |

---

## REF-012: Factory-reset keeps users by design

| Field          | Detail                                                                               |
| -------------- | ------------------------------------------------------------------------------------ |
| **Status**     | resolved                                                                             |
| **When**       | After wipe operators expected “clean” identity                                       |
| **Symptom**    | Confusion that wipe “failed” because `opshub@pve` / tokens remained                  |
| **Root cause** | Design: keep users/tokens so TF can adopt; avoid minting new secrets every refresh   |
| **Fix**        | Documented + `adopt-existing.sh`; optional `--include-tokens` for true identity wipe |
| **Prevention** | Read factory-reset “what is protected / opt-in” tables before destroy                |
| **Verify**     | After default wipe: tokens still on node; adopt → plan clean                         |

---

## REF-013: Factory-reset residual wipe hit OS disk (`nvme0n1`)

| Field                            | Detail                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                       | resolved (script); node needs rescue/reinstall                                                                                                                                                                                                                                                                                         |
| **When**                         | 2026-07-25 redesign refresh — `factory-reset-lab.sh --yes --i-understand-destroy`                                                                                                                                                                                                                                                      |
| **Symptom**                      | After later crash/reboot, machine looks like “no OS / disks wiped”; Proxmox does not boot                                                                                                                                                                                                                                              |
| **Root cause (verified in log)** | After `zpool destroy data01`, orphan GPT wipe ran `wipefs` + `sgdisk --zap-all` on **`/dev/nvme0n1`** (Samsung / `rpool`) as well as `nvme1n1`. Guard used `basename` (`nvme0n1`) against `zpool status` **by-id** paths, so the rpool check failed open. Pool stayed imported in memory → Terraform/Ansible still worked until reboot |
| **Not verified**                 | Live hang / SSH timeouts were **not** proven as OOM. No `dmesg` OOM lines or `free -h` were collected (SSH already timed out). Oversubscription (~174 GiB dedicated vs ~91 GiB) remains a **hypothesis** for the mid-run unresponsiveness only                                                                                         |
| **Fix**                          | `proxmox-bootstrap`: refuse wipe if disk belongs to `rpool` via `readlink` / `lsblk PKNAME` (commit on main). Docs note in `14-factory-reset.md`                                                                                                                                                                                       |
| **Prevention**                   | Never wipe by short device name alone; always map to rpool vdevs; `--check` must list every wipe target                                                                                                                                                                                                                                |
| **Verify**                       | Rescue: `zpool import`; confirm script dry-run never plans wipe of rpool’s disk                                                                                                                                                                                                                                                        |

---

## REF-014: GitLab Omnibus Let's Encrypt → half-configured package

| Field          | Detail                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                                                                                                                        |
| **When**       | First `ansible-playbook playbooks/gitlab.yml -e @secrets.yml` after guests exist                                                                                                                                                |
| **Symptom**    | `TASK [gitlab_omnibus : Install GitLab CE Omnibus package]` fails: `dpkg returned error code (1)`; stdout mentions Let's Encrypt / ACME, or later `problem with public attributes; run gitlab-ctl reconfigure manually`          |
| **Root cause** | Apt install used `EXTERNAL_URL=https://gitlab.nasraldin.com`, which enables **Let's Encrypt HTTP-01** in Omnibus postinst. Cloudflare Tunnel origin returns **530** on `/.well-known/acme-challenge/…`, so reconfigure fails and `gitlab-ce` stays **half-configured**. Role wrote `gitlab.rb` (LE off) **after** install — too late for postinst. |
| **Debug**      | See [Debug: GitLab half-configured](#debug-gitlab-half-configured) below                                                                                                                                                        |
| **Fix**        | `ansible-lab/roles/gitlab_omnibus/tasks/main.yml`: create `/etc/gitlab` + deploy `gitlab.rb.j2` **before** apt; do **not** pass `EXTERNAL_URL` on install; if already half-configured, `gitlab-ctl reconfigure` then `dpkg --configure gitlab-ce` **before** apt. Template keeps `letsencrypt['enable'] = false` and HTTP-only nginx (TLS at Tunnel). |
| **Prevention** | Never install Omnibus with public HTTPS `EXTERNAL_URL` when TLS terminates at Cloudflare Tunnel. Always pre-seed `gitlab.rb`.                                                                                                   |
| **Verify**     | `dpkg-query -W -f='${Status}\n' gitlab-ce` → `install ok installed`; `curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.68.14/users/sign_in` → `200`                                                                      |

### Debug: GitLab half-configured

```bash
# On gitlab-01 (.14)
dpkg-query -W -f='${Status}\n' gitlab-ce
# expect: install ok installed  OR  half-configured / unpacked

sudo gitlab-ctl reconfigure 2>&1 | tee /tmp/gitlab-reconfigure.log
# Look for: letsencrypt, acme, 530, public attributes

# After reconfigure succeeds:
sudo dpkg --configure gitlab-ce
dpkg-query -W -f='${Status}\n' gitlab-ce
```

From the control Mac, confirm LE was the trap (first failure class):

```bash
# Tunnel/origin ACME path fails from the internet while LAN HTTP works
curl -sS -o /dev/null -w 'lan:%{http_code}\n' http://192.168.68.14/users/sign_in
curl -sS -o /dev/null -w 'public:%{http_code}\n' --connect-timeout 8 \
  https://gitlab.nasraldin.com/users/sign_in || true
```

---

## REF-015: Vault `Enable file audit device` (pipefail + SIGPIPE)

| Field          | Detail                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**     | resolved                                                                                                                                                                                               |
| **When**       | `gitlab.yml` imports `object-storage.yml` → role `vault` on **`vault-seal`** (`.19`)                                                                                                                   |
| **Symptom**    | `TASK [vault : Enable file audit device]` fatal; output **censored** (`no_log: true`); recap `vault-seal … failed=1`                                                                                    |
| **Root cause** | Idempotent check used `set -o pipefail` + `vault audit list … \| grep -q '"file/"'`. When `file/` **already exists**, `grep -q` exits early → Vault gets **SIGPIPE** → pipeline **rc=141** → EXISTS branch skipped → `vault audit enable` returns `path already in use` (or similar) and older scripts with `set -e` aborted. |
| **Debug**      | See [Debug: Vault file audit](#debug-vault-file-audit) below                                                                                                                                           |
| **Fix**        | `ansible-lab/roles/vault/tasks/main.yml`: capture `vault audit list -format=json` into a variable, then `grep` the string (no pipefail on the Vault CLI). Treat `path is already in use` / `permission denied` as success when `file/` is present. Explicit `failed_when` on stdout markers. |
| **Prevention** | Never `vault … \| grep -q` under `pipefail` for existence checks. Prefer JSON parse or variable capture.                                                                                               |
| **Verify**     | `ansible-playbook playbooks/object-storage.yml --limit vault-seal -e @secrets.yml` → audit task `ok`; `vault audit list` shows `file/`                                                                  |

### Debug: Vault file audit

```bash
# On vault-seal (.19) — reproduce without Ansible no_log
sudo VAULT_ADDR=http://127.0.0.1:8200 vault status
TOKEN=$(sudo jq -r .root_token /root/vault-init.json)
sudo env VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN="$TOKEN" \
  vault audit list -format=json

# Prove SIGPIPE under pipefail (rc 141 when file/ exists):
sudo bash -c 'set -uo pipefail
  export VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN='"$TOKEN"'
  vault audit list -format=json 2>/dev/null | grep -q "\"file/\""
  echo pipeline_rc=$?'

# Safe pattern (what the role uses now):
list_json="$(sudo env VAULT_ADDR=http://127.0.0.1:8200 VAULT_TOKEN="$TOKEN" \
  vault audit list -format=json 2>/dev/null || true)"
printf '%s' "$list_json" | grep -q '"file/"' && echo EXISTS
```

Temporary Ansible visibility (do not leave in role): drop `no_log: true` on that task or run a one-off play that registers stdout.

---

## REF-016: GitLab Runner register via public URL (Cloudflare 530)

| Field          | Detail                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                                                        |
| **When**       | After GitLab Omnibus is healthy; `TASK [gitlab_runner : Register Docker executor runner]` on `runner-01`                                                        |
| **Symptom**    | Register fails with `no_log` censor; public `https://gitlab.nasraldin.com` returns **530**; LAN `http://192.168.68.14` returns **200**                          |
| **Root cause** | Default `gitlab_runner_url` pointed at the **public** Tunnel hostname. After rebuild, Tunnel ingress/connector often is not ready (or origin not published yet), so runner registration against HTTPS fails even though GitLab is fine on the LAN. |
| **Debug**      | See [Debug: Runner register](#debug-runner-register) below                                                                                                      |
| **Fix**        | `ansible-lab/roles/gitlab_runner/defaults/main.yml`: `gitlab_runner_url: "http://{{ hostvars['gitlab-01'].ansible_host }}"` (LAN). Minted `glrt-…` tokens on `gitlab-01` under `/etc/gitlab/ansible-runner-tokens/` remain the auth source. |
| **Prevention** | Lab runners always register to LAN origin. Public URL is for humans / git over Tunnel once [REF-018](#ref-018-gitlab-public-url-cloudflare-530-after-rebuild) is green. |
| **Verify**     | `sudo gitlab-runner list` on `.15`; on GitLab: runner `runner-01-docker` status **online**; `config.toml` `url = "http://192.168.68.14"`                        |

### Debug: Runner register

```bash
# From runner-01 (.15)
curl -sS -o /dev/null -w 'public:%{http_code}\n' --connect-timeout 8 \
  https://gitlab.nasraldin.com/users/sign_in || echo public_fail
curl -sS -o /dev/null -w 'lan:%{http_code}\n' --connect-timeout 5 \
  http://192.168.68.14/users/sign_in

# Token minted by ansible on gitlab-01 (do not paste into chat logs)
ssh nasr@192.168.68.14 'sudo ls -la /etc/gitlab/ansible-runner-tokens/'

# Manual register (LAN) — redact token in logs
TOKEN=$(ssh nasr@192.168.68.14 \
  'sudo cat /etc/gitlab/ansible-runner-tokens/runner-01-docker.token')
ssh nasr@192.168.68.15 "sudo gitlab-runner register --non-interactive \
  --url http://192.168.68.14 --token '$TOKEN' \
  --name runner-01-docker --executor docker --docker-image alpine:latest"
```

---

## REF-017: Postgres 18 mount path + init permissions

| Field          | Detail                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**     | resolved                                                                                                                                                                                               |
| **When**       | First `ansible-playbook playbooks/database.yml -e @secrets.yml` on `database-01` (`.21`)                                                                                                               |
| **Symptom**    | `TASK [database_host : Start Postgres stack]` fails: `dependency failed to start: container postgres is unhealthy` (stderr mostly image pull noise)                                                     |
| **Root cause** | **Two independent bugs:** (1) Compose mounted `pgdata:/var/lib/postgresql/data` — Postgres **18+** official images require the volume at **`/var/lib/postgresql`** (major-version subdirectory layout; see docker-library/postgres#1259 / PR#1259). (2) After fixing the mount, entrypoint still crashed: `ls: cannot open directory '/docker-entrypoint-initdb.d/': Permission denied` because Ansible created `init/` as **`0750` root:root** and SQL as **`0640`**, unreadable by container uid `999`. |
| **Debug**      | See [Debug: Postgres unhealthy](#debug-postgres-unhealthy) below                                                                                                                                       |
| **Fix**        | `postgres-compose.yml.j2`: `pgdata:/var/lib/postgresql`. `tasks/main.yml`: `init/` mode **`0755`**, `01-apps.sql` mode **`0644`**. On a broken first attempt: `docker compose down` + `docker volume rm postgres_pgdata` then `up -d` (fresh lab only — **destroys DB data**). |
| **Prevention** | Keep 18+ mount at `/var/lib/postgresql`; never lock init scripts behind `0750` when the DB runs as non-root.                                                                                           |
| **Verify**     | `docker compose -f /opt/postgres/compose.yaml ps` → `postgres … (healthy)`; app DBs from init SQL exist (`keycloak` / `infisical` / `sonarqube`)                                                      |

### Debug: Postgres unhealthy

```bash
# On database-01 (.21)
sudo docker logs postgres --tail 80
# Case A — wrong mount (18+):
#   Error: … store database data in … major-version-specific directory names
#   … PostgreSQL data in: /var/lib/postgresql/data (unused mount/volume)
# Case B — init perms:
#   ls: cannot open directory '/docker-entrypoint-initdb.d/': Permission denied

sudo ls -la /opt/postgres/init
# Bad:  drwxr-x--- root root
# Good: drwxr-xr-x root root  and  -rw-r--r--  … 01-apps.sql

sudo grep -n 'pgdata:' /opt/postgres/compose.yaml
# Need: pgdata:/var/lib/postgresql   (NOT .../data)

# Fresh volume recreate (lab wipe / first boot only):
cd /opt/postgres
sudo docker compose down
sudo docker volume rm postgres_pgdata
sudo docker compose up -d
# Wait until healthy:
sudo docker inspect postgres --format '{{.State.Health.Status}}'
```

MariaDB / Redis pulls can take many minutes on first run and look “stuck” on `Start MariaDB stack` — check `docker pull` / `docker compose` processes on the guest before assuming a config bug ([phpmyadmin:5.2](https://hub.docker.com/_/phpmyadmin) was slow in the 2026-07 rebuild).

---

## REF-018: GitLab public URL Cloudflare 530 after rebuild

| Field          | Detail                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**     | resolved                                                                                                                                   |
| **When**       | After Ansible GitLab is healthy on LAN; browsers / `curl` to `https://gitlab.nasraldin.com`                                                |
| **Symptom**    | HTTP **530** from Cloudflare; LAN `:80` on `.14` is **200**                                                                                |
| **Root cause** | Tunnel hostname / connector / ingress not republished for this rebuild (or cloudflared not reaching origin). Not an Omnibus/LE failure once REF-014 is fixed. |
| **Debug**      | LAN 200 + public 530 ⇒ fix Tunnel, not GitLab. `cd ~/homelab/cloudflare-tunnel && ./mac/bootstrap.sh --check` then `--yes`. Confirm `GITLAB_HOSTNAME` / `REGISTRY_HOSTNAME` in `config.env` and ingress → `http://192.168.68.14:80` / `:5050`. |
| **Fix**        | Re-run Cloudflare Tunnel bootstrap; wait for connector healthy; re-check curl.                                                             |
| **Prevention** | Runbook: after `gitlab.yml`, always re-apply Tunnel before calling public GitLab “done”.                                                   |
| **Verify**     | `curl -fsS -o /dev/null -w '%{http_code}\n' https://gitlab.nasraldin.com/users/sign_in` → `200` (GitLab sign-in, not Access) — verified 2026-07-26 |

---

## REF-019: MariaDB not Oracle MySQL (by design)

| Field          | Detail                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | expected                                                                                                                                                        |
| **When**       | Reading `docker logs` / compose on `database-01` after `database.yml`                                                                                           |
| **Symptom**    | Confusion that the stack runs **MariaDB** (`mariadb:11.8`) instead of Oracle **MySQL**                                                                          |
| **Root cause** | Design choice, not a mis-install. Spec: *“MariaDB on database-01 only for MySQL-protocol workloads (+ phpMyAdmin)”* — [core-container-hosts design](../superpowers/specs/2026-07-25-core-container-hosts-design.md). Same wire protocol (3306), phpMyAdmin, mysqld-exporter; FOSS image. |
| **Fix**        | None unless deliberately switching to `mysql:8` (would be a design change + compose/docs update).                                                               |
| **Prevention** | Prefer “MySQL-protocol / MariaDB” wording in runbooks; see [database-01.md](database-01.md).                                                                    |
| **Verify**     | `docker ps` shows `mariadb`; clients use host `.21` port `3306` with MySQL protocol                                                                             |

---

## REF-020: Infisical bind `:80` conflicts with NPM

| Field          | Detail                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                                                        |
| **When**       | First `ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml` on `docker-01`                                                                              |
| **Symptom**    | Handler `Restart Infisical stack` fails: `Bind for 0.0.0.0:80 failed: port is already allocated`                                                                 |
| **Root cause** | Playbook installs **NPM first** (`roles/npm`), which publishes **`:80` / `:443` / `:81`**. Infisical defaults used `infisical_http_port: 80` and `SITE_URL=http://192.168.68.22`, so Compose tried to map `80:8080` on the same host. |
| **Debug**      | See [Debug: Infisical port conflict](#debug-infisical-port-conflict) below                                                                                      |
| **Fix**        | `roles/infisical/defaults/main.yml`: host port **`8090`**, `infisical_site_url` includes `:8090`. Removed obsolete Compose `version:` key. Docs updated (`infisical.md`, runbooks). |
| **Prevention** | On `docker-01`, only NPM binds `:80`/`:443`. App stacks use dedicated LAN ports (Keycloak `8080`, Infisical `8090`, …) and optionally NPM Proxy Host later.     |
| **Verify**     | `curl -fsS -o /dev/null -w '%{http_code}\n' http://192.168.68.22:8090/api/status` → `200`; `docker ps` shows `npm` on 80/443 and `infisical-backend` on 8090     |

### Debug: Infisical port conflict

```bash
# On docker-01 (.22)
sudo ss -lntp | grep -E ':80|:8090|:8080'
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep -E 'npm|infisical|PORTS'

# Expect NPM on 80/443/81; Infisical must NOT claim 80
sudo grep -n 'ports\|8090\|80:' /opt/infisical/docker-compose.yml
```

---

## REF-021: it-tools image tag 404

| Field          | Detail                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                                                        |
| **When**       | Same `docker-hosts.yml` run, after Infisical/Keycloak                                                                                                           |
| **Symptom**    | `TASK [it_tools : Start it-tools]` → `ghcr.io/corentinth/it-tools:2024.10.22-1ebf63c: not found`                                                                 |
| **Root cause** | Role pinned a **non-existent** digest tag (`…-1ebf63c`). Published 2024-10-22 release is `2024.10.22-7ca5933` (see GitHub release `v2024.10.22-7ca5933`).         |
| **Debug**      | `docker pull ghcr.io/corentinth/it-tools:2024.10.22-1ebf63c` → not found; check [releases](https://github.com/CorentinTh/it-tools/releases) for the real tag.     |
| **Fix**        | `roles/it_tools/defaults/main.yml` → `ghcr.io/corentinth/it-tools:2024.10.22-7ca5933`                                                                            |
| **Prevention** | Pin only tags listed on the release page / GHCR; avoid copy-paste of wrong short hashes.                                                                        |
| **Verify**     | `docker compose -f /opt/it-tools/compose.yaml up -d` succeeds; UI on `http://192.168.68.22:1000`                                                                 |

---

## REF-022: Keycloak + PgCat prepared statements

| Field          | Detail                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                                                        |
| **When**       | After `docker-hosts.yml` starts Keycloak against PgCat (`192.168.68.21:6432`)                                                                                    |
| **Symptom**    | Keycloak crash-loop; logs: `ERROR: prepared statement "S_1" does not exist` (Liquibase / Quarkus Agroal)                                                        |
| **Root cause** | PgCat pool `keycloak` was **`transaction`** mode. Keycloak uses server-side prepared statements; transaction pooling does not keep them across checkouts. Same class of issue that already forced SonarQube to **session** mode. |
| **Debug**      | `sudo docker logs keycloak --tail 50` → PSQLException prepared statement; `grep pool_mode /opt/postgres/pgcat.toml` under `[pools.keycloak]`.                     |
| **Fix**        | `pgcat.toml.j2`: `pools.keycloak.pool_mode = "session"`. Keycloak JDBC: `?prepareThreshold=0`. After crash-loops, **recreate** an empty `keycloak` DB (`DROP DATABASE` / `CREATE DATABASE` as **separate** `psql -c` statements — multi-statement drops fail inside a transaction block), restart PgCat, then start Keycloak once. |
| **Prevention** | ORMs / Liquibase / Hibernate apps behind PgCat → prefer **session** pools. Do not leave Keycloak restarting against a half-migrated schema. |
| **Verify**     | `docker ps` Keycloak Up (not restarting); `curl -o /dev/null -w '%{http_code}\n' http://192.168.68.22:8080/` → `200`/`302`                                       |

---

## REF-023: `guest_common` apt on Fedora podman-01

| Field          | Detail                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                               |
| **When**       | `ansible-playbook playbooks/podman-host.yml` after factory-reset                                                                       |
| **Symptom**    | (1) `guest_common : Install base packages` fails: `No such file or directory: b'update'` after “auto-installing … python3-apt”. (2) After packages install, LAN curl to Caddy `:80` times out; on-host curl works. |
| **Root cause** | (1) `podman-01` is **Fedora Cloud** by design (`terraform.tfvars` image `fedora-cloud`). `guest_common` only used `ansible.builtin.apt`. (2) Podman netavark DNATs `:80` → container bridge; UFW **FORWARD/routed** default was `DROP`, so `[UFW BLOCK] IN=eth0 OUT=podman1 … DPT=80`. |
| **Debug**      | `ansible podman-01 -m setup -a 'filter=ansible_distribution*'` → Fedora; `journalctl -k \| grep UFW BLOCK` shows eth0→podman1; `nft list ruleset` shows netavark `HOSTPORT-DNAT`. |
| **Fix**        | `guest_common`: `apt` vs `dnf` by `ansible_facts['os_family']` (`dnsutils`→`bind-utils`; skip Debian unattended-upgrades; `iptables-nft`). `guest_ufw_forward_policy` (default `deny`); `podman-01` host_vars → `allow`. If UFW half-broken: `sudo ufw --force reset` then re-run. |
| **Prevention** | Do not assume all guests are Debian. Container hosts that publish ports need UFW **routed/FORWARD** allow (or host networking). |
| **Verify**     | `ansible-playbook playbooks/podman-host.yml` ok; `curl http://192.168.68.23/` → `podman-01 caddy OK`. |

---

## REF-024: chrony on unprivileged LXC (dockhand)

| Field          | Detail                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                               |
| **When**       | `ansible-playbook playbooks/dockhand.yml` after factory-reset                                                                          |
| **Symptom**    | `guest_common : Enable chrony` fails: `Job for chrony.service failed`                                                                  |
| **Root cause** | `dockhand` is an **unprivileged** Debian 13 LXC (`terraform.tfvars` `unprivileged = true`). chronyd needs `adjtimex` / CAP_SYS_TIME; kernel returns `Operation not permitted`. Time is owned by the Proxmox host. |
| **Debug**      | `journalctl -xeu chrony.service` → `Fatal error : adjtimex(0x8001) failed : Operation not permitted`; `systemd-detect-virt` → `lxc`.   |
| **Fix**        | `guest_common`: set `guest_is_container` from `virtualization_type`; skip chrony / qemu-guest-agent install+enable on containers; stop/disable chrony if already present. |
| **Prevention** | Do not run host NTP clients inside unprivileged CTs. Sync time on PVE only.                                                            |
| **Verify**     | `ansible-playbook playbooks/dockhand.yml` completes past `guest_common`.                                                               |

---

## REF-025: Dockhand GHCR image pull denied

| Field          | Detail                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                        |
| **When**       | `dockhand.yml` after guest_common (REF-024)                                                                                     |
| **Symptom**    | `docker compose up` fails: `ghcr.io/finsys/dockhand:0.7.0` → `error from registry: denied`                                      |
| **Root cause** | Upstream moved the public image to Docker Hub `fnsys/dockhand` (see dockhand.pro / quickstart). Old GHCR path is denied/private. |
| **Fix**        | `roles/dockhand/defaults/main.yml`: `dockhand_image: "fnsys/dockhand:v1.0.38"`                                                  |
| **Prevention** | Pin Hub tags from [dockhand.pro](https://dockhand.pro/); do not assume old GHCR refs stay public.                               |
| **Verify**     | `curl -o /dev/null -w '%{http_code}\n' http://192.168.68.24:3000/` → `200`/`302`                                                |

---

## REF-026: Kibana forbids `elastic` superuser (502 on public URL)

| Field          | Detail                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                               |
| **When**       | Testing `https://kibana.nasraldin.com` after stack deploy                                                                              |
| **Symptom**    | Cloudflare **502 Bad Gateway**; LAN `:5601` also down; `kibana` container **Restarting (78)**                                          |
| **Root cause** | Compose set `ELASTICSEARCH_USERNAME=elastic`. Kibana **8.x** rejects the superuser for its ES client (`username "elastic" is forbidden`). Tunnel was fine — origin was crash-looping. |
| **Debug**      | `docker logs kibana` → FATAL config validation; use `kibana_system` + set password via `POST /_security/user/kibana_system/_password`. |
| **Fix**        | `roles/elastic`: Kibana env uses `kibana_system` + `vault_kibana_system_password`; Ansible sets that password after ES is healthy, then starts Kibana. |
| **Prevention** | Never point Kibana at `elastic` in 8.x compose. UI login remains user `elastic` / `vault_elastic_password`.                            |
| **Verify**     | `curl http://192.168.68.27:5601/login` and `https://kibana.nasraldin.com/login` → `200`.                                                |

---

## REF-027: SonarQube skip-upgrade path (25.6 → 26.7)

| Field          | Detail                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                               |
| **When**       | Bumping pinned image from `25.6.0.109173-community` to `26.7.0.124771-community`                                                       |
| **Symptom**    | (1) Direct jump: `The version of SonarQube you are trying to upgrade from is too old. Please upgrade to the 25.12 version first.` (2) After failed 26.7 start, rolling back to 25.12: embedded ES `cannot downgrade a node from version [8.19.16] to [8.16.6]`. |
| **Root cause** | Sonar enforces **mandatory upgrade steps**. A failed jump still upgrades on-disk embedded ES data under the `sonarqube_data` volume.   |
| **Fix**        | Wipe only `/data/es*` in the Sonar data volume → start **25.12.0.117093-community** → `POST /api/system/migrate_db` until `UP` → pin **26.7.0.124771-community** → migrate again. Fresh empty DB can go straight to 26.7. |
| **Prevention** | Keep `sonarqube_image` pinned; when bumping across intermediates, stage them. Documented in `roles/sonarqube/defaults/main.yml` + [sonarqube.md](sonarqube.md). |
| **Verify**     | `curl http://192.168.68.26:9000/api/system/status` → `"version":"26.7.0.124771","status":"UP"`; banner gone after refresh.              |

---

## REF-028: Prometheus/Loki config permission denied

| Field          | Detail                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                               |
| **When**       | Acceptance probe after `monitoring.yml` — Grafana up; Prometheus/Loki crash-loop                                                       |
| **Symptom**    | `open /etc/prometheus/prometheus.yml: permission denied` / Loki same for `loki-config.yml`                                             |
| **Root cause** | Bind-mounted configs were `0640` under `0750` dirs owned by root; images run as `nobody` and could not read mounts.                    |
| **Fix**        | Role `monitoring`: dirs `0755`, config files `0644`; recreate compose stack. Live: `chmod` + `docker compose up -d --force-recreate`.   |
| **Prevention** | Keep monitoring config world-readable (no secrets in those YAML files; Grafana admin password stays in compose env).                   |
| **Verify**     | `curl http://192.168.68.25:9090/-/healthy` and `:3100/ready` → `200`.                                                                  |

---

## REF-029: node_exporter blocked by UFW

| Field          | Detail                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | resolved                                                                                                                               |
| **When**       | Prometheus targets after monitoring stack healthy — most `job=node` **down**                                                           |
| **Symptom**    | `node_exporter` listening on `:9100` locally; scrapes from `monitoring-01` time out                                                    |
| **Root cause** | `observability_agent` installed exporters but never opened UFW. Self-scrape of `.25` also failed: compose bridge source is not `lab_cidr`. |
| **Fix**        | `observability_agent` adds UFW allow `9100` from `lab_cidr`; `monitoring-01` also allows `172.16.0.0/12` for Docker→host self-scrape. `guest_common` applies extra rules with `from_ip: lab_cidr`. |
| **Prevention** | Any new exporter port must be in UFW (host_vars or role) before calling scrape targets green.                                          |
| **Verify**     | Prometheus `/api/v1/targets` → all `job=node` **up** (26/26 including self).                                                           |

---

## Refresh timeline (condensed)

| Phase | What happened                                                                           |
| ----- | --------------------------------------------------------------------------------------- |
| 1     | Factory-reset on `pve01` (guests + lab storage/ZFS); users/tokens + backups kept        |
| 2     | Residual GPT blocked `data01` recreate → wipe residual / adopt `--wipe-stale-zfs-disks` |
| 3     | Empty TF state hit OpsHub “already exists” → `adopt-existing.sh`                        |
| 4     | `terraform apply` → VMs 110–123 + CT 200 up                                             |
| 5     | SSH to guests failed (host key changed) → clear known_hosts (now scripted)              |
| 6     | `dns.yml` → `infra.yml` → object-storage (Vault init flags fixed) → GitLab              |
| 7     | Migrated apt repos to deb822; documented runbook + this tracker                         |
| 8     | GitLab LE half-config (REF-014); Vault audit SIGPIPE (REF-015); runner LAN URL (REF-016) |
| 9     | `database.yml`: Postgres 18 mount + init perms (REF-017); MariaDB expected (REF-019)   |
| 10    | Public GitLab still 530 until Tunnel bootstrap (REF-018)                                |
| 11    | `docker-hosts.yml`: Infisical `:80` vs NPM → move to `:8090` (REF-020)                  |
| 12    | it-tools bad image tag → `2024.10.22-7ca5933` (REF-021)                                 |
| 13    | Keycloak + PgCat transaction mode → session (REF-022)                                  |
| 14    | `podman-host.yml`: Fedora guest vs apt-only `guest_common` (REF-023)                   |
| 15    | `dockhand.yml`: chrony adjtimex denied on unprivileged LXC (REF-024)                   |
| 16    | Dockhand image GHCR denied → `fnsys/dockhand:v1.0.38` (REF-025)                        |
| 17    | Kibana crash-loop: forbids `elastic` user → `kibana_system` (REF-026)                  |
| 18    | Sonar 25.6→26.7 needs intermediate 25.12 + ES wipe (REF-027)                           |
| 19    | Monitoring: config `0640` → Prometheus/Loki crash (REF-028); node_exporter UFW (REF-029) |
| 20    | Acceptance 2026-07-26: core hosts redesign proven; public Tunnel URLs green            |

---

## Adding a new REF entry

1. Assign next `REF-NNN`.
2. Fill Status / When / Symptom / Root cause / Fix / Prevention / Verify.
3. Add a **Debug** subsection with exact commands when the failure is `no_log`-censored or buried in compose pull noise.
4. Link any script or task path that encodes the fix.
5. Mention the ID in the runbook checklist note if it changes procedure order.
