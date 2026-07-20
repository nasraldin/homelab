# Phase 0 — Fresh Proxmox install

Install journal for **pve01** — planning, installer choices, problems, verified state.

**Story:** [build-story.md](../build-story.md) Chapter 3–4 · **Status:** [current-state.md](../current-state.md)

Operational runbooks: **proxmox-bootstrap**. This section is the historical record.

## Start here

| Doc | Purpose |
| --- | ------- |
| [Journey timeline](journey.md) | What happened, in order — planning → install → fixes |
| [Issues tracker](issues-tracker.md) | Every problem, symptom, root cause, fix, status |
| [Verified state](verified-state.md) | Known-good config snapshot on `pve01` |
| [Next steps](next-steps.md) | What to run after install (bootstrap, tunnel, Terraform) |

## Deep dives (proxmox-bootstrap)

| Topic | Doc |
| ----- | --- |
| Installer screen choices | [01-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/01-install.md) |
| Post-install automation | [02-post-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/02-post-install.md) |
| DNS & Cloudflare wildcard | [03-dns](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/03-dns.md) |
| SSH keys & Mac config | [04-ssh](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/04-ssh.md) |
| Terraform API token | [05-terraform-api](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/05-terraform-api.md) |
| Full runbook | [06-runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md) |

## Related

- [Hardware & storage](../architecture/hardware-and-storage.md)
- [Network, DNS & ingress](../architecture/network-dns-ingress.md)
- [Foundation sequence](../roadmap/foundation-sequence.md)
- [Cloudflare Tunnel](../../cloudflare-tunnel/README.md) (remote UI)
