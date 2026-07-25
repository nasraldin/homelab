# Lab refresh runbook (factory-reset → Terraform → Ansible)

Single checklist for a **full lab rebuild** on an existing Proxmox node (`pve01`)
after the **core container hosts** redesign (VMIDs **110–123** + CT **200**).

| Related | Role |
| ------- | ---- |
| [first-time-lab-runbook.md](first-time-lab-runbook.md) | Greenfield (no wipe) |
| [deploy-and-rebuild.md](deploy-and-rebuild.md) | Incremental / day-1 order |
| [Factory-reset](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/14-factory-reset.md) | What wipe destroys / protects |
| [lab-refresh-issues.md](lab-refresh-issues.md) | Symptom → cause → fix |
| [guest-vmid-map.md](guest-vmid-map.md) | VMID / IP / boot order |
| [core-hosts-acceptance.md](core-hosts-acceptance.md) | Final pass/fail gates |
| [lan-dns-resilience.md](lan-dns-resilience.md) | DNS failover while AdGuard is down |

**Ownership (do not mix):**

```text
proxmox-bootstrap   host wipe, timers, residual GPT after zpool destroy
terraform-lab       guests, storage, backups, OpsHub adopt
ansible-lab         guest OS + apps; SSH known_hosts refresh
cloudflare-tunnel   public hostnames (gitlab/sonar/kibana/docker)
```

**Removed from inventory:** `infisical-01` (Infisical on `docker-01`), `runner-02`
(fleeting workers; manager stays `runner-01`).

---

## Master checklist

### A. Prepare (Mac)

- [ ] `./clone-labs.sh --pull` (or pull each lab repo)
- [ ] `ssh-add ~/.ssh/pve01` — `ssh root@192.168.68.13 hostname` works
- [ ] Off-LAN: use [infra01-remote-access.md](infra01-remote-access.md) — do not assume LAN IPs from the internet
- [ ] Secrets present: `proxmox-bootstrap/config.env`, `terraform-lab/credentials.auto.tfvars`, `ansible-lab/secrets.yml` (all redesign keys — see `secrets.example.yml`)
- [ ] Pin Mac DNS to public resolvers before wiping DNS VMs:  
      `ansible-lab/scripts/dns-failover-public.sh`
- [ ] Confirm router **Secondary DNS = `1.1.1.1`**
- [ ] Decide backups: **kept by default**. Only wipe vzdump with `--include-backups` / `--only backups` if intended
- [ ] Decide tokens: **OpsHub / terraform tokens kept by default**. Only `--include-tokens` if recreating them

### B. Factory-reset (proxmox-bootstrap)

- [ ] `cd ~/homelab/proxmox-bootstrap`
- [ ] `./mac/factory-reset-lab.sh --check` — read the plan (old guests including `infisical-01` / `runner-02` will be destroyed)
- [ ] `./mac/factory-reset-lab.sh --yes --i-understand-destroy`
- [ ] Node check: `qm list` empty of lab VMs; `zpool list` has `rpool` (no leftover `data01` unless kept)

### C. Adopt leftovers + Terraform (terraform-lab)

- [ ] `cd ~/homelab/terraform-lab`
- [ ] Reconcile state (empty for full rebuild, or `state rm` destroyed guests)
- [ ] `./scripts/adopt-existing.sh --check` then `./scripts/adopt-existing.sh`
- [ ] If ZFS create fails “device already in use”:  
      `./scripts/adopt-existing.sh --wipe-stale-zfs-disks`
- [ ] `terraform init && terraform validate`
- [ ] `terraform plan -out=tfplan` → review → `terraform apply tfplan` → `rm -f tfplan`
- [ ] Confirm VMs **110–123** + CT **200** running (`qm list` / `pct list`) — **not** 110–119 only

### D. SSH host keys (required after wipe + apply)

```bash
cd ~/homelab/ansible-lab
./scripts/refresh-ssh-known-hosts.sh --check
./scripts/refresh-ssh-known-hosts.sh
./scripts/refresh-ssh-known-hosts.sh --accept-new
ssh -o BatchMode=yes nasr@192.168.68.12 hostname   # expect infra01
```

### E. Ansible (guest config — order matters)

```bash
cd ~/homelab/ansible-lab
ansible all -m ping

ansible-playbook playbooks/dns.yml -e @secrets.yml
./scripts/dns-restore-adguard.sh

ansible-playbook playbooks/infra.yml
ansible-playbook playbooks/object-storage.yml -e @secrets.yml
# Offline backup of vault-init.json (seal .19 + primary .18)

ansible-playbook playbooks/gitlab.yml -e @secrets.yml
ansible-playbook playbooks/database.yml -e @secrets.yml
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml
ansible-playbook playbooks/sonarqube.yml -e @secrets.yml
ansible-playbook playbooks/elastic.yml -e @secrets.yml
ansible-playbook playbooks/monitoring.yml -e @secrets.yml
ansible-playbook playbooks/podman-host.yml
ansible-playbook playbooks/dockhand.yml
```

Prefer **`docker-hosts.yml`** over standalone `infisical.yml` (Infisical is on `docker-01`).

### F. Tunnel + acceptance

```bash
cd ~/homelab/cloudflare-tunnel
export CLOUDFLARE_API_TOKEN='…'
./mac/bootstrap.sh --yes
bash tests/test_ingress.sh
unset CLOUDFLARE_API_TOKEN
```

- [ ] UI checklist below + [core-hosts-acceptance.md](core-hosts-acceptance.md)
- [ ] Only then: [dns-dhcp-cutover.md](dns-dhcp-cutover.md) if DHCP was pointed away

---

## UI checklist (URLs · user · password)

Passwords live in `~/homelab/ansible-lab/secrets.yml` (gitignored) unless noted.

| Service | URL | Username | Password / how to get it | Tick |
| ------- | --- | -------- | ------------------------ | ---- |
| **Proxmox UI (LAN)** | `https://192.168.68.13:8006` | `root` (`pam`) | Host root (password manager) | [ ] |
| **Proxmox UI (remote)** | `https://homelab.nasraldin.com` | same | Access OTP → Proxmox | [ ] |
| **AdGuard Home** | `http://192.168.68.10:3000` | `admin` | `vault_adguard_admin_password` | [ ] |
| **Technitium DNS** | `http://192.168.68.11:5380` | `admin` | `vault_technitium_admin_password` | [ ] |
| **Vault primary UI** | `http://192.168.68.18:8200` | *(token)* | `/root/vault-init.json` `root_token` on `vault-01` | [ ] |
| **Vault seal helper** | `http://192.168.68.19:8200` | — | UI disabled; Shamir keys on seal | [ ] |
| **AIStor console** | `http://192.168.68.17:9001` | `vault_aistor_root_user` | `vault_aistor_root_password` | [ ] |
| **AIStor S3 API** | `http://192.168.68.17:9000` | — | `curl …/minio/health/live` → 200 | [ ] |
| **GitLab** | `https://gitlab.nasraldin.com` | `root` | `vault_gitlab_root_password` | [ ] |
| **GitLab registry** | `https://gregistry.nasraldin.com` | GitLab user | Same GitLab account / deploy token | [ ] |
| **PgAdmin** | `http://192.168.68.21:5433` | `vault_pgadmin_email` | `vault_pgadmin_password` | [ ] |
| **phpMyAdmin** | `http://192.168.68.21:3366` | `root` | `vault_mariadb_root_password` | [ ] |
| **NPM admin** | `http://192.168.68.22:81` | *first signup* | NPM creates admin on first visit | [ ] |
| **Infisical** | `http://192.168.68.22` | *first signup* | Stack keys ≠ UI login; create admin in browser | [ ] |
| **Keycloak** | `http://192.168.68.22:8080` | `vault_keycloak_admin_user` | `vault_keycloak_admin_password` | [ ] |
| **it-tools** | via NPM / LAN port per host_vars | — | Smoke-load UI | [ ] |
| **Mailpit** | via NPM / LAN port per host_vars | — | UI shows empty inbox | [ ] |
| **SonarQube** | `https://sonar.nasraldin.com` | `admin` | Default `admin` then force change; **no** Access | [ ] |
| **Kibana** | `https://kibana.nasraldin.com` | `elastic` | `vault_elastic_password`; **no** Access | [ ] |
| **Grafana** | `http://192.168.68.25:3000` | `admin` | `vault_grafana_admin_password` | [ ] |
| **Dockhand** | `https://docker.nasraldin.com` | — | Access OTP → `:3000` | [ ] |

### Secrets quick reference

| Key | Used for |
| --- | -------- |
| `vault_adguard_admin_password` / `vault_technitium_admin_password` | DNS UIs |
| `vault_aistor_root_*` / `vault_gitlab_s3_*` | AIStor + GitLab object store |
| `vault_gitlab_root_password` | GitLab `root` |
| `vault_postgres_password` / `vault_pgadmin_*` / `vault_redis_password` / `vault_mariadb_root_password` | `database-01` |
| `vault_keycloak_db_password` / `vault_infisical_postgres_password` / `vault_sonarqube_db_password` | App DBs via PgCat |
| `vault_infisical_encryption_key` / `vault_infisical_auth_secret` | Infisical crypto (not UI login) |
| `vault_keycloak_admin_*` | Keycloak UI |
| `vault_elastic_password` / `vault_kibana_system_password` | Elastic stack |
| `vault_grafana_admin_password` | Grafana |

```bash
python3 -c 'import yaml; print(yaml.safe_load(open("secrets.yml"))["vault_gitlab_root_password"])'
```

### Not a browser UI (SSH / health)

| Guest | Check |
| ----- | ----- |
| `infra01` `.12` | `ssh nasr@192.168.68.12` · remote: `ssh infra01` |
| `runner-01` `.15` | GitLab → **Admin → Runners** (green); fleeting scaffold until API wired |
| `podman-01` `.23` | `curl -fsS http://192.168.68.23/` (Caddy) |
| `elastic-01` `.27:9200` | LAN-only; not Tunnel-public |
| `pve01` `.13` | `ssh root@192.168.68.13` |

---

## Detailed procedure

### 1. Control plane

```bash
cd ~/homelab
./clone-labs.sh --pull
ssh-add ~/.ssh/pve01
ssh root@192.168.68.13 'hostname; pveversion | head -1'
```

### 2. DNS safety before wipe

```bash
cd ~/homelab/ansible-lab
./scripts/dns-failover-public.sh
```

**Expected:** Mac DNS resolvers include `1.1.1.1` / `1.0.0.1`; browsing still works while AdGuard is down.

### 3. Wipe lab objects on Proxmox

```bash
cd ~/homelab/proxmox-bootstrap
./mac/factory-reset-lab.sh --check
./mac/factory-reset-lab.sh --yes --i-understand-destroy
```

**Expected:** Plan lists current QEMU VMs (old map may still show `infisical-01` / `runner-02`); after destroy, `qm list` empty of those VMIDs.

### 4. Adopt kept identity + apply Terraform

```bash
cd ~/homelab/terraform-lab
./scripts/adopt-existing.sh --check
./scripts/adopt-existing.sh

terraform init
terraform plan -out=tfplan
terraform apply tfplan
rm -f tfplan

ssh root@192.168.68.13 'qm list; pct list'
```

**Expected:** Names/IPs match the table in [first-time-lab-runbook.md](first-time-lab-runbook.md) § B.  
**Fail if:** still see `infisical-01` or `runner-02`, or missing `database-01` / `docker-01` / `elastic-01` / `dockhand`.

### 5. Refresh SSH known_hosts

```bash
cd ~/homelab/ansible-lab
./scripts/refresh-ssh-known-hosts.sh --check
./scripts/refresh-ssh-known-hosts.sh
./scripts/refresh-ssh-known-hosts.sh --accept-new
```

| Flag | Effect |
| ---- | ------ |
| `--check` | Dry-run only |
| (none) | Remove stale IP entries |
| `--accept-new` | `ssh-keyscan -H` re-learns keys |
| `--ips 10,11,12,21,22` | Limit last octets |

### 6. Configure guests

```bash
cd ~/homelab/ansible-lab
ansible all -m ping

ansible-playbook playbooks/dns.yml -e @secrets.yml
./scripts/dns-restore-adguard.sh

ansible-playbook playbooks/infra.yml
ansible-playbook playbooks/object-storage.yml -e @secrets.yml
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
ansible-playbook playbooks/database.yml -e @secrets.yml
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml
ansible-playbook playbooks/sonarqube.yml -e @secrets.yml
ansible-playbook playbooks/elastic.yml -e @secrets.yml
ansible-playbook playbooks/monitoring.yml -e @secrets.yml
ansible-playbook playbooks/podman-host.yml
ansible-playbook playbooks/dockhand.yml
```

Playbook order: DNS → infra → Vault/AIStor → GitLab → **database** → docker apps → sonar/elastic/monitoring → podman/dockhand.

### 7. Acceptance commands (copy/paste)

```bash
# DNS
dig @192.168.68.11 pve01.lab.nasraldin.com +short   # → 192.168.68.13
dig @192.168.68.10 pve01.lab.nasraldin.com +short
dig @192.168.68.10 doubleclick.net +short           # → 0.0.0.0 when blocked

# SSH to every guest (last octets)
for ip in 10 11 12 14 15 17 18 19 21 22 23 24 25 26 27; do
  ssh -o BatchMode=yes -o ConnectTimeout=8 nasr@192.168.68.$ip hostname \
    && echo OK.$ip || echo FAIL.$ip
done

# Vault / AIStor / GitLab
ssh nasr@192.168.68.18 'sudo vault status'          # Sealed false
curl -fsS -o /dev/null -w '%{http_code}\n' http://192.168.68.17:9000/minio/health/live
curl -fsS -o /dev/null -w '%{http_code}\n' https://gitlab.nasraldin.com/users/sign_in

# Central DB + apps
nc -vz 192.168.68.21 6432                           # PgCat
curl -fsS -o /dev/null -w '%{http_code}\n' http://192.168.68.22/api/status   # Infisical
curl -fsS -o /dev/null -w '%{http_code}\n' http://192.168.68.26:9000         # Sonar LAN
curl -fsS -o /dev/null -w '%{http_code}\n' http://192.168.68.27:5601         # Kibana LAN
curl -fsS -o /dev/null -w '%{http_code}\n' http://192.168.68.24:3000         # Dockhand
```

**Expected:** no `FAIL.*` lines; health curls return `200` (or Sonar/Kibana first-boot redirect `302`/`303` acceptable if documented).

---

## Flow (happy path)

```text
Mac DNS → public (1.1.1.1)
        ↓
factory-reset-lab.sh (--check → destroy)
        ↓
adopt-existing.sh  (+ optional --wipe-stale-zfs-disks)
        ↓
terraform apply    (VMs 110–123 + CT 200)
        ↓
refresh-ssh-known-hosts.sh
        ↓
ansible: dns → infra → object-storage → gitlab
         → database → docker-hosts
         → sonarqube → elastic → monitoring
         → podman-host → dockhand
        ↓
cloudflare-tunnel bootstrap (sonar/kibana/docker)
        ↓
acceptance → optional DHCP cutover
```

---

## What not to do

| Anti-pattern | Why |
| ------------ | --- |
| Skip known_hosts refresh | Host-key mismatch breaks Ansible |
| Expect VMs 110–119 only | Redesign ends at 123 + CT 200 |
| Recreate `infisical-01` / `runner-02` | Removed; Infisical on docker-01 |
| Apply docker apps before database | PgCat not ready |
| Access on GitLab/Sonar/Kibana | Design forbids it |
| Commit `vault-init.json` / `secrets.yml` | Offline password manager only |

---

## Issue log

Failures from prior refreshes: **[lab-refresh-issues.md](lab-refresh-issues.md)**.

---

## Related scripts

| Script | Repo | Purpose |
| ------ | ---- | ------- |
| `mac/factory-reset-lab.sh` | proxmox-bootstrap | Destructive wipe + residual GPT |
| `scripts/adopt-existing.sh` | terraform-lab | Import kept OpsHub; wipe stale ZFS GPT |
| `scripts/refresh-ssh-known-hosts.sh` | ansible-lab | Clear / re-learn guest SSH host keys |
| `scripts/dns-failover-public.sh` | ansible-lab | Mac DNS → Cloudflare while AdGuard down |
| `scripts/dns-restore-adguard.sh` | ansible-lab | Mac DNS → AdGuard after `dns.yml` |
| `mac/bootstrap.sh` | cloudflare-tunnel | Tunnel + Access for Dockhand; no Access on GitLab/Sonar/Kibana |
