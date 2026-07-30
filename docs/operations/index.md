# Operations — day-two work on the lab

This section is for **running** the lab after it exists: backups, updates,
DNS, GitLab, secrets, and the guest platforms. It is hypervisor and VM ops —
not Kubernetes day-two (that stays with GitOps and the cluster docs).

Scripts and timers live in `proxmox-bootstrap` and `terraform-lab` today. A
single “homelab agent” is still future work.

## What this page covers

- Index of runbooks (deploy order, refresh, DNS, GitLab, secrets, guests)
- Links into repo-specific guides on GitHub
- Planned scope for a future ops agent

## Start with these

| If you need to…                      | Open                                              |
| ------------------------------------ | ------------------------------------------------- |
| Rebuild or deploy in the right order | [deploy-and-rebuild](deploy-and-rebuild.md)       |
| Wipe guests and bring them back      | [lab-refresh-runbook](lab-refresh-runbook.md)     |
| Restructure DNS / docker drain (2026-07-30) | [lab-restructure-2026-07-30](lab-restructure-2026-07-30.md) |
| Debug a refresh failure              | [lab-refresh-issues](lab-refresh-issues.md)       |
| Admin the lab from outside the LAN   | [infra01-remote-access](infra01-remote-access.md) |
| See every guest VMID (lab-home-k8s)  | [lab-home-inventory](lab-home-inventory.md)       |
| See terraform-lab guest VMIDs        | [guest-vmid-map](guest-vmid-map.md)               |

## Full index

| Doc                                                                      | Topic                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| [deploy-and-rebuild.md](deploy-and-rebuild.md)                           | Canonical repo order, commands, acceptance              |
| [lab-refresh-runbook.md](lab-refresh-runbook.md)                         | Full wipe → adopt → Terraform → SSH keys → Ansible      |
| [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md)           | DNS LXCs, docker-01 drain, Infisical CT, jumpbox        |
| [lab-refresh-issues.md](lab-refresh-issues.md)                           | Refresh failures: symptom → cause → fix (REF-\*)        |
| [first-time-lab-runbook.md](first-time-lab-runbook.md)                   | Fresh Proxmox install → bootstrap → Terraform → Ansible |
| [infra01-remote-access.md](infra01-remote-access.md)                     | Off-LAN jump box, Access SSH, Proxmox admin             |
| [proxmox-updates.md](proxmox-updates.md)                                 | Daily check, manual upgrade                             |
| [backups.md](backups.md)                                                 | vzdump stages, drills, migration                        |
| [backup-platform.md](backup-platform.md)                                 | PBS, Velero, MinIO — Veeam-style stack                  |
| [dns-dhcp-cutover.md](dns-dhcp-cutover.md)                               | TP-Link DHCP DNS → AdGuard (+ secondary)                |
| [lan-dns-resilience.md](lan-dns-resilience.md)                           | Survive DNS outages; replace AdGuard safely             |
| [mac-dns.md](mac-dns.md)                                                 | Mac: pin / restore DNS                                  |
| [remote-connectivity.md](remote-connectivity.md)                         | Mac → SSH / RDP / remote desktop (no WAN)               |
| [gitlab.md](gitlab.md)                                                   | Omnibus + runners: S3, login, CI                        |
| [gitlab-infra-pipeline.md](gitlab-infra-pipeline.md)                     | Terraform / Ansible CI variables                        |
| [gitlab-runner-autoscaling.md](gitlab-runner-autoscaling.md)             | Fleeting / autoscaler notes                             |
| [repo-audit-checklist.md](repo-audit-checklist.md)                       | Secrets hygiene, CI coverage, ownership                 |
| [object-storage.md](object-storage.md)                                   | AIStor Free shared S3                                       |
| [vault.md](vault.md)                                                     | HashiCorp Vault OSS Raft                                |
| [infisical.md](infisical.md)                                             | App env-secrets on `infisical-01` LXC                   |
| [Vault vs Infisical](../architecture/vault-vs-infisical.md)              | When to use which secrets tool                          |
| [Secret ownership map](../architecture/secret-ownership-map.md)          | Which secret goes where                                 |
| [guest-vmid-map.md](guest-vmid-map.md)                                   | terraform-lab inventory (alternate)                 |
| [lab-home-inventory.md](lab-home-inventory.md)                           | **lab-home-k8s** guest map + cutover status         |
| [capacity-rightsizing-2026-07-26.md](capacity-rightsizing-2026-07-26.md) | Live CPU/RAM right-size (old → new)                 |
| [database-01.md](database-01.md)                                         | Central Postgres / PgCat (terraform-lab)            |
| [docker-hosts.md](docker-hosts.md)                                       | docker-01 — NPM / mail / S3 / Dockhand / Portainer  |
| [keycloak.md](keycloak.md)                                               | IdP (interim k8s `apps` or docker-01)               |
| [sonarqube.md](sonarqube.md)                                             | Sonar (interim k8s / dedicated VM)                  |
| [elastic.md](elastic.md)                                                 | Elastic + Kibana                                    |
| [monitoring.md](monitoring.md)                                           | Prometheus / Grafana dashboards + exporters         |
| [dockhand.md](dockhand.md)                                               | Dockhand on docker-01                               |
| [ollama-llm-01.md](ollama-llm-01.md)                                     | Ollama LXC (GPU device passthrough)                 |
| [ollama-ai-01.md](ollama-ai-01.md)                                       | Legacy ai-01 standby notes                          |
| [openclaw.md](openclaw.md)                                               | OpenClaw gateway (via LiteLLM)                      |
| [librechat.md](librechat.md)                                             | LibreChat admin seed + registration disabled        |
| [stalwart.md](stalwart.md)                                               | Lab mail + Bulwark CSP/JMAP                         |
| [gitlab-runner-k8s.md](gitlab-runner-k8s.md)                             | In-cluster runner (`gitops` NS)                     |
| [core-hosts-acceptance.md](core-hosts-acceptance.md)                     | Factory-reset prove-out checklist                   |

Architecture tip: [VM best practices](../architecture/vm-best-practices.md).

## OpsHub (sibling repo)

Browser hub + terminal + embedded guest console. Remote Proxmox API needs
Cloudflare Access **Service Auth**:

| Doc                                                                                                                           | Topic                         |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| [Proxmox via Cloudflare Access](https://github.com/nasraldin/opshub/blob/main/docs/runbooks/proxmox-via-cloudflare-access.md) | Service token, console vs SSH |
| [OpsHub STATUS / ROADMAP](https://github.com/nasraldin/opshub/blob/main/docs/STATUS.md)                                       | What shipped; what’s next     |
| [Tunnel Service Auth](https://github.com/nasraldin/cloudflare-tunnel/blob/main/docs/04-service-auth.md)                       | Lab-side summary              |

## Repo runbooks

| Repo              | Doc                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| proxmox-bootstrap | [Complete operations guide](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/13-complete-operations-guide.md) |
| proxmox-bootstrap | [Runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md)                                     |
| terraform-lab     | [Manual vzdump](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/manual-vzdump.md)                       |
| terraform-lab     | [Backup restore drill](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md)         |
| terraform-lab     | [Scripts reference](https://github.com/nasraldin/terraform-lab/blob/main/docs/scripts-reference.md)                        |

## Future: homelab operations agent

A single **homelab-agent** could eventually watch:

- Proxmox update checks
- Backup verification
- ZFS health, NVMe SMART, disk usage
- Certificate expiry
- VM snapshot age
- Kubernetes node health
- GitLab runner health

**Today:** shell scripts + systemd in `proxmox-bootstrap` and `terraform-lab`.
The agent is not built yet.

```text
pve01
  └── scripts / future homelab-agent
           ├── proxmox-bootstrap (updates, bootstrap drift)
           ├── terraform-lab backups
           └── (future) n8n → notifications
```
