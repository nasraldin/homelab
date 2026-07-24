# Core guest inventory (VMID, IP, boot order)

Proxmox VMIDs follow Layer-1 foundation order. **LAN IPs keep historical last
octets** (VMID ≠ IP by design). Hardware defaults:
[vm-best-practices.md](../architecture/vm-best-practices.md).

Source of truth: `terraform-lab/terraform.tfvars` (`vms` map).

## Inventory

| VMID | Guest           | LAN   | Startup order | Role                                            |
| ---- | --------------- | ----- | ------------- | ----------------------------------------------- |
| 110  | `adguard-01`    | `.10` | 1 (+15 s)     | Recursive DNS / filtering                       |
| 111  | `technitium-01` | `.11` | 2 (+10 s)     | Authoritative `lab.nasraldin.com`               |
| 112  | `infra01`       | `.12` | 3             | Ops / management                                |
| 113  | `vault-01`      | `.18` | 5             | HashiCorp Vault OSS (Raft, Transit auto-unseal) |
| 114  | `vault-seal`    | `.19` | 4 (+20 s)     | Vault Transit seal helper (Shamir)              |
| 115  | `infisical-01`  | `.20` | 7             | Infisical (app env-secrets; LAN)                |
| 116  | `aistor-01`     | `.17` | 6             | AIStor Free (shared S3)                         |
| 117  | `gitlab-01`     | `.14` | 8             | GitLab CE Omnibus                               |
| 118  | `runner-01`     | `.15` | 9             | Light / untagged CI                             |
| 119  | `runner-02`     | `.16` | 10            | Heavy / tagged CI                               |
| 200+ | lab             | —     | —             | Experiments (`ubuntu`, …)                       |

Startup order is independent of VMID (`vault-seal` boots **before** `vault-01`).
All managed VMs use `on_boot = true`. DNS guests start first so the LAN has a
resolver before app VMs. That does **not** replace Ansible after a disk wipe —
see [lan-dns-resilience.md](lan-dns-resilience.md).

## In-place VMID rename (no destroy)

`vm_id` is ForceNew in the Proxmox provider. To reshuffle without wiping disks:

1. Stop + rename ZFS volumes + move conf via
   `terraform-lab/scripts/rename-vmid.sh` (two-phase via temp IDs `21x` if
   targets collide).
2. Update `vm_id` in `terraform.tfvars`.
3. `terraform state rm` + `terraform import 'module.vm["NAME"].proxmox_virtual_environment_vm.this' pve01/NEWID`.
4. `terraform plan` — expect in-place only.
5. Unseal Vault / seal helper if those guests were rebooted.

Detail: [vmid-rename runbook](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/vmid-rename.md).

### 2026-07 Vault pair + Infisical insert

Target map above. Vault family stays contiguous (**113–114**). If live guests
still use older IDs, rename **before** `terraform apply` or disks recreate:

| Guest          | Typical old VMID | New VMID            |
| -------------- | ---------------- | ------------------- |
| `vault-01`     | 113              | **113** (unchanged) |
| `vault-seal`   | 118              | **114**             |
| `infisical-01` | — (new)          | **115**             |
| `aistor-01`    | 114              | **116**             |
| `gitlab-01`    | 115              | **117**             |
| `runner-01`    | 116              | **118**             |
| `runner-02`    | 117              | **119**             |

## Recreate-safe Ansible (after disk wipe)

| Concern                        | Where                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| DNS restore                    | `playbooks/dns.yml` + [lan-dns-resilience.md](lan-dns-resilience.md)    |
| Runner mint / token dir        | `gitlab_omnibus` mint (`0770`); prefer minted tokens over stale secrets |
| Runner S3 cache TOML           | `gitlab_runner/files/fix_runner_cache.py`                               |
| Vault unseal                   | Seal helper Shamir; primary Transit — [vault.md](vault.md)              |
| Infisical                      | `playbooks/infisical.yml` · [infisical.md](infisical.md)                |
| AIStor buckets                 | `aistor_buckets` + `terraform-lab/object-storage/`                      |
| GitLab object_store + settings | `gitlab.rb.j2` + ApplicationSettings · [gitlab.md](gitlab.md)           |

## Related

- [dns-dhcp-cutover.md](dns-dhcp-cutover.md)
- [deploy-and-rebuild.md](deploy-and-rebuild.md)
