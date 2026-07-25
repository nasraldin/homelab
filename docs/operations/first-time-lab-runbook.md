# First-time lab runbook (greenfield → day-one core hosts)

Use this when **`pve01` is already installed and bootstrapped**, but you have
**never** applied the core container hosts inventory (or you are building from
an empty guest list). For wiping an existing lab and rebuilding, use
[lab-refresh-runbook.md](lab-refresh-runbook.md) instead.

| Related | Role |
| ------- | ---- |
| [deploy-and-rebuild.md](deploy-and-rebuild.md) | Layer ownership + incremental order |
| [2026-07-25 design](../superpowers/specs/2026-07-25-core-container-hosts-design.md) | Locked inventory & exposure rules |
| [guest-vmid-map.md](guest-vmid-map.md) | VMID / IP / boot order |
| [core-hosts-acceptance.md](core-hosts-acceptance.md) | Pass/fail gates before status ✅ |

**Ownership (do not mix):**

```text
proxmox-bootstrap   host only (already done for first-time)
cloudflare-tunnel   remote UI/SSH + GitLab/Sonar/Kibana/Dockhand hostnames
terraform-lab       guests, storage, backups (SoT: terraform.tfvars)
ansible-lab         guest OS + apps
```

---

## Goal (what “done” means)

After this runbook:

1. `qm list` / `pct list` match [guest-vmid-map.md](guest-vmid-map.md) (110–123 + CT 200).
2. No `infisical-01` / `runner-02` guests.
3. Spine (DNS, Vault, AIStor, GitLab) and platform hosts (DB, Docker apps, Sonar, Elastic, monitoring, Dockhand) respond as in § Acceptance.
4. Tunnel serves `gitlab` / `sonar` / `kibana` / `docker` hostnames per design.

---

## Master checklist

### A. Prepare (Mac)

- [ ] `cd ~/homelab && ./clone-labs.sh --pull`
- [ ] `ssh-add ~/.ssh/pve01` — `ssh root@192.168.68.13 hostname` works
- [ ] Local secrets present (never commit):
  - `proxmox-bootstrap/config.env`
  - `terraform-lab/credentials.auto.tfvars`
  - `ansible-lab/secrets.yml` (copy from `secrets.example.yml`; fill **all** keys — DB, Keycloak, Elastic, Grafana, Infisical crypto, GitLab)
  - `cloudflare-tunnel/config.env` (token exported only at bootstrap time)
- [ ] Confirm router **Secondary DNS = `1.1.1.1`** ([lan-dns-resilience](lan-dns-resilience.md))
- [ ] Read design: central Postgres via **PgCat**; Infisical on **docker-01**; fleeting manager only on **runner-01**

### B. Terraform (create inventory)

- [ ] `cd ~/homelab/terraform-lab`
- [ ] Confirm `terraform.tfvars` has VMs 110–123 and CT `dockhand` 200 (no `infisical-01` / `runner-02`)
- [ ] `terraform init && terraform validate`
- [ ] `terraform plan -out=tfplan` — review cores/RAM/disk vs design; note **intentional oversubscription** on PVE
- [ ] `terraform apply tfplan && rm -f tfplan`
- [ ] Gate: `ssh root@192.168.68.13 'qm list; pct list'` matches guest map

**Expected `qm list` names (IPs):**

| VMID | Name | IP |
| ---- | ---- | -- |
| 110 | adguard-01 | .10 |
| 111 | technitium-01 | .11 |
| 112 | infra01 | .12 |
| 113 | vault-01 | .18 |
| 114 | vault-seal | .19 |
| 115 | aistor-01 | .17 |
| 116 | gitlab-01 | .14 |
| 117 | runner-01 | .15 |
| 118 | database-01 | .21 |
| 119 | docker-01 | .22 |
| 120 | podman-01 | .23 |
| 121 | monitoring-01 | .25 |
| 122 | sonarqube-01 | .26 |
| 123 | elastic-01 | .27 |
| 200 | dockhand (CT) | .24 |

### C. SSH known_hosts

Cloud-init mints new host keys on first boot.

```bash
cd ~/homelab/ansible-lab
./scripts/refresh-ssh-known-hosts.sh --check
./scripts/refresh-ssh-known-hosts.sh
./scripts/refresh-ssh-known-hosts.sh --accept-new
```

- [ ] Spot-check: `ssh -o BatchMode=yes nasr@192.168.68.12 hostname` → `infra01`
- [ ] `ansible all -m ping` → all `pong` (wait for cloud-init if some fail)

### D. Ansible (order matters)

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

# 4) GitLab Omnibus + static Docker runner (fleeting = scaffold docs only)
ansible-playbook playbooks/gitlab.yml -e @secrets.yml

# 5) Central DB (must precede apps that use PgCat)
ansible-playbook playbooks/database.yml -e @secrets.yml

# 6) Docker apps (NPM, Infisical→PgCat, Keycloak→PgCat, it-tools, mailpit)
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml

# 7) Quality / search / observability / podman / dockhand
ansible-playbook playbooks/sonarqube.yml -e @secrets.yml
ansible-playbook playbooks/elastic.yml -e @secrets.yml
ansible-playbook playbooks/monitoring.yml -e @secrets.yml
ansible-playbook playbooks/podman-host.yml
ansible-playbook playbooks/dockhand.yml
```

| Tick | Playbook | Expected result (example) |
| ---- | -------- | ------------------------- |
| [ ] | `dns.yml` | `dig @192.168.68.11 pve01.lab.nasraldin.com +short` → `192.168.68.13` |
| [ ] | `object-storage.yml` | `ssh nasr@192.168.68.18 'sudo vault status'` → Sealed `false` |
| [ ] | `object-storage.yml` | `curl -fsS http://192.168.68.17:9000/minio/health/live` → HTTP 200 |
| [ ] | `gitlab.yml` | `curl -fsS -o /dev/null -w '%{http_code}\n' https://gitlab.nasraldin.com/users/sign_in` → `200` |
| [ ] | `database.yml` | `nc -vz 192.168.68.21 6432` succeeds (PgCat) |
| [ ] | `docker-hosts.yml` | Infisical `http://192.168.68.22/api/status` → healthy JSON / 200 |
| [ ] | `sonarqube.yml` | LAN `http://192.168.68.26:9000` responds |
| [ ] | `elastic.yml` | `curl -fsS -u elastic:$PW http://192.168.68.27:9200` → cluster info |
| [ ] | `monitoring.yml` | Grafana `http://192.168.68.25:3000` login page |
| [ ] | `dockhand.yml` | LAN `http://192.168.68.24:3000` Dockhand UI |

### E. Cloudflare Tunnel (public hostnames)

```bash
cd ~/homelab/cloudflare-tunnel
export CLOUDFLARE_API_TOKEN='…'   # password manager; never commit
./mac/bootstrap.sh --check
./mac/bootstrap.sh --yes
bash tests/test_ingress.sh
unset CLOUDFLARE_API_TOKEN
```

- [ ] `https://gitlab.nasraldin.com` — GitLab login (**no** Access)
- [ ] `https://sonar.nasraldin.com` — Sonar (**no** Access)
- [ ] `https://kibana.nasraldin.com` — Kibana (**no** Access)
- [ ] `https://docker.nasraldin.com` — Access OTP → Dockhand `:3000`

### F. Acceptance

Complete [core-hosts-acceptance.md](core-hosts-acceptance.md). Only then flip
⏳ → ✅ in [current-state.md](../current-state.md).

---

## Secrets required (`ansible-lab/secrets.yml`)

Copy `secrets.example.yml` and replace every `replace-with-*` value. Minimum for
day-one:

| Key group | Purpose |
| --------- | ------- |
| AdGuard / Technitium admin | DNS UIs |
| AIStor root + GitLab S3 keys | Object store |
| GitLab root password | Omnibus |
| Postgres / PgAdmin / Redis / MariaDB | `database-01` |
| Keycloak / Infisical / Sonar DB passwords | App DBs via PgCat |
| Infisical `ENCRYPTION_KEY` / `AUTH_SECRET` | App crypto (backup offline) |
| Keycloak admin | IdP UI |
| Elastic / Kibana / Grafana passwords | Search + observability |

```bash
# Prove a key exists without printing others:
python3 -c 'import yaml; d=yaml.safe_load(open("secrets.yml")); assert "vault_postgres_password" in d'
```

---

## Resource note (intentional)

Sum of guest RAM in `terraform.tfvars` **exceeds** physical RAM on `pve01`.
That is **by design** (lab oversubscription). Do not “fix” by shrinking day-one
sizes without updating the design spec. Expect ballooning / reclaim under idle.

---

## What not to do

| Anti-pattern | Why |
| ------------ | --- |
| Apply Infisical before `database.yml` | Needs PgCat on `.21:6432` |
| Put Postgres on docker-01 / sonar VM | Violates central-DB design |
| Tunnel Access on GitLab/Sonar/Kibana | Design: app auth only |
| Skip known_hosts refresh after recreate | SSH/Ansible host-key failures |
| Commit `secrets.yml` / `vault-init.json` | Offline password manager only |
