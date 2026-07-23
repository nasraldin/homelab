# Follow the Homelab Roadmap from Foundation to Platform

Forward path after Phase 0: phases, repo ownership, and what comes before Kubernetes. Don’t start here on day one — read [current state](../current-state.md) and the [build story](../build-story.md) so the phases match what you already have. Status symbols: [status legend](../conventions/status-legend.md). Last reviewed: 2026-07-23.

Goals stay fixed: a Platform Engineering portfolio you can explain (Terraform, GitOps, observability, security), automation over click-ops, clear ownership ([platform tooling](../platform-tooling.md)), safe ops (backups, notify-only update checks, manual hypervisor upgrades), and DNS that scales (AdGuard + Technitium + Cloudflare).

## What this page covers

- Phase overview table (0 → 11) with status and links
- Ordered foundation work before Kubernetes ([foundation sequence](foundation-sequence.md))
- Repository map (bootstrap, Terraform, tunnel, Ansible, docs)
- Approved order: DNS polish → optional NetBird/Vault → kubeadm

---

## Phase overview

| Phase | Name                 | Status  | Doc                                                                          |
| ----- | -------------------- | ------- | ---------------------------------------------------------------------------- |
| 0     | Proxmox foundation   | ✅ / ⏸️ | [phases.md §0](phases.md#phase-0--proxmox-foundation) — closed; `aux01` hold |
| 1     | Control plane & IaC  | ✅ / ⏸️ | [phases.md §1](phases.md#phase-1--control-plane--iac) — `aux01` hold         |
| 2     | Source control       | ⏳      | later; GitLab is not the next deployment                                     |
| 3     | DNS & networking     | ✅      | IPv4 DHCP → AdGuard; Deco no IPv6 DNS UI — Mac pinned to AdGuard             |
| 4     | OPNsense VLAN pilot  | ⏸️      | archived on `archive/opnsense-vlan-pilot` (2026-07-23)                       |
| 5     | Monitoring           | ⏳      | needs k8s                                                                    |
| 6     | Kubernetes (kubeadm) | ⏳      | [kubernetes/](../kubernetes/index.md)                                        |
| 7     | GitOps               | ⏳      | Argo CD                                                                      |
| 8     | Core platform        | ⏳      | Harbor, Keycloak, …                                                          |
| 9     | K8s operations       | ⏳      | Kyverno, Velero, …                                                           |
| 10    | AI platform          | ⏳      |                                                                              |
| 11    | Developer platform   | ⏳      |                                                                              |

**🔄 = next focus:** kubeadm Stage A when ready (NetBird / Vault optional).
The live TP-Link edge and Cloudflare Tunnel remain unchanged. OPNsense/VLANs
are deferred until segmentation is actually needed.

**Approved sequence:** NetBird (optional) → Vault (optional) → kubeadm Stage A.
See the [foundation sequence](foundation-sequence.md).

---

## Repository map

| Repo                | Layer                         | URL                                            |
| ------------------- | ----------------------------- | ---------------------------------------------- |
| `proxmox-bootstrap` | Host day-1, firewall, updates | https://github.com/nasraldin/proxmox-bootstrap |
| `terraform-lab`     | Storage, VMs, LXC, backups    | https://github.com/nasraldin/terraform-lab     |
| `cloudflare-tunnel` | Public UI via Tunnel + Access | https://github.com/nasraldin/cloudflare-tunnel |
| `ansible-lab`       | Non-k8s guest configuration   | https://github.com/nasraldin/ansible-lab       |
| `homelab`           | Plans, story, architecture    | https://github.com/nasraldin/homelab           |

---

## What to do next

See [current-state.md](../current-state.md) for the live board. Keep the lab
simple: flat LAN + AdGuard + Technitium. Do not reintroduce OPNsense until you
need real VLAN segmentation (typically with Kubernetes).

---

## Related

- [build-story.md](../build-story.md)
- [Target topology](../architecture/target-topology.md)
- [Decision log](../decisions/log.md)
