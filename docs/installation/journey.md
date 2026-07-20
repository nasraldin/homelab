# Install journey timeline

Chronological record: **Minisforum X1 Pro → Proxmox VE 9.2 → automation-ready
host**. Dates approximate (July 2026).

---

## 1. Planning (before USB install)

### Goals locked

- Platform Engineering lab — Terraform, Kubernetes, GitOps, production-like ops
- Proxmox as hypervisor only; workloads in VMs / k8s
- No click-ops; everything reproducible from Git
- Remote access via **Cloudflare Tunnel + Access** — never WAN `:8006`

### Hardware (X1 Pro)

| Component | Detail |
| --------- | ------ |
| CPU | AMD Ryzen AI 9 HX470, 12C/24T |
| RAM | 96 GB DDR5 |
| NIC | 2× 2.5 GbE (`nic0` in use, `nic1` spare) |
| Slot 1 | Samsung 990 PRO 2 TB → Proxmox OS (`rpool`) |
| Slot 2 | Kingston FURY Renegade 4 TB → `data01` (guest VM disks) |
| Slot 3 | Kingston OM8TAP 2 TB OEM (PCIe ×1) → `aux01` (backups, ISO) |

> **Note:** Three M.2 slots — 2× PCIe4 ×4 + 1× ×1. Slot 3 is **not** full speed;
> use OEM drive there, not an expensive 4 TB flagship NVMe.
> See [hardware-and-storage.md](../architecture/hardware-and-storage.md).

### Key decisions

| Topic | Choice | Rejected |
| ----- | ------ | -------- |
| Install method | USB interactive install | PXE/Ansible first install (overkill for one node) |
| OS disk FS | ZFS single-disk (`rpool`) | ext4, LVM-thin-only |
| Hostname | Short `pve01`, FQDN `pve01.lab.example.com` | `pve.homelab`, `homelab.lab` |
| Public UI URL | `homelab.example.com` (tunnel later) | `pve01.lab` on Cloudflare DNS |
| Internal DNS | `/etc/hosts` interim → AdGuard + Technitium | Rely on Cloudflare wildcard |
| Updates | `full-upgrade` in maintenance window | Stacked `upgrade`+`dist-upgrade`+`full-upgrade` |
| Post-install | Owned `proxmox-bootstrap` scripts | Community `curl \| bash` post-pve-install |

---

## 2. Installer (USB)

### Target disk

- **Select by model** (Samsung 990 PRO), not by `nvme0`/`nvme1` number — Linux
  enumeration can swap between boots.
- ZFS advanced: `ashift=12`, `compress=lz4`, `copies=1`, swap ~8 GB.
- **Trap avoided:** `hdsize` showing ~232 GB meant the **USB stick** was selected,
  not the Samsung. Fixed before install.

### Network at install

| Setting | Value |
| ------- | ----- |
| FQDN | `pve01.lab.example.com` |
| IP | `192.168.1.10/24` |
| Gateway | `192.168.1.1` |
| DNS | `1.1.1.1` |
| Timezone | `Asia/Dubai` |

Router DHCP range: `192.168.1.50`–`192.168.1.250` — static `.13` is safe.

---

## 3. First boot problems (fixed)

### 3a. Wrong disk in `rpool` (first attempt)

**Symptom:** `zpool status` showed **two** NVMe members; `rpool` ~3.99 TB.

**Cause:** Both SSDs were present during install; installer created pool across
both disks (or wrong disk selected).

**Fix:** Wipe and **reinstall with only Samsung 990 PRO** connected. After
verify, reinsert Kingston — leave unused until Terraform creates `data01`.

**Current:** `rpool` single member, ~1.8 TB — correct.

### 3b. Community post-install script

Ran `post-pve-install.sh` once — disabled enterprise repos, added
no-subscription. Acceptable for bootstrap; long-term config is **`proxmox-bootstrap`**
(idempotent, owned).

---

## 4. DNS & naming

### Cloudflare wildcard trap

`*.example.com` on Cloudflare causes `pve01.lab.example.com` to resolve to
Cloudflare IPs (`203.0.113.x`, `2606:4700:…`) from public DNS.

**Fix (interim):**

- Proxmox `/etc/hosts`: `192.168.1.10 pve01.lab.example.com pve01`
- Mac `/etc/hosts`: same line + DNS cache flush

**Do not** publish `pve01.lab` in Cloudflare. Public management UI →
`homelab.example.com` via tunnel only.

Full design: [proxmox-bootstrap: 03-dns](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/03-dns.md).

---

## 5. SSH & Mac workstation

1. Generated `~/.ssh/pve01` (ed25519)
2. `ssh-copy-id` to `root@192.168.1.10` — success
3. Mac `/etc/hosts` entry for `pve01.lab.example.com`
4. `~/.ssh/config` Host `pve01` (recommended)

**Ghostty terminal:** `TERM=xterm-ghostty` breaks `nano` on Proxmox — use
`SetEnv TERM=xterm-256color` in SSH config.

---

## 6. APT & repositories

Proxmox 9 uses **deb822** `.sources` files (not legacy `sources.list` deb lines).

Verified active:

- `debian.sources` (trixie + security + updates)
- `proxmox.sources` (`pve-no-subscription`)
- `pve-enterprise.sources` — **Enabled: false**
- `ceph.sources` — **Enabled: false**

---

## 7. Storage tuning (pending automation)

| Setting | Current | Target |
| ------- | ------- | ------ |
| `rpool` state | ONLINE | — |
| `ashift` | 12 | Keep |
| `autotrim` | off | `on` (via bootstrap) |
| `fstrim.timer` | enabled | Keep |
| ZFS ARC | default | ~16 GB cap (via bootstrap) |
| Kingston 4 TB | unused | `data01` pool via Terraform |

---

## 8. API & Terraform identity

| Item | Value |
| ---- | ----- |
| User | `terraform@pve` |
| Token ID | `terraform@pve!provider` |
| Auth test | `curl` with single-quoted `Authorization` header → version `9.2.4` |

Root `@pam` ticket auth verified separately (wrong password was the only failure).

---

## 9. Where we are now

**Overall: 🔄 Setup in progress** — [current-state.md](../current-state.md)

```text
✅ Proxmox 9.2.4 installed (Samsung rpool only)
✅ Network, FQDN, local DNS on node + Mac
✅ SSH key auth from Mac
✅ APT repos correct (no-subscription)
✅ Terraform API user + token working
✅ FURY 4 TB + OEM 2 TB installed (pools via Terraform)
🟡 proxmox-bootstrap — apply on node
🟡 cloudflare-tunnel — apply from Mac
🟡 terraform-lab apply (data01, aux01, backups)
⏳ Kubernetes (kubeadm) — after Phase 0
```

→ [verified-state.md](verified-state.md) · [next-steps.md](next-steps.md) · [build-story.md](../build-story.md)
