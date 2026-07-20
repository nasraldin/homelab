# Automate Update Checks and Upgrade Proxmox Safely

Proxmox should **tell you** when packages are available — then you upgrade in a maintenance window. Unattended `apt full-upgrade` on the hypervisor is rejected: kernel, `pve-manager`, and ZFS updates can force reboots or break guests.

Checks run on the host with systemd + shell. n8n is optional fan-out after a report exists, not the primary update mechanism.

## What this page covers

- Layered design: check → manual upgrade → optional n8n
- Daily timer behaviour (simulate only, notify if updates)
- Manual `apply-updates.sh` workflow and health checks
- Why auto-upgrade and n8n-as-primary are out

## Layered design (decided)

```text
Layer 1 — Host (implemented)
  systemd timer → check-updates.sh → apt simulate → notify if updates exist

Layer 2 — Manual upgrade (implemented)
  apply-updates.sh → full-upgrade workflow → health checks → notify

Layer 3 — n8n (optional, future)
  Webhook from script → Telegram / Discord / Git issue / dashboard

Layer 4 — Homelab agent (future)
  Unified ops agent — see [operations README](README.md)
```

| Approach | Role | Status |
| -------- | ---- | ------ |
| **systemd timer + shell** | Check + notify on host | 🟡 `install-update-automation.sh` |
| **apply-updates.sh** | Manual maintenance-window upgrade | 🟡 in Git |
| **n8n** | Notification orchestration, approvals, tickets | ⏸️ optional — not primary |
| **Unattended apt on timer** | — | ❌ rejected |

### Why not n8n as the primary mechanism?

Proxmox is Debian-based — update **checks** should run on the host with native tooling (`apt`, `journalctl`). n8n is better as an **optional fan-out** layer after the script produces a report.

### Why not auto-upgrade?

Kernel, `pve-manager`, `qemu-server`, and ZFS package updates can require reboots or break guests. Production pattern:

```text
CHECK → REPORT → YOU APPROVE → UPDATE → REBOOT IF NEEDED → VERIFY
```

---

## What runs automatically (no daily action)

| Unit | Schedule | Action |
| ---- | -------- | ------ |
| `pve-update-check.timer` | Daily 07:00 (+ 15m jitter) | Start check service |
| `pve-update-check.service` | oneshot | `/usr/local/bin/pve-check-updates --quiet` |

Equivalent cron (not used): `0 7 * * * root /usr/local/bin/pve-check-updates`

**Behaviour:**

1. `apt update`
2. List upgradable packages (simulation only — **no install**)
3. Zero updates → exit silent
4. Updates found → email / Discord / ntfy / Slack

---

## Manual upgrade (your workflow)

`apply-updates.sh` runs:

```bash
apt update
apt list --upgradable
apt full-upgrade -y
apt autoremove --purge -y
apt autoclean
apt clean
```

Plus health checks (`pveproxy`, ZFS, reboot flag) and summary notification.

```bash
cd ~/homelab/proxmox-bootstrap
./mac/apply-updates.sh --check
./mac/apply-updates.sh
```

**Before upgrading:** backup critical VMs (vzdump).

---

## Install (once)

```bash
cd ~/homelab/proxmox-bootstrap
cp config.env.example config.env   # NOTIFY_EMAIL and/or webhooks
./mac/install-update-automation.sh --yes
ssh pve01 'systemctl list-timers pve-update-check.timer'
```

---

## Future: richer check report

Planning discussions suggested expanding the check script to report:

- Proxmox package versions
- Kernel / reboot required
- Cluster health (when multi-node)
- Ceph status (if used)
- Storage health

**Today:** upgradable package list + notifications. Expand in `proxmox-bootstrap` when needed.

---

## Future: n8n workflow

```text
check-updates.sh --json (future)
        │
        v
      n8n
        ├── Telegram
        ├── Email
        ├── Discord
        └── GitLab issue
```

**Status:** ⏳ — scripts notify directly today; n8n can subscribe later without changing the check/upgrade split.

---

## Implementation reference

| Piece | Location |
| ----- | -------- |
| Check script | `proxmox-bootstrap/pve/check-updates.sh` |
| Upgrade script | `proxmox-bootstrap/pve/apply-updates.sh` |
| Timer install | `proxmox-bootstrap/pve/install-update-automation.sh` |
| Notifications | `proxmox-bootstrap/lib/notify.sh` |
| Full guide | [proxmox-bootstrap: update automation](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/12-update-automation.md) |
