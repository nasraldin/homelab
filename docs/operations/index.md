# Operate Proxmox Safely: Backups, Updates, and Health

Day-2 work on `pve01`: keep the host patched, prove backups restore, and know where health checks live. This is hypervisor and storage ops — not Kubernetes day-2 (that stays in GitOps and cluster docs).

Scripts and timers live in `proxmox-bootstrap` and `terraform-lab` today. A single ops agent is still future work.

## What this page covers

- Index of updates, vzdump stages, and backup-platform docs
- Links to repo runbooks on GitHub
- Planned homelab-agent scope (not built yet)

| Doc                                                             | Topic                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| [deploy-and-rebuild.md](deploy-and-rebuild.md)                  | Canonical repo order, commands, and acceptance              |
| [lab-refresh-runbook.md](lab-refresh-runbook.md)                | Full wipe → adopt → TF → SSH keys → Ansible checklist       |
| [lab-refresh-issues.md](lab-refresh-issues.md)                  | Refresh failures: symptom → cause → fix (REF-*)             |
| [infra01-remote-access.md](infra01-remote-access.md)            | **Off-LAN operator path** — jump box, Access SSH, PVE admin |
| [proxmox-updates.md](proxmox-updates.md)                        | Daily check, manual upgrade, n8n layer                      |
| [backups.md](backups.md)                                        | vzdump stages, drills, migration                            |
| [backup-platform.md](backup-platform.md)                        | PBS, Velero, MinIO — Veeam-equivalent                       |
| [dns-dhcp-cutover.md](dns-dhcp-cutover.md)                      | TP-Link DHCP DNS → AdGuard (+ Secondary)                    |
| [lan-dns-resilience.md](lan-dns-resilience.md)                  | DNS outages, autostart, replace without LAN death           |
| [mac-dns.md](mac-dns.md)                                        | Mac: scutil / networksetup failover & restore               |
| [remote-connectivity.md](remote-connectivity.md)                | Mac → SSH / RDP / RustDesk / NoMachine (no WAN)             |
| [gitlab.md](gitlab.md)                                          | Omnibus + runners: S3, mint, login, CI                      |
| [gitlab-infra-pipeline.md](gitlab-infra-pipeline.md)            | TF/Ansible CI: TF_TARGET_GUESTS, ANSIBLE_LIMIT              |
| [repo-audit-checklist.md](repo-audit-checklist.md)              | Secrets hygiene, CI coverage, ownership (DRY)               |
| [object-storage.md](object-storage.md)                          | AIStor Free shared S3 (`aistor-01`)                         |
| [vault.md](vault.md)                                            | HashiCorp Vault OSS Raft (`vault-01` + seal)                |
| [infisical.md](infisical.md)                                    | Infisical app env-secrets (`docker-01` + PgCat)             |
| [Vault vs Infisical](../architecture/vault-vs-infisical.md)     | Secrets platforms: features, use cases, decision            |
| [Secret ownership map](../architecture/secret-ownership-map.md) | Vault only / Infisical only / Either per secret type        |
| [guest-vmid-map.md](guest-vmid-map.md)                          | Core VMID 110–123 + CT 200, boot order                      |
| [capacity-rightsizing-2026-07-26.md](capacity-rightsizing-2026-07-26.md) | Live CPU/RAM right-size (old → new)                  |
| [database-01.md](database-01.md)                                | Central Postgres/PgCat/Redis/MariaDB                        |
| [docker-hosts.md](docker-hosts.md)                              | docker-01 / NPM / apps                                      |
| [keycloak.md](keycloak.md)                                      | IdP on docker-01                                            |
| [sonarqube.md](sonarqube.md)                                    | Dedicated Sonar + Tunnel                                    |
| [elastic.md](elastic.md)                                        | Elastic + Kibana (Option A vs Loki)                         |
| [monitoring.md](monitoring.md)                                  | Prometheus/Grafana day-one dashboards + exporters           |
| [dockhand.md](dockhand.md)                                      | Dockhand CT + Access                                        |
| [core-hosts-acceptance.md](core-hosts-acceptance.md)            | Factory-reset prove-out checklist                           |
| [first-time-lab-runbook.md](first-time-lab-runbook.md)          | Fresh PVE install → bootstrap → TF → Ansible                |
| [lab-refresh-runbook.md](lab-refresh-runbook.md)                | Wipe + rebuild (110–123 + CT 200)                           |
| [gitlab-runner-autoscaling.md](gitlab-runner-autoscaling.md)    | Fleeting core (not follow-up)                               |

Architecture: [vm-best-practices.md](../architecture/vm-best-practices.md) (q35, OVMF, VirtIO SCSI, startup order).

## OpsHub (sibling repo)

Browser hub + Terminal + embedded QEMU noVNC (guest rows). Remote Proxmox API needs Cloudflare Access **Service Auth**:

| Doc                                                                                                                           | Topic                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [Proxmox via Cloudflare Access](https://github.com/nasraldin/opshub/blob/main/docs/runbooks/proxmox-via-cloudflare-access.md) | Service Token setup, Console vs SSH          |
| [OpsHub STATUS / ROADMAP](https://github.com/nasraldin/opshub/blob/main/docs/STATUS.md)                                       | Phase 6 embedded noVNC shipped; next Phase 7 |
| [Tunnel Service Auth pointer](https://github.com/nasraldin/cloudflare-tunnel/blob/main/docs/04-service-auth.md)               | Lab-side summary                             |

## Repo runbooks

| Repo              | Doc                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| proxmox-bootstrap | [13-complete-operations-guide](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/13-complete-operations-guide.md) |
| proxmox-bootstrap | [06-runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md)                                     |
| terraform-lab     | [manual-vzdump](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/manual-vzdump.md)                          |
| terraform-lab     | [backup-restore-drill](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md)            |
| terraform-lab     | [scripts-reference](https://github.com/nasraldin/terraform-lab/blob/main/docs/scripts-reference.md)                           |

## Future: homelab operations agent

From planning discussions — a single **homelab-agent** (Go/Python) could eventually cover:

- Proxmox update checks
- Backup verification
- ZFS health, NVMe SMART, disk usage
- Certificate expiry
- VM snapshot age
- Kubernetes node health
- GitLab runner health

**Status:** ⏳ not built. Today: shell scripts + systemd (`proxmox-bootstrap`, `terraform-lab`).

Possible outputs: Prometheus metrics, n8n webhook, Telegram/Discord.

Architecture sketch:

```text
pve01
  └── scripts / future homelab-agent
           ├── proxmox-bootstrap (updates, bootstrap drift)
           ├── terraform-lab backups
           └── (future) n8n → multi-channel notifications
```
