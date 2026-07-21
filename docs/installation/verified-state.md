# Verify the Proxmox Node After Install

Known-good checks from after the manual install and validation (July 2026). Re-run the same commands after bootstrap or any major host change. Read [journey](journey.md) first if you need context; go to [next steps](next-steps.md) once these checks pass.

**Node:** `pve01.lab.nasraldin.com` · `192.168.68.13/22`

## What this page covers

- Software versions and hostname / FQDN
- Network and interim DNS on node and Mac
- ZFS `rpool` layout and unused disks awaiting Terraform
- SSH, API, and other post-install smoke checks

---

## Software versions

```bash
pveversion -v    # pve-manager 9.2.4, kernel 7.0.14-5-pve
hostname         # pve01
hostname -f      # pve01.lab.nasraldin.com
```

---

## Network

```bash
ip -4 addr show vmbr0
# inet 192.168.68.13/22

cat /etc/network/interfaces
# vmbr0 static, gateway 192.168.68.1, bridge-ports nic0
```

| Check                     | Expected                                         |
| ------------------------- | ------------------------------------------------ |
| `ping -c1 192.168.68.1`   | OK                                               |
| `systemctl is-active ssh` | active                                           |
| `pve-firewall status`     | **enabled/running** (after `enable-firewall.sh`) |

---

## DNS (node)

```bash
cat /etc/hosts
# 192.168.68.13 pve01.lab.nasraldin.com pve01

getent ahostsv4 pve01.lab.nasraldin.com
# 192.168.68.13 STREAM ...

ping -4 -c1 pve01.lab.nasraldin.com
# 192.168.68.13
```

---

## DNS (Mac)

```bash
grep pve01 /etc/hosts
# 192.168.68.13 pve01.lab.nasraldin.com pve01

ping -c1 pve01.lab.nasraldin.com
# 192.168.68.13  (NOT the public wildcard)
```

---

## Storage

```bash
zpool status
# pools: rpool + data01 — both ONLINE

zpool list
# rpool  ~1.8T (Samsung 990 PRO)
# data01 ~3.6T (Kingston FURY)

lsblk -o NAME,SIZE,MODEL
# Samsung SSD 990 PRO  → rpool
# KINGSTON FURY …      → data01
# (OEM Slot 3)         → not installed — aux01 deferred
```

```bash
systemctl is-enabled fstrim.timer
# enabled
```

---

## APT

```bash
ls /etc/apt/sources.list.d/
# ceph.sources debian.sources proxmox.sources pve-enterprise.sources

grep -h Enabled /etc/apt/sources.list.d/*.sources
# enterprise + ceph: false

apt policy 2>/dev/null | head -20
# download.proxmox.com ... pve-no-subscription
```

---

## API

```bash
# From Mac — connectivity (401 = OK)
curl -sk https://pve01.lab.nasraldin.com:8006/api2/json/version
# HTTP 401 or empty body without auth

# Token auth (single quotes!)
curl -sk \
  -H 'Authorization: PVEAPIToken=terraform@pve!provider=<SECRET>' \
  https://pve01.lab.nasraldin.com:8006/api2/json/version
# {"data":{"version":"9.2.4",...}}
```

```bash
pveum user list
# root@pam, terraform@pve, nasr@pam — enabled
```

---

## SSH (Mac → node)

```bash
ssh -i ~/.ssh/pve01 root@192.168.68.13 hostname
# pve01

# Or with config alias:
ssh pve01 hostname
```

---

## Phase 0 apply status (live)

| Item                      | Status | Repo / script                  |
| ------------------------- | ------ | ------------------------------ |
| ZFS autotrim + ARC limit  | ✅     | `proxmox-bootstrap`            |
| `data01` pool on Kingston | ✅     | `terraform-lab`                |
| Backup job `local-backup` | ✅     | `terraform-lab` (Stage 1)      |
| Update check timer        | ✅     | `proxmox-bootstrap`            |
| Cloudflare Tunnel         | ✅     | `cloudflare-tunnel`            |
| Host firewall             | ✅     | `proxmox-bootstrap`            |
| Restore drill             | ✅     | first proof done               |
| Drift check               | ✅     | bootstrap + firewall `--check` |
| `aux01` (OEM Slot 3)      | ⏸️     | disk not installed             |
