# Backup platform — Veeam-equivalent for this lab

Open-source stack to practice **enterprise backup concepts** (VM DR, k8s backup,
immutable object storage, DB PITR) without Veeam licensing.

**Your enterprise:** Veeam (commercial VM + app backup)  
**This lab:** layered OSS tools mapped to the same ideas

Related: [backups.md](backups.md) (vzdump stages) · [hardware-and-storage.md](../architecture/hardware-and-storage.md)

---

## Enterprise concept → homelab tool

| Veeam / enterprise idea | Homelab tool | Phase |
| ----------------------- | ------------ | ----- |
| VM backup (Hyper-V/VMware) | **Proxmox vzdump** now → **PBS** later | 0–1 now, Stage 3 |
| Incremental + dedup | **Proxmox Backup Server** | Dell server (Stage 3) |
| Backup copy / offsite sync | PBS **remote sync** to NAS or cloud | Stage 3+ |
| Immutable backup repo | **MinIO Object Lock** | Phase 8–9 |
| Kubernetes backup (Kasten) | **Velero** | Phase 9 |
| App-aware DB backup | **CloudNativePG** (PostgreSQL WAL) | Phase 8+ |
| Restore testing / DR drill | Weekly vzdump restore + Velero restore jobs | Ongoing |
| Central scheduling / reporting | Terraform jobs + Grafana + backup alerts | Phase 5, 9 |

**Skip for this lab (unless curious):** Bareos/Bacula — traditional file backup;
less aligned with Proxmox + k8s than PBS + Velero.

---

## Layer 1 — VM / LXC backup (closest to Veeam)

### Today (Stage 1–2): vzdump

You already designed this in **terraform-lab**:

| Setting | Value |
| ------- | ----- |
| Job | `daily-all` @ 02:00 |
| Mode | snapshot, zstd |
| Retention | 7 daily / 4 weekly / 3 monthly |
| Target | `local-backup` → later `aux-backup` |

This is **production-like ops** (schedule, retention, restore drills) without PBS
yet. Veeam analogy: basic VM backup job.

```bash
cd ~/homelab/terraform-lab && terraform apply
```

### Stage 3: Proxmox Backup Server (PBS)

**Best open-source “Veeam for Proxmox”** — same vendor ecosystem:

```text
pve01 (X1 Pro)
  └── VMs / LXCs on data01
           │
           │  incremental, dedup, encrypt
           ▼
Dell server (dedicated hardware)
  └── Proxmox Backup Server
           │
           └── datastore (separate disks from production)
```

PBS features that mirror Veeam:

- Incremental forever backups
- Deduplication + compression
- Encryption at rest
- Verify jobs
- Prune / retention policies
- Remote sync (second copy)

**Not on the X1 Pro:** PBS datastore should **not** be the only copy on the same
chassis as production VMs. Your design correctly puts PBS on the **future Dell**.

Optional interim: PBS as **VM on pve01** with datastore on **USB/NAS** — learning
only; not true air-gap.

### What you practice with vzdump → PBS

| Skill | How |
| ----- | --- |
| RPO / RTO | Define retention vs acceptable data loss |
| Restore drill | [backup-restore-drill runbook](https://github.com/nasraldin/terraform-lab/blob/main/docs/runbooks/backup-restore-drill.md) |
| Backup storage migration | Change `backup_storage_id` only |
| Offsite copy | PBS sync job |

---

## Layer 2 — Kubernetes backup (Velero)

When kubeadm cluster exists (Phase 6), **Velero** is the Kasten/Veeam-k8s equivalent.

```text
Kubernetes (kubeadm)
  ├── Namespaces, Deployments, CRDs, Secrets
  ├── PVCs (Longhorn or local-path)
  │
  └── Velero
        ├── Backup schedules (GitOps-defined)
        └── Restore (namespace / cluster DR)
              │
              ▼
        MinIO (S3-compatible)
              │
              └── optional Object Lock (immutable)
```

**Deploy:** Argo CD Application (Phase 9 — already in roadmap).

**Backends for homelab:** MinIO in-cluster (Phase 8) — same S3 API as Azure Blob.

**Practice:**

- Namespace backup before upgrades
- Migrate workload between clusters
- DR: restore into fresh kubeadm cluster after `terraform apply`

---

## Layer 3 — Database backup (application-aware)

For PostgreSQL in k8s (GitLab, Keycloak, apps):

| Tool | Use |
| ---- | --- |
| **CloudNativePG** | Operator-managed Postgres + continuous WAL → S3/MinIO |
| Velero | Coarse namespace + PVC snapshot |

Enterprise teams use **both**: Velero for k8s objects; operator for **PITR**.

---

## Layer 4 — Immutable storage (ransomware-style protection)

Veeam immutable repositories → **MinIO Object Lock**:

```text
Velero backups  ──►  MinIO bucket (versioning + object lock)
PBS sync copy   ──►  second MinIO or NAS with WORM policy
```

Teaches: S3 API, compliance retention, why backups must not live only on the
hypervisor disk.

**Phase:** after MinIO + Velero (8–9).

---

## Your hardware vs generic advice

| Generic blog | Your lab (correct) |
| ------------ | ------------------ |
| PBS on 3rd NVMe in X1 Pro | **Dell server** for PBS (Stage 3) |
| Backups on 4 TB Kingston | **Guest disks only** — backups on 990 PRO / aux / PBS |
| vzdump + PBS day one | **vzdump first** (Stages 1–2), PBS when Dell exists |

---

## Recommended stack (ordered)

```text
NOW (Phase 0–1)
  vzdump → local-backup (terraform-lab)
  weekly restore drill

STAGE 2
  aux 4 TB → aux-backup (same jobs, new storage_id)

PHASE 6–7
  kubeadm + Argo CD

PHASE 8
  MinIO (backup target + app storage)
  Harbor, PostgreSQL operators

PHASE 9
  Velero → MinIO
  Kyverno, monitoring
  Optional: MinIO Object Lock

STAGE 3 (when Dell arrives)
  PBS on Dell
  pve01 backup jobs → PBS datastore
  retire or slim vzdump on rpool

ONGOING
  CloudNativePG WAL → MinIO for any production-like Postgres
  Automated restore tests in CI or monthly runbook
```

---

## What to learn for Platform Engineer interviews

| Topic | Homelab proof |
| ----- | ------------- |
| “How do you backup VMs?” | vzdump + PBS architecture diagram |
| “K8s DR?” | Velero backup/restore demo |
| “Immutable backups?” | MinIO Object Lock + retention |
| “Postgres PITR?” | CloudNativePG WAL restore |
| “Do you test restores?” | Restore drill runbook + logs |

---

## Next actions

1. **Apply Stage 1** if not done: `terraform apply` in `terraform-lab`
2. **Weekly restore drill** — non-negotiable habit
3. **Do not install PBS on X1 Pro** as primary — wait for Dell or external NAS
4. **Plan Velero** when kubeadm + MinIO exist — add Argo CD app manifest in Phase 9

See [backups.md](backups.md) for Stage 1–3 vzdump/PBS migration details.
