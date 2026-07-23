# Finish the Foundation Before You Touch Kubernetes

Ordered foundation checklist, corrected for X1 Pro hardware and the current
repos. Do not start Kubernetes until the core foundation steps are ✅ (or ⏸️
with a documented hold). Read [current state](../current-state.md) for the live
board; use [installation/next-steps.md](../installation/next-steps.md) for
remaining commands.

**Status:** Phase 0 ✅ closed · DNS VMs ✅ · IPv4 DHCP → AdGuard ✅ ·
GitLab Omnibus + runner ✅ · `aux01` ⏸️ · OPNsense ⏸️ archived · next =
kubeadm (optional NetBird/Vault).

## What this page covers

- Steps that must be green before kubeadm
- Later steps (kubeadm, GitOps, platform) once the foundation holds
- Phase 0 complete except deferred `aux01`
- Planning corrections vs early drafts (slots, disks, kubeadm, updates)

| #   | Step                                              | Status  | Where                                                                                                                                          |
| --- | ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Proxmox installation (990 PRO only)               | ✅      | Official installer                                                                                                                             |
| 2   | Host bootstrap                                    | ✅      | `proxmox-bootstrap`                                                                                                                            |
| 3   | Daily update check                                | ✅      | `install-update-automation.sh`                                                                                                                 |
| 4   | Storage `data01` (FURY 4 TB)                      | ✅      | `terraform apply`                                                                                                                              |
| 5   | Storage `aux01` (OEM 2 TB, Slot 3)                | ⏸️      | **Hold** — OEM NVMe not installed; resume when Slot 3 is populated                                                                             |
| 6   | Backup jobs (`local-backup` → `aux-backup` later) | ✅ / ⏸️ | Stage 1 `local-backup` ✅; Stage 2 migrate ⏸️ blocked on `aux01`                                                                               |
| 7   | Cloudflare Tunnel                                 | ✅      | `cloudflare-tunnel`                                                                                                                            |
| 8   | Host firewall                                     | ✅      | `enable-firewall.sh`                                                                                                                           |
| 9   | Weekly restore drills                             | ✅      | First proof done — keep weekly cadence ([runbook](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md)) |
| 10  | Bootstrap drift check                             | ✅      | `bootstrap.sh --check` clean (re-run after host changes)                                                                                       |
| 11  | DNS VMs (AdGuard, Technitium)                     | ✅      | Debian 13 on `data01`; Ansible guest roles; directed dig proofs green                                                                          |
| 12  | IPv4 DHCP → AdGuard                               | ✅      | TP-Link primary DNS = `192.168.68.10`                                                                                                          |
| 13  | IPv6 DNS polish (Deco has no RDNSS UI)            | ✅      | Mac Wi-Fi DNS pinned to AdGuard; see [dns-dhcp-cutover.md](../operations/dns-dhcp-cutover.md)                                                  |
| 14  | OPNsense VLAN Pilot                               | ⏸️      | archived 2026-07-23 — restore from `archive/opnsense-vlan-pilot` if needed                                                                     |
| 15  | NetBird remote access                             | ⏳      | optional; Cloudflare Tunnel remains primary remote path                                                                                        |
| 16  | Vault                                             | ⏳      | optional                                                                                                                                       |
| 17  | GitLab Omnibus + runner VM                        | ✅      | `gitlab-01` `.14` + `runner-01` `.15`; [spec](../superpowers/specs/2026-07-23-gitlab-omnibus-design.md)                                        |
| 18  | kubeadm Stage A (1 CP + 2 workers)                | ⏳      | after GitLab CI path; [kubeadm](../kubernetes/kubeadm-architecture.md)                                                                         |
| 19  | GitOps (Argo CD)                                  | ⏳      | Phase 7                                                                                                                                        |
| 20  | Platform services                                 | ⏳      | Phases 8+                                                                                                                                      |

## Next approved sequence

Keep the lab simple on the flat TP-Link LAN with AdGuard + Technitium. Stand up
GitLab next so CI can drive Terraform. NetBird and Vault are optional. Then
kubeadm Stage A. See [phases.md](phases.md).

Preserve throughout: TP-Link edge, live `192.168.68.0/22`, `pve01` `.13`,
AdGuard `.10`, Technitium `.11`, and Cloudflare Tunnel.

When Slot 3 OEM disk is installed:

```bash
cd ~/homelab/terraform-lab
# enable aux01 in terraform.tfvars, then:
terraform plan
terraform apply
# then migrate Stage 1 backups → aux-backup (see operations/backups.md)
```

## Planning corrections (vs early ChatGPT drafts)

| Topic              | Early plan            | This lab                                                     |
| ------------------ | --------------------- | ------------------------------------------------------------ |
| M.2 slots          | Two slots             | **Three** — Slot 3 is PCIe ×1; OEM 2 TB for `aux01`          |
| Slot 2 disk        | Kingston 4 TB generic | **FURY Renegade 4 TB** → `data01`                            |
| Kubernetes         | k3s / Talos first     | **kubeadm** on Debian ([kubernetes](../kubernetes/index.md)) |
| Updates            | n8n or cron primary   | **systemd + scripts**; n8n optional                          |
| Automation applied | Implied done          | **✅ applied** (except `aux01` ⏸️)                           |
| OPNsense / VLANs   | Required early        | **Archived** until segmentation is needed                    |

See [build-story.md](../build-story.md) for the full narrative.
