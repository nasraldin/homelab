# Finish the Foundation Before You Touch Kubernetes

Ordered foundation checklist, corrected for X1 Pro hardware and the current repos. Do not start Kubernetes until steps **1–12** are ✅. Read [current state](../current-state.md) for the live board; use [installation/next-steps.md](../installation/next-steps.md) for the Phase 0 command block.

**Status:** 🔄 Step 1 done; steps 2–12 🟡 (automation in Git, apply pending).

## What this page covers

- Steps 1–12 that must be green before kubeadm
- Later steps (kubeadm, GitOps, platform) once the foundation holds
- Phase 0 close-out commands to run now
- Planning corrections vs early drafts (slots, disks, kubeadm, updates)

| # | Step | Status | Where |
| - | ---- | ------ | ----- |
| 1 | Proxmox installation (990 PRO only) | ✅ | USB |
| 2 | Host bootstrap | 🟡 | `proxmox-bootstrap` |
| 3 | Daily update check | 🟡 | `install-update-automation.sh` |
| 4 | Storage `data01` (FURY 4 TB) | 🟡 | `terraform apply` |
| 5 | Storage `aux01` (OEM 2 TB, Slot 3) | 🟡 | same apply |
| 6 | Backup jobs (`local-backup` → `aux-backup` later) | 🟡 | `terraform apply` |
| 7 | Cloudflare Tunnel | 🟡 | `cloudflare-tunnel` |
| 8 | Host firewall (optional) | 🟡 | `enable-firewall.sh` |
| 9 | Weekly restore drills | ⏳ | [restore runbook](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md) |
| 10 | Bootstrap drift check | 🟡 | `bootstrap.sh --check` |
| 11 | DNS VMs (AdGuard, Technitium) | ⏳ | Phase 3 |
| 12 | GitLab VM | ⏳ | Phase 2 |
| 13 | kubeadm Stage A (1 CP + 2 workers) | ⏳ | [kubeadm](../kubernetes/kubeadm-architecture.md) |
| 14 | GitOps (Argo CD) | ⏳ | Phase 7 |
| 15 | Platform services | ⏳ | Phases 8+ |

## Phase 0 close-out (run now)

```bash
cd ~/homelab/proxmox-bootstrap
./mac/bootstrap.sh --remote --yes
./mac/install-update-automation.sh --yes

cd ~/homelab/terraform-lab && terraform apply

cd ~/homelab/cloudflare-tunnel && ./mac/bootstrap.sh --yes
```

## Planning corrections (vs early ChatGPT drafts)

| Topic | Early plan | This lab |
| ----- | ---------- | -------- |
| M.2 slots | Two slots | **Three** — Slot 3 is PCIe ×1; OEM 2 TB for `aux01` |
| Slot 2 disk | Kingston 4 TB generic | **FURY Renegade 4 TB** → `data01` |
| Kubernetes | k3s / Talos first | **kubeadm** on Debian ([kubernetes](../kubernetes/README.md)) |
| Updates | n8n or cron primary | **systemd + scripts**; n8n optional |
| Automation applied | Implied done | **🟡 in Git** — must run on node |

See [build-story.md](../build-story.md) for the full narrative.
