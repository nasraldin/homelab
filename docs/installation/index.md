# Install Proxmox from Scratch — Phase 0 Journal

Phase 0 journal for `pve01`: planning choices, installer traps, fixes, and the checks that meant “done.” Read the [build story](../build-story.md) install chapters first if you want the why; use [current state](../current-state.md) for the live checklist.

Operational runbooks live in the private **proxmox-bootstrap** repo. These pages are the historical record you can walk in order.

## What this page covers

- Reading order for the install journal (journey → issues → verified state → next steps)
- Links into proxmox-bootstrap deep dives (installer, DNS, SSH, Terraform API)
- Where this sits relative to hardware, network, and the foundation sequence

## Read in this order

| #   | Doc                                 | Purpose                                    |
| --- | ----------------------------------- | ------------------------------------------ |
| 1   | [Journey timeline](journey.md)      | Planning → install → fixes, in sequence    |
| 2   | [Issues tracker](issues-tracker.md) | Symptom, cause, fix for each problem       |
| 3   | [Verified state](verified-state.md) | Known-good checks for the live node        |
| 4   | [Next steps](next-steps.md)         | Bootstrap, tunnel, Terraform after install |

## Deep dives (proxmox-bootstrap)

| Topic                     | Doc                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Installer screen choices  | [01-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/01-install.md)             |
| Post-install automation   | [02-post-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/02-post-install.md)   |
| DNS & Cloudflare wildcard | [03-dns](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/03-dns.md)                     |
| SSH keys & Mac config     | [04-ssh](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/04-ssh.md)                     |
| Terraform API token       | [05-terraform-api](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/05-terraform-api.md) |
| Full runbook              | [06-runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md)             |

## Related

- [Hardware & storage](../architecture/hardware-and-storage.md)
- [Network, DNS & ingress](../architecture/network-dns-ingress.md)
- [Foundation sequence](../roadmap/foundation-sequence.md)
- [Cloudflare Tunnel](https://github.com/nasraldin/cloudflare-tunnel) (remote UI)
