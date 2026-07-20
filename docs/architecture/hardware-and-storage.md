# Pick the Right Drive and Slot for Every Homelab Disk

The X1 Pro has three M.2 slots, and they are not equal — Slot 3 is PCIe ×1 and will never match a flagship drive's rated speed. Put the OS and production guests on the ×4 slots; use Slot 3 for backups, ISO, and cold capacity.

## What this page covers

- Slot topology, installed drives, and what belongs on each pool
- SSD purchase guidance for Slots 1–2 (and what to skip for Slot 3)
- Whether 2 TB or 4 TB makes sense in Slot 3
- Workload expectations when VMs land on Slot 3
- Five-year layout, BIOS defaults, and backup stages

## Node

**Minisforum AI X1 Pro** — Ryzen AI 9 HX 470, 96 GB RAM, **three** M.2 slots (not all equal).

### M.2 slot topology (official)

| Slot | PCIe | Max practical throughput | Use for |
| ---- | ---- | ------------------------ | ------- |
| **1** | 4.0 ×4 | ~7 GB/s | Proxmox OS — boot, config, small fast pool |
| **2** | 4.0 ×4 | ~7 GB/s | **Primary VM datastore** — all important guests |
| **3** | 4.0 ×1 | ~1.7–2 GB/s | Bulk / cold — ISO, backup staging, archive, low-priority VMs |

**Rule:** Never pay flagship SSD prices for Slot 3. A PCIe ×1 link caps throughput regardless of drive rating.

### Installed / planned drives

| Slot | Disk | Proxmox role | Status |
| ---- | ---- | ------------ | ------ |
| 1 | Samsung 990 PRO 2 TB | `rpool` + Stage 1 `local-backup` | ✅ |
| 2 | Kingston FURY Renegade 4 TB | `data01` — **all** production VM/LXC/k8s disks | 🟡 |
| 3 | Kingston OM8TAP 2 TB (OEM) | `aux01` — ISO overflow, backup staging, archive | 🟡 use included drive |

```text
Slot 1 — 990 PRO (rpool)
├── Proxmox OS, snippets, small templates
└── local-backup     ← vzdump Stage 1 (migrate off when Slot 3 ready)

Slot 2 — FURY 4 TB (data01)     ← PCIe x4 — performance tier
└── VM / LXC / kubeadm node disks ONLY

Slot 3 — OEM 2 TB (aux01)       ← PCIe x1 — capacity tier
├── vzdump staging (Stage 2 target)
├── ISO / templates / downloads
├── scratch / lab VMs (optional)
└── NOT primary k8s/etcd disks
```

### External / future

| Item | Purpose |
| ---- | ------- |
| USB-C portable SSD (e.g. SanDisk Extreme 4 TB) | Personal files, **offsite backup copies** — not VM datastore |
| OWC Express 1M2 + NM790 (optional) | Portable fast storage — not inside X1 Slot 3 |
| Dell server | Proxmox Backup Server (Stage 3) |

There is **no benefit** to buying Lexar NQ790 4 TB **for Slot 3** — you pay for 7 GB/s and get ~2 GB/s max.

---

## SSD purchase guidance (your shortlist)

X1 Pro is **PCIe Gen4 ×4 max** on Slots 1–2. **Skip Gen5** drives (Crucial T710/T705) — no speed gain, often hotter.

### Rank for homelab VM storage (Slots 1–2 only)

| Rank | Drive | Best for | Notes |
| ---- | ----- | -------- | ----- |
| 1 | **Samsung 990 PRO** | OS, Proxmox DB, low-latency | DRAM, mature firmware — **keep in Slot 1** |
| 2 | **Kingston FURY Renegade 4 TB** | VM datastore, DBs, k8s nodes | DRAM, high TBW, sustained writes — **best Slot 2** |
| 3 | **Lexar NM790 4 TB** | Slot 2 if budget matters | Excellent value; HMB not DRAM — still fine for VMs |
| — | Samsung 990 EVO Plus 4 TB | — | Pay more, get less than 990 PRO for homelab |
| — | Lexar NQ790 4 TB | Slot 3 only if OEM missing | Cheaper; don't use for primary VMs |
| — | Kingston NV3 4 TB | Cold bulk only | QLC-ish tier; not for `data01` |
| — | Crucial T710 Gen5 | — | **Avoid** for X1 — wrong interface tier |
| — | Hiksemi Future | — | Unknown endurance — avoid for critical data |

**Your ideal buy:** Slot 2 = **FURY Renegade 4 TB** (you already planned this). Slot 3 = **keep OEM 2 TB** — do not buy NQ790 4 TB for Slot 3.

If FURY is too expensive vs NM790 4 TB (~AED 290 less in your list): NM790 in Slot 2 is a smart save; put savings toward external backup disk or PBS hardware later.

---

## Slot 3: 2 TB or 4 TB?

**2 TB is enough** for Slot 3's role if you follow the layout below.

| Slot 3 content | Typical size (5-year lab) |
| -------------- | ------------------------- |
| ISO + templates | 50–150 GB |
| vzdump staging (Stage 2) | 500 GB–1.5 TB with retention |
| Downloads / scratch | 100–300 GB |
| Low-priority VMs | Optional — keep small |

| Choose **2 TB OEM** when | Choose **4 TB in Slot 3** when |
| -------------------------- | ------------------------------ |
| Backups move to **PBS on Dell** (Stage 3) | You keep months of full vzdump locally |
| Tight retention on aux (7 daily + weekly) | You refuse external/NAS backup |
| Primary VMs stay on FURY 4 TB | You store large AI model archives on Slot 3 |

**Recommendation:** Use **included 2 TB OEM** in Slot 3. Spend a 4 TB budget on **external USB SSD for offsite copies** or **PBS disk** — not a fast NVMe wasted on ×1.

---

## Will Slot 3 feel slow for VMs?

| Workload | Slot 2 vs Slot 3 |
| -------- | ------------------ |
| Desktop VM, dev tools | Barely noticeable |
| k8s control plane (light etcd) | Acceptable for homelab |
| PostgreSQL / heavy random I/O | **Use Slot 2** |
| kubeadm workers (normal pods) | Prefer Slot 2; Slot 3 OK for throwaway lab |
| Loading 30 GB AI model | ~4 s vs ~15 s — then RAM/GPU bound |
| vzdump restore | Slower on Slot 3 — fine for staging |

**Policy:** Production VMs, k8s nodes, GitLab, databases → **`data01` (Slot 2)** only. Slot 3 = backups, ISO, archive, disposable VMs.

---

## 5-year Proxmox layout (recommended)

```text
┌─────────────────────────────────────────────────────────┐
│  Slot 1  990 PRO 2TB   Proxmox OS + minimal local       │
├─────────────────────────────────────────────────────────┤
│  Slot 2  FURY 4TB      data01 — ALL important VMs/k8s   │
├─────────────────────────────────────────────────────────┤
│  Slot 3  OEM 2TB       aux01 — backups, ISO, archive    │
└─────────────────────────────────────────────────────────┘
         │                              │
         │  weekly vzdump               │  copy to
         ▼                              ▼
    PBS (Dell)                    USB SSD (offsite / personal)
```

| Principle | Why |
| --------- | --- |
| **Separate pools** — never one ZFS across all disks | Different speed/endurance; flexible replacement |
| **Guest disks only on `data01`** | Already in [backups.md](../operations/backups.md) |
| **Move vzdump off `rpool`** | Stage 2 → `aux01` on Slot 3 |
| **3-2-1 backups** | 3 copies, 2 media, 1 offsite — USB SSD counts |
| **No Gen5 / no flagship in Slot 3** | Engineering not marketing |

### Proxmox storage IDs (target)

| ID | Disk | Content |
| -- | ---- | ------- |
| `local` / `rpool` | 990 PRO | OS, snippets |
| `local-backup` → migrate | 990 PRO → **aux01** | vzdump jobs |
| `data01` | FURY | VM disks |
| `aux01` | OEM Slot 3 | backups, ISO, cold |

---

## External portable SSD (personal files)

**SanDisk Extreme Portable 4 TB** (~1050 MB/s, USB 3.2 Gen 2) is **fine** for:

- Personal files, photos, projects
- Encrypted offsite copy of critical vzdump
- Moving ISOs — not running VMs

| Pros | Cons (reported online) |
| ---- | ---------------------- |
| Widely available, good sequential speed | Sustained writes can **thermal throttle** |
| USB-C, compact | Not rugged (get **Extreme Pro Portable** or **Samsung T7 Shield** if drops matter) |
| Fine for backup vault | Not a substitute for PBS |

**Alternatives:** Samsung T7 Shield (durability), Crucial X10 Pro (faster), WD My Passport SSD. For homelab **backup copies**, reliability + habit matter more than peak MB/s.

---

## BIOS (5-year homelab)

| Setting | Recommendation |
| ------- | -------------- |
| SVM (AMD-V) | ✅ Enable |
| IOMMU / AMD-Vi | ✅ Enable (PCI passthrough later) |
| SR-IOV | ✅ Enable (no cost if unused; needed for VF NIC/GPU later) |
| Above 4G Decoding | ✅ Enable |
| TPM / fTPM | ✅ Enable |
| Secure Boot | Optional — OFF is simpler for Proxmox/Linux VMs |

SR-IOV does nothing until you attach SR-IOV-capable NICs/GPUs. Enable once, forget.

---

## Backup stages (updated)

| Stage | Target | Status |
| ----- | ------ | ------ |
| 1 | `local-backup` on 990 PRO | 🟡 now |
| 2 | `aux01` on **Slot 3 OEM 2 TB** | 🔮 preferred over buying new 4 TB NVMe |
| 3 | PBS on Dell | 🔮 |
| Offsite | USB portable SSD | 🔮 personal + encrypted backup copy |

Details: [operations/backups.md](../operations/backups.md).
