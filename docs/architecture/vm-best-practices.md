# Proxmox VE 9 guest defaults (VM + CT)

Lab standard for every new guest. Hardware settings live in
`terraform-lab/modules/vm` so destroy/recreate stays consistent — do not
special-case SeaBIOS or VirtIO Block in the Proxmox UI.

| Companion doc                                                | Topic                                         |
| ------------------------------------------------------------ | --------------------------------------------- |
| [guest-vmid-map.md](../operations/guest-vmid-map.md)         | VMID 110–117, startup order, IPs              |
| [lan-dns-resilience.md](../operations/lan-dns-resilience.md) | Why DNS VM replace looks like “internet down” |
| [proxmox-storage-layout.md](proxmox-storage-layout.md)       | Pools + short defaults table                  |
| [gpu-passthrough.md](gpu-passthrough.md)                     | Same baseline + `hostpci`                     |

## Why the three “big” choices matter

### Machine: q35 vs i440fx

| Type    | Use                                               |
| ------- | ------------------------------------------------- |
| **q35** | Default — modern PCIe, GPU/NVMe passthrough, UEFI |
| i440fx  | Legacy guests only (old Windows / CentOS 6-era)   |

### Firmware: OVMF (UEFI) vs SeaBIOS

| Firmware        | Use                                                     |
| --------------- | ------------------------------------------------------- |
| **OVMF (UEFI)** | Default — GPT, Secure Boot capable, modern cloud images |
| SeaBIOS         | Legacy only                                             |

OVMF requires an EFI disk (`efi_disk` in Terraform).

### Discard (TRIM)

When the guest deletes data, Discard tells the hypervisor those blocks are free
so ZFS / LVM-Thin can reclaim space on SSD/NVMe. Enable for this lab’s `data01`
pool.

```text
Without Discard: guest deleted 20 GB → storage still shows 20 GB allocated
With Discard:    guest deleted 20 GB → thin pool can reclaim
```

## VM template (encoded in Terraform)

| Setting          | Value                                           |
| ---------------- | ----------------------------------------------- |
| Guest OS type    | Linux 6.x (`l26`)                               |
| BIOS             | **OVMF (UEFI)** + EFI disk type `4m`            |
| Machine          | **q35**                                         |
| SCSI controller  | **VirtIO SCSI Single**                          |
| Disk bus         | **SCSI** (`scsi0`) — not VirtIO Block           |
| Cache            | **none**                                        |
| SSD emulation    | On                                              |
| Discard          | On                                              |
| IO thread        | On                                              |
| CPU              | **host**, sockets `1`                           |
| Network          | **VirtIO** on `vmbr0`                           |
| QEMU Guest Agent | Enabled (TF + cloud-init / Ansible)             |
| Ballooning       | Off (no floating memory)                        |
| Start on boot    | **On** (`on_boot = true`)                       |
| Startup order    | Set per guest in `terraform.tfvars` (DNS first) |

Source: `terraform-lab/modules/vm/main.tf`.

### Sizing guidance

| Workload        | Cores | RAM      | Disk                     |
| --------------- | ----- | -------- | ------------------------ |
| Small utility   | 2     | 4 GiB    | 32 GiB                   |
| Docker host     | 4     | 8 GiB    | 60–100 GiB               |
| GitLab CE       | 4–8   | 8–16 GiB | 100 GiB+                 |
| Kubernetes node | 4+    | 8 GiB+   | 60 GiB+ OS (+ data disk) |

QEMU Guest Agent install is automated via vendor-data / Ansible — see
[guest-os](../guest-os/index.md#qemu-guest-agent).

## Boot order on `pve01`

After a **host** reboot, Proxmox starts guests by `startup` order (not by VMID):

| Order | Guest           | Delay after start |
| ----- | --------------- | ----------------- |
| 1     | `adguard-01`    | 15 s              |
| 2     | `technitium-01` | 10 s              |
| 3     | `infra01`       | —                 |
| 4     | `vault-seal`    | 20 s              |
| 5     | `vault-01`      | —                 |
| 6     | `aistor-01`     | —                 |
| 7     | `infisical-01`  | —                 |
| 8     | `gitlab-01`     | —                 |
| 9–10  | runners         | —                 |

Autostart brings the **VM** up. Application configuration still comes from
Ansible after a disk wipe.

## LXC containers (CT)

No OVMF/q35. Prefer **VMs** for Docker, GitLab, Vault, AIStor, and Kubernetes
nodes. If you enable a CT in `terraform.tfvars`: unprivileged by default,
minimal features, disk on `data01`, network on `vmbr0`.

## Destroy / replace (professional checklist)

Terraform `-replace` or ForceNew attribute changes **wipe the guest disk**.

| Guest class                             | Before apply                                                | After apply                                                                     |
| --------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **DNS** (`adguard-01`, `technitium-01`) | Router Secondary = `1.1.1.1`; Mac: `dns-failover-public.sh` | `dns.yml` → `dns-restore-adguard.sh`; clear SSH host keys                       |
| **Vault**                               | Offline copy of seal Shamir + primary recovery keys         | Unseal `vault-seal` first; primary Transit — [vault.md](../operations/vault.md) |
| **AIStor / GitLab / runners**           | Note: data and tokens reset                                 | `object-storage.yml` / `gitlab.yml`                                             |

Full DNS outage analysis: [lan-dns-resilience.md](../operations/lan-dns-resilience.md).

Also expect new SSH host keys (`ssh-keygen -R 192.168.68.N`) and minted runner
tokens preferred over stale `secrets.yml` values.

## Anti-patterns

| Don’t                                    | Do                                    |
| ---------------------------------------- | ------------------------------------- |
| Create production lab VMs only in the UI | Add to `terraform.tfvars` and apply   |
| SeaBIOS + q35 mix for Debian cloud       | Keep module defaults                  |
| VirtIO Block + SSD flag                  | SCSI + VirtIO SCSI Single             |
| Empty router Secondary DNS               | Primary AdGuard + Secondary `1.1.1.1` |
| Replace DNS VMs without failover         | Scripts + router Secondary first      |
| Assume `on_boot` installs apps           | Re-run Ansible after wipe             |

## Related

- [deploy-and-rebuild.md](../operations/deploy-and-rebuild.md)
- [platform-tooling.md](../platform-tooling.md)
- [terraform-lab runbook: VMID rename](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/vmid-rename.md)
