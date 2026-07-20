# Prep AMD GPU Passthrough for AI VMs (IOMMU)

Host prep so the **Radeon 890M** iGPU on `pve01` can eventually be passed into AI
VMs (Ollama, ROCm guests, etc.). Two stages:

1. **Host** — BIOS + `iommu=pt` (done via `proxmox-bootstrap` `check_iommu`)
2. **Per VM** — VFIO + `hostpci` only when that guest needs the GPU

**Owner (host):** [`proxmox-bootstrap`](https://github.com/nasraldin/proxmox-bootstrap)
(`check_iommu`).  
**Owner (guest attach):** [`terraform-lab`](https://github.com/nasraldin/terraform-lab)
(preferred) or documented `qm` one-shot — not a random host script.  
**Official reference:** [Proxmox PCI(e) Passthrough](<https://pve.proxmox.com/wiki/PCI(e)_Passthrough>).

## What this page covers

- What is correct on **AMD** vs common blog mistakes
- BIOS + kernel cmdline (`iommu=pt`) and how to verify after reboot
- **How to enable GPU passthrough on any VM when you need it**
- What stays out of scope until first AI VM

---

## Hardware (this lab)

| Piece | Detail                                                          |
| ----- | --------------------------------------------------------------- |
| CPU   | AMD Ryzen AI 9 HX 470 (AMD-V / AMD-Vi)                          |
| GPU   | Radeon 880M / 890M iGPU — `c6:00.0` `[1002:150e]`               |
| Use   | Future **AI VMs** (passthrough); host keeps `amdgpu` until then |

Passing the iGPU to a VM means the **host loses that GPU** while the guest owns
it. Keep SSH to `pve01` working (no reliance on local GUI).

---

## Official truth (do not cargo-cult blogs)

| Claim you may see                              | Official / correct                                            |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Add `amd_iommu=on`                             | **Wrong** — noop on AMD; Proxmox **removed** it from the docs |
| AMD needs a special “enable IOMMU” kernel flag | **No** — AMD IOMMU is **on by default** in the kernel         |
| What to add for passthrough DMA                | **`iommu=pt`**                                                |
| Intel (if you ever use it)                     | `intel_iommu=on` (older kernels) + `iommu=pt`                 |
| BIOS                                           | Enable **IOMMU / AMD-Vi** (and SVM)                           |

Also enable in BIOS (once): SR-IOV, Above 4G Decoding — see
[hardware-and-storage.md](hardware-and-storage.md#bios-5-year-homelab).

---

## Boot path on `pve01` (ZFS + UEFI)

This node boots **systemd-boot via `proxmox-boot-tool`**, not GRUB for the
running kernel.

| File                                               | Role                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/etc/kernel/cmdline`                              | **Active** cmdline source                                                                 |
| `proxmox-boot-tool refresh`                        | Writes EFI boot entries after edits                                                       |
| `/etc/default/grub` → `GRUB_CMDLINE_LINUX_DEFAULT` | Kept in sync safely (only that value); alone it would **not** change `/proc/cmdline` here |

Expected after bootstrap apply + reboot:

```text
# /etc/kernel/cmdline (example)
root=ZFS=rpool/ROOT/pve-1 boot=zfs iommu=pt

# /etc/default/grub (example — other lines untouched)
GRUB_CMDLINE_LINUX_DEFAULT="quiet iommu=pt"
```

---

## Apply host prep (bootstrap)

```bash
cd ~/homelab/proxmox-bootstrap
# config.env: PVE_IOMMU=1  (default on; set 0 to skip)

./mac/bootstrap.sh --remote --check   # report: AMD, groups, GPU, missing iommu=pt?
./mac/bootstrap.sh --remote --yes     # adds iommu=pt + proxmox-boot-tool refresh
# reboot when the report says NOTE reboot required
```

---

## Verify after reboot (host)

```bash
ssh pve01 'cat /proc/cmdline'                    # must include iommu=pt
ssh pve01 'dmesg | grep -F AMD-Vi | head'
ssh pve01 'find /sys/kernel/iommu_groups -mindepth 1 -maxdepth 1 | wc -l'
ssh pve01 'lspci -nnk | grep -A3 -iE "VGA|Display"'
```

Also: `./mac/bootstrap.sh --remote --check` → **IOMMU / GPU passthrough** all `[ OK ]`
for `iommu=pt`.

---

## Enable GPU passthrough on a VM (when you need it)

Do this **only** for the guest that should own the GPU (e.g. an AI VM). Do **not**
attach the iGPU to every VM.

### Prerequisites

- [ ] Host checks above pass (`iommu=pt`, AMD-Vi, IOMMU groups)
- [ ] You can reach `pve01` over SSH without needing the iGPU on the host
- [ ] Target VM exists on **`data01`** (Terraform); note **VMID**
- [ ] Guest has [QEMU Guest Agent](../guest-os/#qemu-guest-agent) (IP/shutdown UX)

### 1. Confirm PCI address and IOMMU group

```bash
ssh pve01 'lspci -nn | grep -iE "VGA|Display|Audio"'
# example: c6:00.0 ... [1002:150e]  (GPU)
#          c6:00.1 ...              (HDMI audio — often pass with “All Functions”)
```

Prefer passing the **whole function group** (`c6:00`) so GPU + audio stay together.

### 2. Host VFIO (first GPU VM only)

Load VFIO modules and keep them across reboot (once per host):

```bash
ssh pve01 'grep -E "^(vfio|vfio_iommu_type1|vfio_pci)$" /etc/modules || \
  printf "%s\n" vfio vfio_iommu_type1 vfio_pci | tee -a /etc/modules'
ssh pve01 'update-initramfs -u -k all'
```

When the guest should **own** the iGPU, stop the host from binding `amdgpu`
(otherwise passthrough fights the host driver). Typical approach (document the
exact IDs from `lspci -nn` before applying):

```bash
# Example — adjust IDs to match lspci -nn on YOUR node
ssh pve01 'cat >/etc/modprobe.d/vfio-amd-igpu.conf <<EOF
options vfio-pci ids=1002:150e
blacklist amdgpu
EOF
update-initramfs -u -k all'
# reboot pve01 before starting the GPU VM
```

Until you need passthrough, **skip** blacklisting so the host can keep `amdgpu`.

### 3. Attach GPU to the VM (prefer Terraform)

**Preferred:** encode in `terraform-lab` (VM `hostpci` / machine `q35`) so recreate
is repeatable. Manual UI/`qm` is for a one-shot experiment only — then fold into
Terraform.

**Proxmox UI**

1. Stop the VM
2. Hardware → **Add** → **PCI Device**
3. Select the GPU (`c6:00.0` or raw `c6:00` all functions)
4. Enable **PCI-Express**, **All Functions** (if audio should follow)
5. Optional: **Primary GPU** / ROM-Bar per guest needs
6. Machine type **q35**; use **OVMF (UEFI)** if the guest needs it for GPU
7. Start VM; install guest GPU drivers (AMD ROCm / mesa as required)

**CLI sketch** (replace `VMID`):

```bash
ssh pve01 "qm set VMID -machine q35"
ssh pve01 "qm set VMID -hostpci0 c6:00,pcie=1"
# Primary GPU for that guest (optional):
# ssh pve01 "qm set VMID -hostpci0 c6:00,pcie=1,x-vga=1"
ssh pve01 "qm start VMID"
```

### 4. Verify inside guest and on host

```bash
# Host: device should show vfio-pci when passed through
ssh pve01 'lspci -nnk -s c6:00.0'

# Guest (SSH into the VM):
lspci -nn | grep -iE 'VGA|Display'
```

### 5. Detach / give GPU back to host

1. Stop the VM and remove the PCI device (UI or Terraform)
2. Remove or comment `blacklist amdgpu` / vfio-pci ids if you added them
3. `update-initramfs -u -k all` and reboot host if needed
4. Confirm `lspci -nnk -s c6:00.0` shows `amdgpu` again on the host

---

## Do not

| Anti-pattern                                            | Why                                          |
| ------------------------------------------------------- | -------------------------------------------- |
| Add `amd_iommu=on`                                      | Noop; wrong guidance                         |
| Edit only `/etc/default/grub` on this node              | Active boot is `/etc/kernel/cmdline`         |
| Pass GPU to multiple VMs at once                        | One owner at a time on this iGPU             |
| Skip Terraform and leave a snowflake `qm set`           | Drift; next rebuild loses the VM             |
| Rely on NoVNC to see the passed-through GPU framebuffer | Not supported — use SSH/RDP inside the guest |

---

## Related

- Guest agent (IP/shutdown in UI): [guest-os — QEMU Guest Agent](../guest-os/#qemu-guest-agent)
- Tool ownership: [platform-tooling.md](../platform-tooling.md)
- Service placement (Ollama): [service-placement.md](service-placement.md)
- Bootstrap detail: [proxmox-bootstrap 02-post-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/02-post-install.md)
