# See Where the Homelab Stands Right Now

Live status board for the lab. Read the [build story](build-story.md) first so the checkmarks mean something; next work is Phase 2–3 ([foundation sequence](roadmap/foundation-sequence.md)).

**Overall:** Phase 0 ✅ closed (except Slot 3 / `aux01` ⏸️). **Next focus:** Phase 2–3 (GitLab + DNS). **Node:** `pve01.lab.nasraldin.com` · `192.168.68.13/22` · Proxmox VE **9.2.4**.

## What this page covers

- Hardware slots and pool roles (`rpool` / `data01` / `aux01`)
- What is already ✅ on the node
- What is ⏸️ deferred (documented reason)
- What is still ⏳ (Phase 2+), plus decisions that won’t be redone

---

## Hardware (installed)

| Slot | PCIe | Disk                        | Role                   | Status                                        |
| ---- | ---- | --------------------------- | ---------------------- | --------------------------------------------- |
| 1    | ×4   | Samsung 990 PRO 2 TB        | `rpool` — Proxmox OS   | ✅                                            |
| 2    | ×4   | Kingston FURY Renegade 4 TB | `data01` — VM disks    | ✅                                            |
| 3    | ×1   | Kingston OM8TAP 2 TB (OEM)  | `aux01` — backups, ISO | ⏸️ disk **not installed** — hold until Slot 3 |

Details: [architecture/hardware-and-storage.md](architecture/hardware-and-storage.md)

---

## What is done (✅)

| Area           | Item                                                                 |
| -------------- | -------------------------------------------------------------------- |
| Install        | Proxmox 9.2.4 on **990 PRO only** (`rpool` ~1.8 TB, single disk)     |
| Network        | Static IP, FQDN, `vmbr0`                                             |
| DNS (interim)  | `/etc/hosts` on node + Mac (Cloudflare wildcard avoided)             |
| SSH            | Key auth Mac → `root@192.168.68.13` + admin user                     |
| APT            | deb822, no-subscription enabled, enterprise disabled                 |
| API            | `terraform@pve!provider` token                                       |
| Host bootstrap | ZFS tune, ARC 16 GiB, packages, admin, mail endpoint, `iommu=pt`     |
| Updates        | `pve-update-check.timer` enabled (daily check + notify)              |
| Storage        | `data01` ONLINE + Proxmox `zfspool`; Stage 1 `local-backup` on rpool |
| Tunnel         | Cloudflare Tunnel active → Proxmox UI                                |
| Firewall       | Datacenter + node firewall enabled (LAN SSH/API + loopback rules)    |
| Drift check    | `bootstrap.sh --check` + `enable-firewall.sh --check` clean          |
| Restore drill  | First proof done (weekly cadence continues)                          |
| Documentation  | Split repos, roadmap, architecture, install journal                  |
| Git            | Lab repos pushed to `nasraldin/*`                                    |

---

## Deferred (⏸️)

| Task                         | Reason                               | When to resume                                             |
| ---------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Storage `aux01` (OEM Slot 3) | OEM NVMe **not installed** in Slot 3 | Install disk → `terraform apply` for `aux01`               |
| Stage 2 `aux-backup` migrate | Blocked on `aux01`                   | After `aux01` exists — [backups.md](operations/backups.md) |

---

## Next (⏳ Phase 2+)

| #   | Task                          | Where    |
| --- | ----------------------------- | -------- |
| 1   | GitLab VM                     | Phase 2  |
| 2   | DNS VMs (AdGuard, Technitium) | Phase 3  |
| 3+  | kubeadm, Argo CD, platform    | Phase 6+ |

**Active focus** — Phase 2–3. Do **not** start Kubernetes until GitLab + DNS are in place ([foundation sequence](roadmap/foundation-sequence.md) steps 11–12).

---

## Decisions locked (won’t redo)

| Topic       | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Hypervisor  | Proxmox VE 9.x on ZFS                                         |
| VM disks    | **`data01` (FURY) only** — not `rpool`                        |
| Kubernetes  | **kubeadm** on Debian VMs (CKA) — not k3s for primary cluster |
| Ingress     | **NGINX** — not Traefik                                       |
| GitOps      | Argo CD after cluster exists                                  |
| Registry    | Harbor (proxy cache + CI push)                                |
| GitLab      | **Dedicated VM** — not inside k8s                             |
| Public UI   | Tunnel → Proxmox — not WAN `:8006`                            |
| GPU / IOMMU | AMD: `iommu=pt` only (no `amd_iommu=on`); VFIO later for 890M |
| Updates     | Check + notify; **manual** hypervisor upgrade                 |
| ITSM        | Zammad for customer tickets; **n8n automates only**           |

Full log: [decisions/log.md](decisions/log.md)

---

## Repository status

| Repo                | Role                       | Git    | Applied on node                   |
| ------------------- | -------------------------- | ------ | --------------------------------- |
| `homelab-docs`      | Plans, story, architecture | synced | n/a                               |
| `proxmox-bootstrap` | Layer 0 host               | synced | ✅ (+ firewall)                   |
| `terraform-lab`     | Layer 1–2 infra            | synced | ✅ `data01` / Stage 1; ⏸️ `aux01` |
| `cloudflare-tunnel` | Remote UI                  | synced | ✅                                |
| `ansible-lab`       | Unattended install media   | synced | n/a yet                           |

---

## Validate node (anytime)

Copy-paste checks: [installation/verified-state.md](installation/verified-state.md)

```bash
cd ~/homelab/proxmox-bootstrap && ./mac/bootstrap.sh --remote --check
cd ~/homelab/proxmox-bootstrap && ./mac/enable-firewall.sh --check
```
