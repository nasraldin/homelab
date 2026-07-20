# Backups

Practice production-like backup ops on **three-drive layout** (990 PRO + FURY + OEM).

**Enterprise mapping (Veeam-equivalent OSS):** [backup-platform.md](backup-platform.md)

## Stages

| Stage | Hardware | Proxmox storage ID | Status |
| ----- | -------- | ------------------ | ------ |
| **1 (now)** | 990 PRO `local-backup` | `local-backup` | 🟡 `terraform apply` |
| **2** | +4 TB aux NVMe (`aux01`) | `aux-backup` | 🔮 IaC + rsync script ready |
| **3** | Dell server | PBS datastore | 🔮 design only |

Layout: [hardware-and-storage.md](../architecture/hardware-and-storage.md).

---

## Stage 1 job (`daily-all`)

| Setting | Value |
| ------- | ----- |
| Schedule | 02:00 daily |
| Mode | snapshot |
| Compression | zstd |
| Retention | 7 daily, 4 weekly, 3 monthly |
| Storage | `local-backup` → `/var/lib/vz/backups` |
| Guest disks | **`data01` only** — never on backup datastore |

**Owner:** `terraform-lab` (`backup.tf`).

```bash
cd ~/homelab/terraform-lab && terraform apply
```

---

## Operations

| Cadence | Action |
| ------- | ------ |
| Daily | Automatic vzdump (after apply) |
| Weekly | **Restore drill** — VMID 999, verify, delete |
| On failure | Email via `NOTIFY_EMAIL` |

---

## Restore drill

[terraform-lab: backup-restore-drill.md](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md)

If you never restore, you do not have backups — only archives.

---

## Migrate to aux 4 TB (Stage 2)

1. Terraform: add `aux01` pool + `directory_storages`
2. Script: `terraform-lab/scripts/mac/migrate-backup-storage.sh`
3. Terraform: `backup_storage_id = "aux-backup"`
4. Restore drill on new storage
5. Cleanup old rpool archives

[Full migration runbook](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-storage-migration.md)

---

## Future

| Feature | Status |
| ------- | ------ |
| Post-backup verify + Discord/ntfy | ⏳ |
| Dell PBS (Stage 3) | 🔮 |

## References

- [terraform-lab: backup design](https://github.com/nasraldin/terraform-lab/blob/main/docs/design/2026-07-20-proxmox-backup-strategy-design.md)
- [proxmox-bootstrap: operations guide](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/13-complete-operations-guide.md)
