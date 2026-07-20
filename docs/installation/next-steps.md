# Close Phase 0: Commands Right After a Fresh Install

Command block to close Phase 0 after a verified fresh install. Manual install should already be ✅; everything below is still 🔄 until you run it on the node. Check [current state](../current-state.md) first, then come back here in order.

Read this after [verified state](verified-state.md). The same sequence is summarized in [foundation sequence](../roadmap/foundation-sequence.md) steps 2–8.

## What this page covers

- Host bootstrap (`proxmox-bootstrap`)
- Daily update-check automation
- Terraform storage pools and backup jobs
- Cloudflare Tunnel for the public UI
- Optional host firewall and backup restore proof

---

## 1. Host bootstrap (idempotent)

```bash
cd ~/homelab/proxmox-bootstrap
cp config.env.example config.env   # PVE_*, ADMIN_USER, NOTIFY_EMAIL, ZFS_ARC_MAX_GB=16
ssh-add ~/.ssh/pve01

./mac/bootstrap.sh --check
./mac/bootstrap.sh --remote --yes
```

Fixes: repos, ZFS autotrim, ARC cap, packages, admin user, notifications.

---

## 2. Update automation

```bash
./mac/install-update-automation.sh --yes
```

Daily **check** + notify; manual `./mac/apply-updates.sh` for upgrades.

---

## 3. Infrastructure as Code (storage + backups)

```bash
cd ~/homelab/terraform-lab
# terraform.tfvars: ssh_public_key, zfs_pools data01 + aux01, backup jobs
terraform init
terraform plan
terraform apply
```

Creates:

- **`data01`** — FURY 4 TB (all VM disks)
- **`aux01`** — OEM 2 TB Slot 3 (backups, ISO)
- **`local-backup`** — vzdump Stage 1 on rpool (migrate to aux later)
- Resource pools, backup job

Set Datacenter → Storage → **default for VM disks = `data01`**.

---

## 4. Remote access (from home LAN)

```bash
cd ~/homelab/cloudflare-tunnel
cp config.env.example config.env
./mac/bootstrap.sh --yes
```

Result: `https://homelab.example.com` → Access → Proxmox UI.

LAN Terraform/SSH stay on `pve01.lab.example.com`.

---

## 5. Optional host firewall

```bash
cd ~/homelab/proxmox-bootstrap
./mac/enable-firewall.sh --yes
```

---

## 6. Prove backups

Weekly [restore drill](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md).

---

## 7. Later phases (do not skip ahead)

| Order | Phase                         | Doc                                                              |
| ----- | ----------------------------- | ---------------------------------------------------------------- |
| 8     | DNS VMs (AdGuard, Technitium) | [phases.md §3](../roadmap/phases.md)                             |
| 9     | GitLab VM                     | [service-placement.md](../architecture/service-placement.md)     |
| 10    | kubeadm Stage A               | [kubeadm-architecture.md](../kubernetes/kubeadm-architecture.md) |
| 11    | Argo CD bootstrap             | [gitops-bootstrap.md](../kubernetes/gitops-bootstrap.md)         |

---

## What not to do manually

| Task                          | Tool               |
| ----------------------------- | ------------------ |
| Create `data01` / `aux01`     | Terraform          |
| VM / LXC disks                | Terraform          |
| vzdump jobs                   | Terraform          |
| In-cluster apps               | Argo CD (Phase 7+) |
| Unattended hypervisor upgrade | ❌                 |

See [platform-tooling.md](../platform-tooling.md).
