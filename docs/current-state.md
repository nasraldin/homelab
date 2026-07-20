# Current state — July 2026

**Overall:** 🔄 **Setup in progress** — Proxmox is installed and validated; automation
and storage pools are **ready in Git, not yet applied** on the node.

**Node:** `pve01.lab.example.com` · `192.168.1.10/24` · Proxmox VE **9.2.4**

Read the full story: [build-story.md](build-story.md) · Next commands: [installation/next-steps.md](installation/next-steps.md)

---

## Hardware (installed)

| Slot | PCIe | Disk | Role | Status |
| ---- | ---- | ---- | ---- | ------ |
| 1 | ×4 | Samsung 990 PRO 2 TB | `rpool` — Proxmox OS | ✅ |
| 2 | ×4 | Kingston FURY Renegade 4 TB | `data01` — VM disks | 🟡 Terraform |
| 3 | ×1 | Kingston OM8TAP 2 TB (OEM) | `aux01` — backups, ISO | 🟡 Terraform |

Details: [architecture/hardware-and-storage.md](architecture/hardware-and-storage.md)

---

## What is done (✅)

| Area | Item |
| ---- | ---- |
| Install | Proxmox 9.2.4 on **990 PRO only** (`rpool` ~1.8 TB, single disk) |
| Network | Static IP, FQDN, `vmbr0` on `nic0` |
| DNS (interim) | `/etc/hosts` on node + Mac (Cloudflare wildcard avoided) |
| SSH | Key auth Mac → `root@192.168.1.10` |
| APT | deb822, no-subscription enabled, enterprise disabled |
| API | `terraform@pve!provider` token tested |
| Documentation | Split repos, roadmap, architecture, install journal |
| Git | All lab repos pushed to `nasraldin/*` |

---

## Ready in Git — apply on node (🟡)

| # | Task | Repo / command |
| - | ---- | -------------- |
| 1 | Cloudflare Tunnel + Access | `cloudflare-tunnel/mac/bootstrap.sh --yes` |
| 2 | Host bootstrap (ZFS, ARC, admin, mail) | `proxmox-bootstrap/mac/bootstrap.sh --remote --yes` |
| 3 | Daily update check timer | `proxmox-bootstrap/mac/install-update-automation.sh --yes` |
| 4 | `data01` + `aux01` pools + backups | `terraform-lab && terraform apply` |
| 5 | Host firewall (optional) | `proxmox-bootstrap/mac/enable-firewall.sh --yes` |

**This is the active focus** — close Phase 0 before Kubernetes.

---

## Not started yet (⏳)

| Phase | Name |
| ----- | ---- |
| 2–3 | GitLab VM, AdGuard, Technitium |
| 5 | In-cluster monitoring (needs k8s) |
| 6+ | kubeadm, Argo CD, Harbor, platform stack |

---

## Decisions locked (won’t redo)

| Topic | Choice |
| ----- | ------ |
| Hypervisor | Proxmox VE 9.x on ZFS |
| VM disks | **`data01` (FURY) only** — not `rpool` |
| Kubernetes | **kubeadm** on Debian VMs (CKA) — not k3s for primary cluster |
| Ingress | **NGINX** — not Traefik |
| GitOps | Argo CD after cluster exists |
| Registry | Harbor (proxy cache + CI push) |
| GitLab | **Dedicated VM** — not inside k8s |
| Public UI | `homelab.example.com` (Tunnel) — not WAN `:8006` |
| Updates | Check + notify; **manual** hypervisor upgrade |
| ITSM | Zammad for customer tickets; **n8n automates only** |

Full log: [decisions/log.md](decisions/log.md)

---

## Repository status

| Repo | Role | Git |
| ---- | ---- | --- |
| `homelab-docs` | Plans, story, architecture | synced |
| `proxmox-bootstrap` | Layer 0 host | synced |
| `terraform-lab` | Layer 1–2 infra | synced |
| `cloudflare-tunnel` | Remote UI | synced |
| `ansible-lab` | Unattended install media | synced |

---

## Validate node (anytime)

Copy-paste checks: [installation/verified-state.md](installation/verified-state.md)

---

## Single “do this next” block

```bash
cd ~/homelab/proxmox-bootstrap && ./mac/bootstrap.sh --remote --yes
cd ~/homelab/proxmox-bootstrap && ./mac/install-update-automation.sh --yes
cd ~/homelab/terraform-lab && terraform apply
cd ~/homelab/cloudflare-tunnel && ./mac/bootstrap.sh --yes
```

Then: weekly [restore drill](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md).
