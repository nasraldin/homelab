# Back Up Every VM in Stages and Drill Restores

VM backups grow with the three-drive layout (990 PRO + FURY + OEM): start on `local-backup`, move to aux NVMe, then PBS on separate hardware. Schedule and retention matter less than restore drills — archives you never restore are not backups.

For the Veeam-style OSS map (PBS, Velero, MinIO), see [backup-platform.md](backup-platform.md).

## What this page covers

- Stage 1–3 storage targets and status
- `daily-all` vzdump job settings (terraform-lab)
- How to run vzdump **manually** and confirm archives landed
- Weekly restore drill cadence
- Migration steps to aux 4 TB storage

## Stages

| Stage       | Hardware                   | Proxmox storage ID | Status                                  |
| ----------- | -------------------------- | ------------------ | --------------------------------------- |
| **1 (now)** | 990 PRO `local-backup`     | `local-backup`     | ✅ applied (`daily-all`)                |
| **2**       | +OEM 2 TB Slot 3 (`aux01`) | `aux-backup`       | ⏸️ hold — NVMe not installed; IaC ready |
| **3**       | Dell server                | PBS datastore      | 🔮 design only                          |

Layout: [hardware-and-storage.md](../architecture/hardware-and-storage.md).

---

## Stage 1 job (`daily-all`)

| Setting     | Value                                         |
| ----------- | --------------------------------------------- |
| Schedule    | 02:00 daily                                   |
| Mode        | snapshot                                      |
| Compression | zstd                                          |
| Retention   | 7 daily, 4 weekly, 3 monthly                  |
| Storage     | `local-backup` → `/var/lib/vz/backups`        |
| Guest disks | **`data01` only** — never on backup datastore |

**Owner:** `terraform-lab` (`backup.tf`).

```bash
cd ~/homelab/terraform-lab && terraform apply
```

---

## Run vzdump manually (do not wait for 02:00)

Full runbook: [terraform-lab: manual-vzdump.md](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/manual-vzdump.md)

You need at least one VM/CT. Storage target is always **`local-backup`**.

### UI

Datacenter → Backup → **`daily-all`** → **Run now**  
(or guest → Backup now → storage `local-backup`, snapshot, zstd)

### CLI

```bash
# One VM
ssh pve01 'vzdump 101 --mode snapshot --compress zstd --storage local-backup'

# All guests (same idea as the scheduled job)
ssh pve01 'vzdump --all --mode snapshot --compress zstd --storage local-backup'
```

### Confirm archives landed

```bash
ssh pve01 'ls -lth /var/lib/vz/backups/dump | head'
ssh pve01 'du -sh /var/lib/vz/backups/dump'
ssh pve01 'pvesm status | grep local-backup'
```

Expect recent `vzdump-qemu-<VMID>-*.vma.zst` (VM) or `vzdump-lxc-<VMID>-*.tar.zst`
(CT), non-zero size, and `local-backup` **active**. Also visible in the UI under
Storage → **local-backup** → Content.

---

## Operations

| Cadence    | Action                                       |
| ---------- | -------------------------------------------- |
| On demand  | Manual vzdump (above) after first guests     |
| Daily      | Automatic `daily-all` at 02:00               |
| Weekly     | **Restore drill** — VMID 999, verify, delete |
| On failure | Email via `NOTIFY_EMAIL`                     |

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

| Feature                           | Status |
| --------------------------------- | ------ |
| Post-backup verify + Discord/ntfy | ⏳     |
| Dell PBS (Stage 3)                | 🔮     |

## References

- [terraform-lab: manual vzdump](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/manual-vzdump.md)
- [terraform-lab: backup design](https://github.com/nasraldin/terraform-lab/blob/main/docs/design/2026-07-20-proxmox-backup-strategy-design.md)
- [proxmox-bootstrap: operations guide](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/13-complete-operations-guide.md)
