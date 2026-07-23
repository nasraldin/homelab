# Operate Proxmox Safely: Backups, Updates, and Health

Day-2 work on `pve01`: keep the host patched, prove backups restore, and know where health checks live. This is hypervisor and storage ops — not Kubernetes day-2 (that stays in GitOps and cluster docs).

Scripts and timers live in `proxmox-bootstrap` and `terraform-lab` today. A single ops agent is still future work.

## What this page covers

- Index of updates, vzdump stages, and backup-platform docs
- Bounded OPNsense VLAN pilot procedure and rollback
- Links to repo runbooks on GitHub
- Planned homelab-agent scope (not built yet)

| Doc                                                  | Topic                                          |
| ---------------------------------------------------- | ---------------------------------------------- |
| [deploy-and-rebuild.md](deploy-and-rebuild.md)       | Canonical repo order, commands, and acceptance |
| [infra01-remote-access.md](infra01-remote-access.md) | Secure remote shell and PVE administration     |
| [proxmox-updates.md](proxmox-updates.md)             | Daily check, manual upgrade, n8n layer         |
| [backups.md](backups.md)                             | vzdump stages, drills, migration               |
| [backup-platform.md](backup-platform.md)             | PBS, Velero, MinIO — Veeam-equivalent          |
| [dns-dhcp-cutover.md](dns-dhcp-cutover.md)           | TP-Link DHCP DNS → AdGuard (all LAN clients)   |
| [opnsense-vlan-pilot.md](opnsense-vlan-pilot.md)     | Bounded VLAN, firewall, DNS, and rollback test |

## OpsHub (sibling repo)

Browser hub + Terminal. Remote Proxmox API needs Cloudflare Access **Service Auth**:

| Doc | Topic |
| --- | ----- |
| [Proxmox via Cloudflare Access](https://github.com/nasraldin/opshub/blob/main/docs/runbooks/proxmox-via-cloudflare-access.md) | Service Token setup, Console vs SSH |
| [Tunnel Service Auth pointer](https://github.com/nasraldin/cloudflare-tunnel/blob/main/docs/04-service-auth.md) | Lab-side summary |

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
