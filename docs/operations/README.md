# Operations

Host-level operations for `pve01` — backups, updates, health.

| Doc | Topic |
| --- | ----- |
| [proxmox-updates.md](proxmox-updates.md) | Daily check, manual upgrade, n8n layer |
| [backups.md](backups.md) | vzdump stages, drills, migration |
| [backup-platform.md](backup-platform.md) | PBS, Velero, MinIO — Veeam-equivalent |

## Repo runbooks

| Repo | Doc |
| ---- | --- |
| proxmox-bootstrap | [13-complete-operations-guide](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/13-complete-operations-guide.md) |
| proxmox-bootstrap | [06-runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md) |
| terraform-lab | [scripts-reference](https://github.com/nasraldin/terraform-lab/blob/main/docs/scripts-reference.md) |

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
