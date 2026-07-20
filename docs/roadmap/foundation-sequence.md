# Finish the Foundation Before You Touch Kubernetes

Ordered foundation checklist, corrected for X1 Pro hardware and the current repos. Do not start Kubernetes until steps **1–12** are ✅ (or ⏸️ with a documented hold). Read [current state](../current-state.md) for the live board; use [installation/next-steps.md](../installation/next-steps.md) for remaining commands.

**Status:** Phase 0 ✅ closed · DNS VMs ✅ · `aux01` ⏸️ (no Slot 3 NVMe) · next = GitLab + TP-Link DHCP cutover.

## What this page covers

- Steps 1–12 that must be green before kubeadm
- Later steps (kubeadm, GitOps, platform) once the foundation holds
- Phase 0 complete except deferred `aux01`
- Planning corrections vs early drafts (slots, disks, kubeadm, updates)

| #   | Step                                              | Status  | Where                                                                                                                                          |
| --- | ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Proxmox installation (990 PRO only)               | ✅      | USB                                                                                                                                            |
| 2   | Host bootstrap                                    | ✅      | `proxmox-bootstrap`                                                                                                                            |
| 3   | Daily update check                                | ✅      | `install-update-automation.sh`                                                                                                                 |
| 4   | Storage `data01` (FURY 4 TB)                      | ✅      | `terraform apply`                                                                                                                              |
| 5   | Storage `aux01` (OEM 2 TB, Slot 3)                | ⏸️      | **Hold** — OEM NVMe not installed; resume when Slot 3 is populated                                                                             |
| 6   | Backup jobs (`local-backup` → `aux-backup` later) | ✅ / ⏸️ | Stage 1 `local-backup` ✅; Stage 2 migrate ⏸️ blocked on `aux01`                                                                               |
| 7   | Cloudflare Tunnel                                 | ✅      | `cloudflare-tunnel`                                                                                                                            |
| 8   | Host firewall                                     | ✅      | `enable-firewall.sh`                                                                                                                           |
| 9   | Weekly restore drills                             | ✅      | First proof done — keep weekly cadence ([runbook](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md)) |
| 10  | Bootstrap drift check                             | ✅      | `bootstrap.sh --check` clean (re-run after host changes)                                                                                       |
| 11  | DNS VMs (AdGuard, Technitium)                     | ✅      | Debian 13 on `data01`; Ansible guest roles; dig proofs green — [cutover](../operations/dns-dhcp-cutover.md) still ⏳                            |
| 12  | GitLab VM                                         | ⏳      | Phase 2 — **next**                                                                                                                             |
| 13  | kubeadm Stage A (1 CP + 2 workers)                | ⏳      | [kubeadm](../kubernetes/kubeadm-architecture.md)                                                                                               |
| 14  | GitOps (Argo CD)                                  | ⏳      | Phase 7                                                                                                                                        |
| 15  | Platform services                                 | ⏳      | Phases 8+                                                                                                                                      |

## Next (Phase 2–3)

Apply [TP-Link DHCP DNS cutover](../operations/dns-dhcp-cutover.md) when ready, then build GitLab on `data01` via Terraform. See [phases.md](phases.md) and [service-placement.md](../architecture/service-placement.md).

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

See [build-story.md](../build-story.md) for the full narrative.
