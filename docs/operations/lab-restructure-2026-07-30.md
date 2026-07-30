# Lab restructure 2026-07-30 — DNS LXCs, docker-01 drain, Infisical CT

End-state topology for **lab-home-k8s** (home Proxmox). Lab is disposable —
prefer recreate over heroic recovery — but cutovers below keep LAN DNS and
GitLab object store working.

## Target inventory

| CTID/VMID | Name           | IP               | Specs           | Role                                      |
| --------- | -------------- | ---------------- | --------------- | ----------------------------------------- |
| **121**   | `adguard-01`   | `192.168.68.10`  | 1c / 512M / 10G | Recursive DNS + filtering (DHCP Primary)  |
| **122**   | `dns-01`       | `192.168.68.11`  | 1c / 512M / 10G | Technitium authoritative (`lab` / `dev.test`) |
| **123**   | `infisical-01` | `192.168.68.25`  | 2c / 4G / 40G   | Infisical + Postgres 16 + Redis (nesting) |
| **124**   | `infra-01`     | `192.168.68.14`  | 2c / 2G / 20G   | Jumpbox LXC (SSH + operator pkgs) — **after** VM 110 gone |
| **117**   | `docker-01`    | `192.168.68.21`  | existing VM     | All Docker apps + NPM + Stalwart + AIStor + Dockhand + Portainer |

**Removed after cutover:** VM **110** (fat infra-01), LXC **118** (Dockhand),
LXC **119** (Portainer), VM **120** (`ai-01`).

### IP / DHCP notes

| Before                         | After                                      |
| ------------------------------ | ------------------------------------------ |
| LAN DNS Primary = `.14` (infra VM AdGuard) | Primary = **`.10`** (`adguard-01`) |
| Secondary                      | still `1.1.1.1`                            |
| Infisical                      | `.14:8090` → **`.25:8090`**                |
| Proxy / mail / minio / dockhand / portainer | all → **`.21`**                  |

**Router:** TP-Link DHCP Primary DNS → `192.168.68.10` (Secondary `1.1.1.1`).  
**Mac:** `networksetup -setdnsservers Wi-Fi 192.168.68.10 1.1.1.1`

## Cutover sequence

### 0. Preconditions

- Mac can `ssh root@192.168.68.13` and `ssh nasr@192.168.68.14`
- Secondary DNS `1.1.1.1` already set (LAN stays up if AdGuard drops)
- Optional: pin Mac to public DNS while creating DNS CTs:
  `networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1`

### 1. Create DNS + Infisical LXCs

```bash
# Prefer pct when Terraform API flakes:
ssh root@192.168.68.13 'bash -s' < ~/homelab/lab-home-k8s/terraform/scripts/pct-create-restructure-lxcs.sh

# Or Terraform (after API healthy):
cd ~/homelab/lab-home-k8s/terraform
terraform apply -target='proxmox_virtual_environment_container.ct["adguard-01"]' \
  -target='proxmox_virtual_environment_container.ct["dns-01"]' \
  -target='proxmox_virtual_environment_container.ct["infisical-01"]'
```

### 2. Configure DNS → verify → cut DHCP

```bash
cd ~/homelab/lab-home-k8s/ansible
ssh-keyscan -H 192.168.68.10 192.168.68.11 >> ~/.ssh/known_hosts
ansible-playbook playbooks/dns.yml -e @secrets.yml

dig @192.168.68.11 gitlab.lab +short          # Technitium
dig @192.168.68.10 gitlab.lab +short          # AdGuard → Technitium
dig @192.168.68.10 example.com +short         # recursion

# Then update router DHCP Primary → .10 and Mac DNS → .10 + 1.1.1.1
# Stop AdGuard/Technitium on old infra VM only after clients use .10:
ssh nasr@192.168.68.14 'sudo systemctl stop AdGuardHome dns'
```

### 3. Infisical migrate (preserve ENCRYPTION_KEY + DB)

```bash
# Dump from old stack
ssh nasr@192.168.68.14 'sudo docker exec infisical-db pg_dump -U infisical infisical' \
  > /tmp/infisical-migrate.sql

ansible-playbook playbooks/infisical.yml -e @secrets.yml
# Restore:
ssh root@192.168.68.25 'docker exec -i infisical-db psql -U infisical infisical' < /tmp/infisical-migrate.sql
# Same ENCRYPTION_KEY/AUTH_SECRET from secrets.yml — required for decrypt + universal auth

# Re-seed / verify operator:
ansible-playbook playbooks/infisical-seed.yml -e @secrets.yml
# Update K8s InfisicalSecret host → http://192.168.68.25:8090 (or http://infisical.lab via NPM)
```

### 4. Move Docker apps → docker-01

```bash
# Volume rsync pattern (proxy / stalwart / bulwark) from infra → docker-01, then:
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml
# Update GitLab object store to http://192.168.68.21:9000 if AIStor moved
# Cloudflare tunnel origins: dockhand/proxy/minio/portainer → .21
```

Preserve OpenClaw on docker-01 if already running (parallel agent).

### 5. Dockhand + Portainer on docker-01; retire LXCs 118/119

```bash
./scripts/dockhand-register-environments.py   # DOCKHAND_URL=http://192.168.68.21:3000
ansible-playbook playbooks/dockhand-agents.yml
# Then remove from terraform.tfvars containers and: pct stop 118 119; pct destroy 118 119
```

### 6. Jumpbox LXC; destroy infra VM 110

Only when DNS is on `.10`, apps on `.21`, Infisical on `.25`, AIStor reachable:

```bash
qm stop 110 && qm destroy 110 --purge 1
# Create jumpbox LXC 124 at .14 (pct or terraform containers.infra-01)
ansible-playbook playbooks/infra.yml -e @secrets.yml
```

## Rollback

| Symptom                    | Rollback                                              |
| -------------------------- | ----------------------------------------------------- |
| New AdGuard broken         | DHCP Primary back to `.14`; start AdGuard on infra VM |
| Infisical empty after move | Restore `infisical-migrate.sql` + same ENCRYPTION_KEY |
| Proxy/mail broken          | Keep stacks on infra until docker-01 volumes verified |

## Verification checklist

- [ ] `dig @192.168.68.10 gitlab.lab` → `.15`
- [ ] `dig @192.168.68.10 pve.lab` → `.13`
- [ ] `http://proxy.lab:81` (NPM on docker-01)
- [ ] `http://infisical.lab` or `:8090` on `.25` + universal-auth seed
- [ ] `http://webmail.lab` / `mail.lab`
- [x] `http://dockhand.lab` / `http://docker.lab` → Dockhand on `.21`
- [x] `http://portainer.lab` → Portainer UI on `.21:9443` via NPM (`https` + `proxy_ssl_verify off`); admin via `vault_portainer_admin_password`
- [x] Cloudflare tunnel origins: `docker` / `portainer` / `minio` / `proxy` → `.21` (re-applied 2026-07-30)
- [ ] GitLab object store healthy (AIStor `:9000` on docker-01)
- [ ] `ssh nasr@192.168.68.14` jumpbox only (no Docker app ports)

## Parallel agents / session status (2026-07-30)

| Track | Outcome |
| ----- | ------- |
| DNS + Infisical + docker drain | **Live** — CT 121–124; VM 110 + LXC 118/119 destroyed; stacks on docker-01 / Infisical CT |
| Ollama → `llm-01` | **Live** — CT 125 `.26`, amdgpu/ROCm, `ollama ps` GPU; LiteLLM → `.26:11434`; **ai-01** (VM 120) destroyed |
| OpenClaw NPM `#token=` boot | **Live** on docker-01 — cookie/WS-aware `/__oc_boot` (no `/`↔boot loop) |
| Stalwart/Bulwark same-origin JMAP | **Live** on docker-01 (CSP-safe JMAP via NPM sub_filter) |
| K8s NS taxonomy | **Live** — purpose NS only; old NS pruned |
| GitLab runner / KEDA / Kyverno / MariaDB CRDs / LibreChat Recreate | In GitOps tree |
| **Still TBD after cutover** | TP-Link DHCP → `.10`; Infisical UA seed (sibling); AIStor restore from vzdump if needed |
| Cloudflare tunnel / Portainer init | **Live** — origins → `.21`; Portainer admin baked (`--admin-password`); NPM SSL verify off |
| Mac `/etc/resolver/lab` | **Done** — points at AdGuard `.10` (`ansible-lab/scripts/mac-resolver-lab.sh`) |

Do not fight OpenClaw / Ollama→`llm-01` / gitlab-runner work unless relocating
containers off infra-01. OpenClaw already on docker-01 is fine; keep NPM host
records pointing at cluster LBs / docker-01 as listed in `group_vars/all.yml`.

**K8s namespace taxonomy** (separate track in `lab-home-gitops`): consolidate to
`ai-tools` / `observability` / `database` / `artifacts` / `storage` / `security` /
`gitops` / `apps` — see `lab-home-gitops/docs/namespace-taxonomy.md`. Only touch
k8s consumer refs here; leave Docker Infisical/host moves to the infra agents.

## ID↔IP alignment (2026-07-30 evening)

Live guests renumbered so **CT/VM ID matches last octet in the 1xx range**.
Jumpbox renamed **`infra-01` → `ssh-01`**. AdGuard moved from `.10` → **`.14`**
(PVE stays `.13`).

| ID | Name | IP |
| -- | ---- | -- |
| 111 | dns-01 | `.11` |
| 112 | ssh-01 | `.12` |
| — | pve01 | `.13` |
| 114 | adguard-01 | `.14` |
| 115 | gitlab-01 | `.15` |
| 116 | runner-01 | `.16` |
| 117 | k8s-cp-01 | `.17` |
| 118–120 | k8s-w-01..03 | `.18–.20` |
| 121 | docker-01 | `.21` |
| 125 | infisical-01 | `.25` |
| 126 | llm-01 | `.26` |

Mac Wi-Fi + `/etc/resolver/lab` → `.14`. Update TP-Link DHCP Primary DNS to
`.14` if still pointing at `.10`.
