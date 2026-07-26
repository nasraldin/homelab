# Roadmap — foundation first, then platform

This is the **forward plan** after Phase 0: which phase is which, which repo
owns the work, and what must exist before Kubernetes.

Don’t start here on day one. Read [where things stand](../current-state.md) and
the [build story](../build-story.md) first so the phase table matches what you
already have. Status symbols are explained in the
[status legend](../conventions/status-legend.md). Last reviewed: 2026-07-26.

**Goals that stay fixed:** a Platform Engineering portfolio you can explain
(Terraform, GitOps, observability, security), automation over click-ops, clear
ownership ([platform tooling](../platform-tooling.md)), safe ops (backups,
notify-only update checks, manual hypervisor upgrades), and DNS that can grow
(AdGuard + Technitium + Cloudflare).

## What this page covers

- Phase overview (0 → 11) with status and links
- Ordered foundation work before Kubernetes ([foundation sequence](foundation-sequence.md))
- Which Git repos own which layer
- Approved order after the foundation

---

## Phase overview

| Phase | Name                    | Status      | Notes                                                                                       |
| ----- | ----------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| 0     | Proxmox foundation      | Done / hold | Closed; `aux01` waiting on Slot 3 disk — [phases §0](phases.md#phase-0--proxmox-foundation) |
| 1     | Control plane & IaC     | Done / hold | Same `aux01` hold — [phases §1](phases.md#phase-1--control-plane--iac)                      |
| 2     | Source control          | Done        | GitLab Omnibus + runner — [gitlab](../operations/gitlab.md)                                 |
| 3     | DNS & networking        | Done        | DHCP → AdGuard; Mac pin when Deco lacks IPv6 DNS UI                                         |
| 4     | OPNsense VLAN pilot     | On hold     | Archived on `archive/opnsense-vlan-pilot` (2026-07-23)                                      |
| 5     | Monitoring (in-cluster) | Not started | Needs Kubernetes                                                                            |
| 6     | Kubernetes (kubeadm)    | Not started | [kubernetes/](../kubernetes/index.md)                                                       |
| 7     | GitOps                  | Not started | Argo CD                                                                                     |
| 8     | Core platform           | Not started | Harbor, Keycloak in-cluster, …                                                              |
| 9     | K8s operations          | Not started | Kyverno, Velero, …                                                                          |
| 10    | AI platform             | Not started |                                                                                             |
| 11    | Developer platform      | Not started |                                                                                             |

**Next focus:** optional Terraform CI on GitLab, then kubeadm Stage A. NetBird
is optional. OPNsense / VLANs stay deferred.

**Already shipped in the foundation:** GitLab + runners → Vault + AIStor (core
secrets + S3). See the [foundation sequence](foundation-sequence.md).

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

Use [where things stand](../current-state.md) as the live board. Keep the lab
simple: flat LAN + AdGuard + Technitium. Do not bring OPNsense back until you
need real VLAN segmentation (usually with Kubernetes).

---

## Related

- [Build story](../build-story.md)
- [Target topology](../architecture/target-topology.md)
- [Decision log](../decisions/log.md)
