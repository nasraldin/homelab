# Close Phase 0: Commands Right After a Fresh Install

Command block used to close Phase 0 after a verified fresh install. **Host close-out on `pve01` is ✅** (July 2026) except `aux01` ⏸️. Check [current state](../current-state.md) first; use this page as the historical runbook + remaining steps.

Read this after [verified state](verified-state.md). The same sequence is summarized in [foundation sequence](../roadmap/foundation-sequence.md).

## What this page covers

- Host bootstrap (`proxmox-bootstrap`) — ✅ applied
- Daily update-check automation — ✅ applied
- Terraform storage pools and backup jobs — ✅ `data01` / Stage 1; ⏸️ `aux01`
- Cloudflare Tunnel — ✅ applied
- Host firewall — ✅ applied
- Remaining: GitLab Omnibus + runner → optional NetBird/Vault → kubeadm;
  `aux01` when Slot 3 disk arrives

---

## Status snapshot

| Step | Item                              | Status                |
| ---- | --------------------------------- | --------------------- |
| 1    | Host bootstrap                    | ✅                    |
| 2    | Update automation                 | ✅                    |
| 3    | `data01` + Stage 1 `local-backup` | ✅                    |
| 4    | Cloudflare Tunnel                 | ✅                    |
| 5    | Host firewall                     | ✅                    |
| 6    | Restore drill (first proof)       | ✅                    |
| 7    | Drift check                       | ✅                    |
| —    | `aux01` (OEM Slot 3)              | ⏸️ disk not installed |
| —    | DNS VMs                           | ✅                    |
| —    | IPv4 DHCP → AdGuard               | ✅                    |
| —    | IPv6 DNS polish                   | ✅ Mac pin (Deco has no RDNSS UI) |
| —    | OPNsense VLAN Pilot               | ⏸️ archived           |
| —    | GitLab Omnibus + runner           | ✅                    |
| —    | NetBird / Vault                   | ⏳ optional           |
| —    | kubeadm Stage A                   | ⏳ after GitLab       |

---

## 1. Host bootstrap (idempotent) ✅

```bash
cd ~/homelab/proxmox-bootstrap
cp config.env.example config.env   # PVE_*, ADMIN_USER, NOTIFY_EMAIL, ZFS_ARC_MAX_GB=16
ssh-add ~/.ssh/pve01

./mac/bootstrap.sh --check
./mac/bootstrap.sh --remote --yes
```

Fixes: repos, ZFS autotrim, ARC cap, packages, admin user, notifications,
IOMMU/`iommu=pt` for future GPU passthrough ([gpu-passthrough.md](../architecture/gpu-passthrough.md)).
Reboot if the report notes kernel/ARC/IOMMU changes.

---

## 2. Update automation ✅

```bash
./mac/install-update-automation.sh --yes
```

Daily **check** + notify; manual `./mac/apply-updates.sh` for upgrades.

---

## 3. Infrastructure as Code (storage + backups) ✅ / ⏸️

```bash
cd ~/homelab/terraform-lab
# terraform.tfvars: ssh_public_key, zfs_pools data01 (+ aux01 when disk present), backup jobs
terraform init
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
rm -f tfplan
```

Creates:

- **`data01`** — FURY 4 TB (all VM disks) — ✅ live
- **`aux01`** — OEM 2 TB Slot 3 (backups, ISO) — ⏸️ **hold until NVMe installed**
- **`local-backup`** — vzdump Stage 1 on rpool (migrate to aux later) — ✅ live
- Backup job — ✅ Stage 1

Set Datacenter → Storage → **default for VM disks = `data01`**.

---

## 4. Remote access (from home LAN) ✅

```bash
cd ~/homelab/cloudflare-tunnel
cp config.env.example config.env
./mac/bootstrap.sh --yes
```

Result: public hostname → Access → Proxmox UI.

LAN Terraform/SSH stay on `pve01.lab.nasraldin.com`.

---

## 5. Host firewall ✅

```bash
cd ~/homelab/proxmox-bootstrap
./mac/enable-firewall.sh --yes
```

Datacenter `policy_in=DROP`; node `enable=1` + LAN/loopback management rules.

---

## 6. Prove backups ✅

First restore proof done. Keep weekly [restore drill](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md) cadence.

---

## 7. When Slot 3 OEM disk arrives (⏸️ → apply)

1. Physically install OEM NVMe in Slot 3
2. Enable `aux01` in `terraform-lab` tfvars
3. `terraform apply`
4. Migrate Stage 1 backups → `aux-backup` per [backups.md](../operations/backups.md)

---

## 8. Later phases (do not skip ahead)

| Order | Phase                     | Status / boundary                                                        |
| ----- | ------------------------- | ------------------------------------------------------------------------ |
| 1     | DNS IPv6 polish (TP-Link) | ⏳ [dns-dhcp-cutover.md](../operations/dns-dhcp-cutover.md)              |
| 2     | NetBird remote access     | ⏳ optional; Cloudflare Tunnel remains primary                           |
| 3     | Vault                     | ⏳ optional                                                              |
| 4     | kubeadm Stage A           | ⏳ when ready — [foundation sequence](../roadmap/foundation-sequence.md) |

DNS VMs (AdGuard + Technitium) are ✅ on the flat live LAN. OPNsense/VLANs are
archived on `archive/opnsense-vlan-pilot`. Keep Mac on Wi-Fi; do not treat
edge cutover or VLANs as required for kubeadm practice.

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
