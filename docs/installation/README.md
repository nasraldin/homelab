# Phase 0 — Fresh Proxmox install

This section is the install journal for **pve01**: what we planned, what the installer asked, what broke, and what “good” looked like when we were done.

Read the [build story](../build-story.md) (chapters on install) first if you want the why. Use [current state](../current-state.md) for the live checklist.

Operational runbooks live in the private **proxmox-bootstrap** repo. What’s here is the historical record students can follow.

## Read in this order

| # | Doc | Purpose |
| - | --- | ------- |
| 1 | [Journey timeline](journey.md) | Planning → install → fixes, in sequence |
| 2 | [Issues tracker](issues-tracker.md) | Symptom, cause, fix for each problem |
| 3 | [Verified state](verified-state.md) | Known-good checks (with placeholders) |
| 4 | [Next steps](next-steps.md) | Bootstrap, tunnel, Terraform after install |

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
