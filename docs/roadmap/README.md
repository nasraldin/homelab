# Follow the Homelab Roadmap from Foundation to Platform

Forward path after Phase 0: phases, repo ownership, and what comes before Kubernetes. Don’t start here on day one — read [current state](../current-state.md) and the [build story](../build-story.md) so the phases match what you already have. Status symbols: [status legend](../conventions/status-legend.md). Last reviewed: 2026-07-20.

Goals stay fixed: a Platform Engineering portfolio you can explain (Terraform, GitOps, observability, security), automation over click-ops, clear ownership ([platform tooling](../platform-tooling.md)), safe ops (backups, notify-only update checks, manual hypervisor upgrades), and DNS that scales (AdGuard + Technitium + Cloudflare).

## What this page covers

- Phase overview table (0 → 11) with status and links
- Ordered foundation work before Kubernetes ([foundation sequence](foundation-sequence.md))
- Repository map (bootstrap, Terraform, tunnel, Ansible, docs)
- Where to look next for the active close-out commands

---

## Phase overview

| Phase | Name | Status | Doc |
| ----- | ---- | ------ | --- |
| 0 | Proxmox foundation | 🔄 | [phases.md §0](phases.md#phase-0--proxmox-foundation) |
| 1 | Control plane & IaC | 🔄 | [phases.md §1](phases.md#phase-1--control-plane--iac) |
| 2 | Source control | ⏳ | [phases.md §2](phases.md#phase-2--source-control) |
| 3 | DNS & networking | ⏳ | [phases.md §3](phases.md#phase-3--dns--networking) |
| 4 | Edge firewall | ⏸️ | deferred |
| 5 | Monitoring | ⏳ | needs k8s |
| 6 | Kubernetes (kubeadm) | ⏳ | [kubernetes/](../kubernetes/README.md) |
| 7 | GitOps | ⏳ | Argo CD |
| 8 | Core platform | ⏳ | Harbor, Keycloak, … |
| 9 | K8s operations | ⏳ | Kyverno, Velero, … |
| 10 | AI platform | ⏳ | |
| 11 | Developer platform | ⏳ | |

**🔄 = active setup** (install done; automation not yet applied on node).

**Before Kubernetes:** [foundation-sequence.md](foundation-sequence.md) steps 1–12.

---

## Repository map

| Repo | Layer | URL |
| ---- | ----- | --- |
| `proxmox-bootstrap` | Host day-1, firewall, updates | https://github.com/nasraldin/proxmox-bootstrap |
| `terraform-lab` | Storage, VMs, LXC, backups | https://github.com/nasraldin/terraform-lab |
| `cloudflare-tunnel` | Public UI via Tunnel + Access | https://github.com/nasraldin/cloudflare-tunnel |
| `ansible-lab` | Installer media + guest Ansible | https://github.com/nasraldin/ansible-lab |
| `homelab-docs` | Plans, story, architecture | https://github.com/nasraldin/homelab-docs |

---

## What to do next

See [current-state.md](../current-state.md) — single command block for Phase 0 close-out.

---

## Related

- [build-story.md](../build-story.md)
- [Target topology](../architecture/target-topology.md)
- [Decision log](../decisions/log.md)
