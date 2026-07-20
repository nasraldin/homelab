# Set Up Proxmox Storage Across Three NVMe Drives

Install Proxmox on the 990 PRO only; add the FURY and OEM pools after bootstrap. Production guest disks stay on `data01` — never on the OS pool — so backups and ISO staging can live on `aux01` without competing with the hypervisor.

## What this page covers

- Install-time ZFS choices for Slot 1 only
- Which filesystem belongs where (and why VM disks stay on ZFS `data01`)
- How to use free space on `rpool` without putting guests there
- Post-install order: bootstrap → Terraform pools → backup jobs
- ZFS properties, host packages, BIOS, VM defaults, and RAM budget

| Slot | Disk                        | Role                                   |
| ---- | --------------------------- | -------------------------------------- |
| 1    | Samsung 990 PRO 2 TB        | `rpool` — hypervisor only              |
| 2    | Kingston FURY Renegade 4 TB | `data01` — **all production VM disks** |
| 3    | Kingston OM8TAP 2 TB        | `aux01` — backups, ISO, archive        |

## Install-time choices (Slot 1 only)

During USB install, select **only the 990 PRO** (verify serial, not `/dev/nvme0n1` order).

| Setting     | Value                                            |
| ----------- | ------------------------------------------------ |
| Filesystem  | **ZFS (RAID0)** — single disk                    |
| `ashift`    | **12** (4K — cannot change later)                |
| Compression | **lz4**                                          |
| Swap        | **8 GB** (96 GB RAM — do not allocate huge swap) |
| FQDN        | `pve01.lab.example.com`                          |
| IP          | Static `192.168.1.10/24`                         |

Details: [proxmox-bootstrap/docs/01-install.md](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/01-install.md).

**Never** include the FURY or OEM disk in the installer — add them **after** post-install via Terraform or `zpool create`.

---

## Filesystem strategy (what to use where)

| Location          | FS / type             | Use for                         | VM disks?               |
| ----------------- | --------------------- | ------------------------------- | ----------------------- |
| `rpool` (990 PRO) | ZFS                   | Proxmox OS, DB, snippets        | ❌ production VMs       |
| `data01` (FURY)   | ZFS pool              | VM/LXC disks, k8s nodes         | ✅ **yes — all guests** |
| `aux01` (OEM)     | ZFS or **directory**  | vzdump, ISO, templates, scratch | ⚠️ lab VMs only         |
| vzdump targets    | **Directory** storage | Backup files                    | N/A                     |

**Rule:** VM disks = **ZFS on `data01`** (`zfspool` in Proxmox). Backups = **directory** on `aux01` (or `local-backup` on rpool until Stage 2).

Do **not** use ext4 for the main VM pool — you lose ZFS snapshots per VM, send/receive, and consistent vzdump behaviour.

---

## Using the “empty” 990 PRO space (~1.8 TB free)

Proxmox OS uses ~20–40 GB. The rest of `rpool` is **not useless** — but **do not** fill it with production VM disks.

### What belongs on `rpool`

| Dataset / storage ID | Size guide              | Purpose                                    |
| -------------------- | ----------------------- | ------------------------------------------ |
| `local` (default)    | ~20 GB                  | Snippets, small cloud-init, tiny templates |
| `local-backup`       | **200–400 GB quota**    | vzdump Stage 1 (migrate to `aux01` later)  |
| ISO overflow         | Rest or move to `aux01` | Installer ISOs (keep 2–3 active)           |

### What does **not** belong on `rpool`

| Avoid                  | Why                                                     |
| ---------------------- | ------------------------------------------------------- |
| k8s node disks         | Competes with OS; no room to grow; wrong failure domain |
| GitLab data            | Large, I/O heavy — use `data01`                         |
| Longhorn backing store | Use dedicated vdisks on `data01` workers                |

### ZFS quotas (recommended)

On `rpool`, cap backup dataset so a full vzdump cannot fill the OS pool:

```bash
# Example after creating backup dataset — adjust names to match your layout
zfs set quota=400G rpool/backup
zfs set reservation=10G rpool/ROOT/pve-1   # optional: protect OS dataset
```

**Professional pattern:** `rpool` = hypervisor + **bounded** backup staging. **All guests** on `data01`.

---

## Post-install storage setup (order)

### 1. Run bootstrap (before VMs)

```bash
cd ~/homelab/proxmox-bootstrap
cp config.env.example config.env   # edit PVE_*, ADMIN_USER, NOTIFY_EMAIL
./mac/bootstrap.sh --remote --yes
```

Bootstrap sets: repos, ZFS tune (`lz4`, `atime=off`, `autotrim`), **ARC cap 16 GB**, packages, admin user, mail.

### 2. Add FURY + OEM via Terraform

```bash
cd ~/homelab/terraform-lab
# zfs_pools: data01 (FURY), aux01 (OEM) in terraform.tfvars
terraform apply
```

Target Proxmox storage IDs:

| Proxmox ID             | Backend             | Content types                        |
| ---------------------- | ------------------- | ------------------------------------ |
| `local`                | `rpool` dir         | iso, vztmpl, snippets                |
| `local-zfs` or `rpool` | ZFS                 | avoid for new VMs — legacy           |
| `data01`               | ZFS zfspool on FURY | **images, rootdir** (VM + LXC disks) |
| `local-backup`         | directory on rpool  | backup (Stage 1)                     |
| `aux-backup`           | directory on aux01  | backup (Stage 2)                     |
| `aux-media`            | directory on aux01  | iso, vztmpl (optional)               |

In **Datacenter → Storage**: set **Default** for VM disks to **`data01`**.

### 3. Backup job

Terraform `backup.tf` — daily vzdump to `local-backup`, guests on `data01` only. Migrate to `aux-backup` when Slot 3 is ready.

---

## ZFS properties (all pools)

Applied by `proxmox-bootstrap` — verify after install:

| Property      | Value    |
| ------------- | -------- |
| `ashift`      | 12       |
| `compression` | lz4      |
| `atime`       | off      |
| `xattr`       | sa       |
| `acltype`     | posixacl |
| `autotrim`    | on       |

**ARC:** `ZFS_ARC_MAX_GB=16` in `config.env` — leaves RAM for VMs on 96 GB host.

---

## Host packages (after bootstrap)

Already installed by bootstrap:

`curl wget vim htop iotop git tmux jq unzip rsync net-tools lm-sensors smartmontools nvme-cli chrony`

**Optional adds** (install manually if you want):

```bash
ssh <ADMIN_USER>@pve01.lab.example.com
sudo apt install -y btop ncdu bat ripgrep
```

| Tool         | Purpose                                  |
| ------------ | ---------------------------------------- |
| **btop**     | Modern resource monitor (nicer than top) |
| **ncdu**     | Disk usage on rpool/aux                  |
| **nvme-cli** | Already there — `nvme smart-log` health  |
| **k9s**      | On **Mac**, not Proxmox — cluster UI     |

Do **not** install Docker on the Proxmox host — VMs only.

---

## BIOS (once)

| Setting           | Value                          |
| ----------------- | ------------------------------ |
| SVM (AMD-V)       | Enable                         |
| IOMMU / AMD-Vi    | Enable                         |
| SR-IOV            | Enable (harmless until needed) |
| Above 4G Decoding | Enable                         |
| TPM / fTPM        | Enable                         |

Kernel after install: add **`iommu=pt`** only (not `amd_iommu=on`) —
[gpu-passthrough.md](gpu-passthrough.md).

---

## VM defaults (Proxmox)

| Setting         | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| CPU type        | **host** (or x86-64-v2-AES if you need migration)             |
| Machine         | q35                                                           |
| BIOS            | OVMF only if UEFI guest needs it; Debian cloud = SeaBIOS fine |
| SCSI controller | VirtIO SCSI single                                            |
| Disk bus        | **SCSI** + **Discard** + **SSD** flag on NVMe pool            |
| Network         | VirtIO on `vmbr0`                                             |
| QEMU agent      | Enabled (cloud images)                                        |
| Disk storage    | **`data01`** always                                           |

---

## RAM budget (96 GB example)

| Consumer                   | RAM                |
| -------------------------- | ------------------ |
| Proxmox + ZFS ARC (capped) | ~20 GB             |
| GitLab VM                  | 8 GB               |
| HAProxy VM                 | 2 GB               |
| 3× kubeadm CP              | 12 GB (4 GB each)  |
| 2× workers                 | 24 GB (12 GB each) |
| Headroom                   | ~30 GB             |

Start **Stage A** (1 CP + 2 workers) if tight; expand to 3 CP when stable.

---

## Related

- [hardware-and-storage.md](hardware-and-storage.md)
- [service-placement.md](service-placement.md)
- [backups.md](../operations/backups.md)
- [kubeadm architecture](../kubernetes/kubeadm-architecture.md)
