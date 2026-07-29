# First-time lab runbook (fresh Proxmox → day-one core hosts)

> **Inventory:** Steps below follow the **terraform-lab** multi-VM design.
> For the live **Dev Homelab** (`lab-home-k8s`), use
> [lab-home-inventory.md](lab-home-inventory.md) and
> `lab-home-k8s/docs/runbook/e2e-reset-checklist.md`.

Use this after a **new Proxmox VE install on `pve01`** (empty guests, clean
`rpool`). It covers host bootstrap → Terraform → Ansible → Tunnel.

| Situation                                          | Doc                                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **This page** — new ISO install, no lab guests yet | You are here                                                                                                |
| Existing node; wipe guests / `data01` and rebuild  | [lab-refresh-runbook.md](lab-refresh-runbook.md)                                                            |
| Installer choices / why                            | [proxmox-bootstrap 01-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/01-install.md) |
| Host bootstrap detail                              | [proxmox-bootstrap 06-runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md) |
| Locked inventory                                   | [2026-07-25 design](../superpowers/specs/2026-07-25-core-container-hosts-design.md)                         |
| VMID / IP map                                      | [guest-vmid-map.md](guest-vmid-map.md)                                                                      |
| Pass/fail gates                                    | [core-hosts-acceptance.md](core-hosts-acceptance.md)                                                        |

**Ownership (do not mix):**

```text
proxmox-bootstrap   host only (repos, SSH, ZFS, terraform@pve token)
terraform-lab       guests, storage, backups (SoT: terraform.tfvars)
ansible-lab         guest OS + apps
cloudflare-tunnel   public hostnames (gitlab / sonar / kibana / docker)
```

---

## Goal (what “done” means)

1. `pve01` reachable: `ssh pve01` → key login, UI on `:8006`.
2. `qm list` / `pct list` = VMs **110–123** + CT **200** (no `infisical-01` / `runner-02`).
3. Spine + platform hosts healthy per § Acceptance.
4. Tunnel serves GitLab / Sonar / Kibana / Dockhand per design.

---

## Master checklist

### 0. Before the ISO (only if reinstalling)

If the installer still offers **“prefix with old”** for `rpool`, partitions were
deleted but **ZFS labels remain**. From Fedora live (or installer shell):

```bash
lsblk -o NAME,SIZE,MODEL,SERIAL   # pick Samsung ~2 TB by model — not by nvme0n1 alone
sudo wipefs -a /dev/nvmeXn1
sudo sgdisk --zap-all /dev/nvmeXn1
sudo dd if=/dev/zero of=/dev/nvmeXn1 bs=1M count=64
BYTES=$(sudo blockdev --getsize64 /dev/nvmeXn1)
sudo dd if=/dev/zero of=/dev/nvmeXn1 bs=1M seek=$((BYTES/1024/1024 - 64)) count=64
```

Optional: same on Kingston if you want a clean `data01` later.

---

### 1. Proxmox ISO install

| Setting              | Value                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| Target disk          | **Samsung 990 PRO 2 TB** — select by **model/serial**, never assume `/dev/nvme0n1` |
| Filesystem           | ZFS (single disk / RAID0)                                                          |
| ashift / compression | `12` / `lz4` (defaults)                                                            |
| Swap                 | ~8 GB                                                                              |
| Hostname / FQDN      | `pve01` / `pve01.lab.nasraldin.com`                                                |
| IP                   | `192.168.68.13/22`, gateway `192.168.68.1`                                         |
| DNS (bootstrap)      | `1.1.1.1` (AdGuard `.10` comes later)                                              |
| Timezone             | `Asia/Dubai`                                                                       |
| Root password        | Long random → password manager                                                     |

On the console after first boot:

```bash
pveversion                 # pve-manager/9.2.x (or current 9.x)
hostname -f                # pve01.lab.nasraldin.com
ip -4 addr show vmbr0      # 192.168.68.13/22
zpool status               # rpool ONLINE — **one** Samsung member
zpool list                 # rpool ~1.8–2T — if ~4T or two disks → **reinstall** before anything else
```

- [ ] Single-disk `rpool` verified
- [ ] Web UI: `https://192.168.68.13:8006` (accept self-signed cert)

**Do not create VMs in the UI.** Terraform owns guests.

---

### 2. Mac prepare + host bootstrap (`proxmox-bootstrap`)

```bash
cd ~/homelab && ./clone-labs.sh --pull
cd ~/homelab/proxmox-bootstrap
cp -n config.env.example config.env   # set NOTIFY_EMAIL; verify ADMIN_USER
```

Local secrets (never commit):

| File                                    | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `proxmox-bootstrap/config.env`          | Host bootstrap                                         |
| `terraform-lab/credentials.auto.tfvars` | PVE API token (filled after bootstrap)                 |
| `ansible-lab/secrets.yml`               | From `secrets.example.yml` — fill **all** day-one keys |
| `cloudflare-tunnel/config.env`          | Tunnel bootstrap (token at apply time only)            |

```bash
# Mac → node SSH + hosts entry
ssh-add ~/.ssh/pve01          # create key on first run via prompts
./mac/bootstrap.sh --check
./mac/bootstrap.sh            # y to key, /etc/hosts, ssh-copy-id, ssh config alias

ssh pve01 hostname -f         # → pve01.lab.nasraldin.com (no password)

# Node-side: repos, packages, ZFS, admin user, terraform@pve token
./mac/bootstrap.sh --remote --check
./mac/bootstrap.sh --remote --yes
```

When the **terraform API token** is printed once: store in the password manager
and put it in `terraform-lab/credentials.auto.tfvars`.

If the report says reboot required (kernel / ARC):

```bash
ssh pve01 reboot
# wait, then:
./mac/bootstrap.sh --remote --check   # expect all OK
```

Optional first pass: keep password SSH until `ssh pve01` works, then re-run
remote bootstrap and disable password auth.

- [ ] `ssh pve01` key-only works
- [ ] Token saved offline + in `credentials.auto.tfvars`
- [ ] Router **Secondary DNS = `1.1.1.1`** ([lan-dns-resilience](lan-dns-resilience.md))

---

### 3. Terraform (create inventory)

```bash
cd ~/homelab/terraform-lab
# Confirm terraform.tfvars: VMs 110–123 + CT dockhand 200
# No infisical-01 / runner-02

# First apply imports built-in `local` storage, enables snippets+import, and
# creates /var/lib/vz/snippets (local-storage.tf). No manual pvesm needed.
# Requires SSH agent: ssh-add ~/.ssh/pve01

terraform init && terraform validate
terraform plan -out=tfplan    # review cores/RAM/disk; oversubscription is intentional
terraform apply tfplan && rm -f tfplan

ssh pve01 'qm list; pct list'
ssh pve01 'pvesm status; test -d /var/lib/vz/snippets && echo snippets_ok'
```

| VMID | Name          | IP  |
| ---- | ------------- | --- |
| 110  | adguard-01    | .10 |
| 111  | technitium-01 | .11 |
| 112  | infra01       | .12 |
| 113  | vault-01      | .18 |
| 114  | vault-seal    | .19 |
| 115  | aistor-01     | .17 |
| 116  | gitlab-01     | .14 |
| 117  | runner-01     | .15 |
| 118  | database-01   | .21 |
| 119  | docker-01     | .22 |
| 120  | podman-01     | .23 |
| 121  | monitoring-01 | .25 |
| 122  | sonarqube-01  | .26 |
| 123  | elastic-01    | .27 |
| 200  | dockhand (CT) | .24 |

If `data01` create fails with “device already in use”:

```bash
./scripts/adopt-existing.sh --wipe-stale-zfs-disks
# then re-plan / apply
```

- [ ] Guests match map above

---

### 4. SSH known_hosts (required after first boot)

Cloud-init mints new host keys.

```bash
cd ~/homelab/ansible-lab
./scripts/refresh-ssh-known-hosts.sh --check
./scripts/refresh-ssh-known-hosts.sh
./scripts/refresh-ssh-known-hosts.sh --accept-new

ssh -o BatchMode=yes nasr@192.168.68.12 hostname   # → infra01
ansible all -m ping                                  # all pong (wait for cloud-init if needed)
```

- [ ] Ping all green

---

### 5. Ansible (order matters)

```bash
cd ~/homelab/ansible-lab

# 1) DNS spine
ansible-playbook playbooks/dns.yml -e @secrets.yml
./scripts/dns-restore-adguard.sh   # Mac DNS → AdGuard .10

# 2) Operator jump
ansible-playbook playbooks/infra.yml

# 3) Vault seal → Vault primary → AIStor
ansible-playbook playbooks/object-storage.yml -e @secrets.yml
# Offline copy /root/vault-init.json from vault-seal (.19) and vault-01 (.18)

# 4) GitLab + runner
ansible-playbook playbooks/gitlab.yml -e @secrets.yml

# 5) Central DB (before apps that use PgCat)
ansible-playbook playbooks/database.yml -e @secrets.yml

# 6) Docker apps (NPM, Infisical→PgCat, Keycloak→PgCat, …)
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml

# 7) Quality / search / observability / podman / dockhand
ansible-playbook playbooks/sonarqube.yml -e @secrets.yml
ansible-playbook playbooks/elastic.yml -e @secrets.yml
ansible-playbook playbooks/monitoring.yml -e @secrets.yml
ansible-playbook playbooks/podman-host.yml
ansible-playbook playbooks/dockhand.yml
```

| Tick | Check                                                                 |
| ---- | --------------------------------------------------------------------- |
| [ ]  | `dig @192.168.68.11 pve01.lab.nasraldin.com +short` → `192.168.68.13` |
| [ ]  | `ssh nasr@192.168.68.18 'sudo vault status'` → Sealed `false`         |
| [ ]  | `curl -fsS http://192.168.68.17:9000/minio/health/live` → 200         |
| [ ]  | `nc -vz 192.168.68.21 6432` → PgCat up                                |
| [ ]  | Infisical `http://192.168.68.22:8090/api/status` healthy              |
| [ ]  | Sonar LAN `:9000`, Elastic `:9200`, Grafana `:3000`, Dockhand `:3000` |

---

### 6. Cloudflare Tunnel

```bash
cd ~/homelab/cloudflare-tunnel
export CLOUDFLARE_API_TOKEN='…'   # password manager; never commit
./mac/bootstrap.sh --check
./mac/bootstrap.sh --yes
bash tests/test_ingress.sh
unset CLOUDFLARE_API_TOKEN
```

- [ ] `https://gitlab.nasraldin.com` — login (**no** Access)
- [ ] `https://sonar.nasraldin.com` — (**no** Access)
- [ ] `https://kibana.nasraldin.com` — (**no** Access)
- [ ] `https://docker.nasraldin.com` — Access OTP → Dockhand `:3000`

---

### 7. Acceptance

Complete [core-hosts-acceptance.md](core-hosts-acceptance.md). Only then flip
⏳ → ✅ in [current-state.md](../current-state.md).

---

## Secrets (`ansible-lab/secrets.yml`)

Copy `secrets.example.yml`; replace every `replace-with-*`. Day-one minimum:

| Group                                      | Purpose                |
| ------------------------------------------ | ---------------------- |
| AdGuard / Technitium                       | DNS UIs                |
| AIStor + GitLab S3                         | Object store           |
| GitLab root                                | Omnibus                |
| Postgres / PgAdmin / Redis / MariaDB       | `database-01`          |
| Keycloak / Infisical / Sonar DB            | Via PgCat              |
| Infisical `ENCRYPTION_KEY` / `AUTH_SECRET` | Offline backup         |
| Elastic / Kibana / Grafana                 | Search + observability |

```bash
python3 -c 'import yaml; d=yaml.safe_load(open("secrets.yml")); assert "vault_postgres_password" in d'
```

---

## Resource note

Guest RAM in `terraform.tfvars` **exceeds** physical RAM — intentional lab
oversubscription (ballooning). Do not shrink day-one sizes without updating the
design spec.

---

## What not to do

| Anti-pattern                                          | Why                           |
| ----------------------------------------------------- | ----------------------------- |
| Create guests in PVE UI                               | Drift vs Terraform SoT        |
| Apply Infisical before `database.yml`                 | Needs PgCat `.21:6432`        |
| Postgres on docker-01 / sonar VM                      | Violates central-DB design    |
| Access on GitLab / Sonar / Kibana                     | Design: app auth only         |
| Skip known_hosts after first boot                     | SSH/Ansible failures          |
| Commit `secrets.yml` / `vault-init.json` / API tokens | Offline password manager only |
| Pick install disk by `/dev/nvme0n1` only              | Wrong disk can wipe Kingston  |
