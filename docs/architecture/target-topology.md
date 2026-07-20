# Map the Homelab from the Internet Down to Bare Metal

One picture of how traffic and workloads sit on a single X1 Pro node — from Cloudflare at the edge down through Proxmox storage pools to management VMs and kubeadm. Use it as the orientation map before diving into storage, placement, or network detail pages.

## What this page covers

- End-to-end topology: Internet → Tunnel → LAN → `pve01` → guests
- How Slots 1–3 map to `rpool`, `data01`, and `aux01`
- Where management VMs and the kubeadm cluster sit
- Design split by tier and the recoverability rule for Git and backups

```text
Internet
    │
Cloudflare DNS + Access
    │
Cloudflare Tunnel ──► homelab.example.com (PVE UI, later apps)
    │
Home LAN (192.168.1.0/24)
    │
pve01 (Proxmox VE 9.x)
    │
    ├── Slot 1 rpool (990 PRO)     OS, snippets, bounded backups
    ├── Slot 2 data01 (FURY 4TB)   ALL VM disks
    └── Slot 3 aux01 (OEM 2TB)     vzdump, ISO, archive
    │
    ├── Management VMs (data01)
    │     gitlab-01, haproxy-01, adguard-01, technitium-01, docker-util (optional)
    │
    └── Kubernetes (kubeadm VMs on data01)
          cp1–cp3, worker1–2 (+ Longhorn vdisks)
          Platform via Argo CD: Cilium, NGINX, Harbor, monitoring…
```

## Design split

| Tier                      | Runs on                 | Examples                                           |
| ------------------------- | ----------------------- | -------------------------------------------------- |
| **Hypervisor**            | Proxmox host            | ZFS, vzdump, update checks — **no Docker on host** |
| **Management VMs**        | Debian on `data01`      | GitLab, HAProxy, DNS, Uptime Kuma                  |
| **Kubernetes**            | kubeadm VMs on `data01` | Argo CD, Longhorn, apps                            |
| **Lab VMs**               | Optional on `aux01`     | Swarm, Coolify, experiments                        |
| **Control plane (today)** | Mac                     | Terraform, Ansible, Lima Docker                    |

**Recoverability rule:** GitLab and backups stay **outside** the cluster Argo CD manages.

## Related

- [proxmox-storage-layout.md](proxmox-storage-layout.md)
- [service-placement.md](service-placement.md)
- [hardware-and-storage.md](hardware-and-storage.md)
- [network-dns-ingress.md](network-dns-ingress.md)
- [kubernetes/gitops-bootstrap.md](../kubernetes/gitops-bootstrap.md)
