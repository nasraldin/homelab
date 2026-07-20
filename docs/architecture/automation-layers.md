# Automation layers — Mac, Ansible, Terraform, bootstrap

How to provision the **X1 Pro 470** professionally: what each tool does, what
it cannot do, and which repo owns it.

**Source of truth for boundaries:** [platform-tooling.md](../platform-tooling.md)

---

## The stack (your lab)

```text
Layer 0 — Bare metal (manual or unattended ISO once)
  USB / answer.toml  →  Proxmox on Samsung 990 PRO only

Layer 0b — Host day-1 (idempotent, re-runnable)
  proxmox-bootstrap  →  repos, SSH, ZFS tune, API token, updates

Layer 1 — Infrastructure
  terraform-lab      →  data01, aux01, VMs, LXC, backups

Layer 2 — Cluster bootstrap
  kubeadm / Ansible  →  Kubernetes on Debian VMs

Layer 3 — In-cluster
  Argo CD (planned)  →  apps, ingress, monitoring

Side path — Guest OS (not k8s)
  ansible-lab        →  packages, Docker, GitLab VM prep, etc.

Remote access
  cloudflare-tunnel  →  homelab.example.com (UI from work)
  SSH + LAN DNS      →  pve01.lab.example.com (Terraform/Ansible)
```

---

## Can Ansible provision Proxmox from empty hardware?

| Question | Answer |
| -------- | ------ |
| Ansible on **empty** X1 Pro (no OS)? | **No** — nothing to SSH to |
| Ansible **after** Proxmox is installed? | **Yes** — configure guests and optional host tasks |
| Ansible install Proxmox packages on Debian? | Possible but **not your path** — use official PVE installer |
| Terraform install Proxmox? | **No** — needs API on running PVE |
| Mac automate **first** Proxmox install? | **Yes** — `ansible-lab` (USB unattended ISO + `answer.toml`) |
| Mac automate **everything after** install? | **Yes** — `proxmox-bootstrap` + `terraform-lab` |

Professional pattern: **one short manual or unattended install**, then **100% code**.

---

## Mac as control plane (your setup)

You do **not** need an `ansible-control` VM yet. Your Mac is the control plane:

| Mac role | Tool | Target |
| -------- | ---- | ------ |
| SSH + DNS | `proxmox-bootstrap/mac/` | `pve01` |
| Host config | `proxmox-bootstrap --remote` | Proxmox node |
| VMs / storage | `terraform-lab` | Proxmox API |
| Guest config | `ansible-lab` playbooks | VMs over SSH |
| Remote UI | `cloudflare-tunnel` | Tunnel on `pve01` |
| Reinstall PVE | `ansible-lab` USB ISO | Bare metal |

Add a dedicated ansible VM later only if you want CI runners **inside** the lab.

---

## proxmox-bootstrap vs ansible-lab

Both touch the Proxmox **host** — split by purpose:

| | **proxmox-bootstrap** | **ansible-lab** |
| - | ----------------------- | ----------------- |
| **When** | After any PVE install; daily drift check | Reinstall PVE from scratch; Ansible roles |
| **Style** | Shell, `--check`, report OK/FIXED | `answer.toml`, ISO, playbooks |
| **Owns** | APT, ZFS autotrim, SSH hardening, Terraform token verify | Unattended install, disk-by-serial, `make site` |
| **Use now** | ✅ `pve01` already installed | ✅ Next time SSD is wiped |

**Do not duplicate:** use `proxmox-bootstrap` for day-1 host tuning on a live node;
use `ansible-lab` when you need a **rebuildable** unattended installer.

---

## Storage — ignore ChatGPT “3 pools on install”

Your **decided** layout (two NVMe populated):

| Disk | Pool | Created by |
| ---- | ---- | ---------- |
| Samsung 990 PRO 2 TB | `rpool` (OS) | Installer / `answer.toml` |
| Kingston Fury 4 TB | `data01` | **terraform-lab** (not first-boot zpool create) |

Reason: second pool creation in `answer.toml` first-boot is fragile (disk order,
wiping wrong disk). Installer selects **one** disk by serial; Terraform owns
`data01` declaratively.

Third M.2 (PCIe x1) and 2 TB disk are **future** — aux backup / `aux01`, not
required for current automation.

Serials for your machine (from `ansible-lab`):

- OS: `S73WNJOW803723P` (Samsung 990 PRO)
- Data: `50026B76871D1F07` (Kingston 4 TB)

---

## Remote operation (Ethernet + away from home)

### At home

```text
Mac (Wi‑Fi or Ethernet)
    │
    ├── SSH  →  pve01.lab.example.com  ( /etc/hosts override )
    ├── API  →  Terraform provider
    └── UI   →  https://192.168.1.10:8006  or LAN FQDN
```

X1 Pro: **Ethernet to router** (`nic0` → `vmbr0`, static `192.168.1.10/24`).
Reserve DHCP for MAC `38:05:25:39:CF:43` on TP-Link.

### From work / cellular

```text
Laptop
    │
    └── https://homelab.example.com  (Cloudflare Access → Proxmox UI)
```

Terraform and Ansible still run best **on Mac at home** (or via VPN later).
Tunnel is for **UI and emergency access** — see
[cloudflare-tunnel](https://github.com/nasraldin/cloudflare-tunnel/blob/main/README.md).

Tailscale is optional; not in current design.

---

## Rebuild workflow (professional)

### A — Node already installed (today)

```bash
cd ~/homelab/cloudflare-tunnel && ./mac/bootstrap.sh --yes   # remote UI
cd ~/homelab/proxmox-bootstrap && ./mac/bootstrap.sh --remote --yes
cd ~/homelab/terraform-lab && terraform apply
cd ~/homelab/ansible-lab && ansible-playbook ...              # when VMs exist
```

### B — Wipe SSD and reinstall Proxmox

```bash
cd ~/homelab/ansible-lab
cp proxmox/secrets.example.env proxmox/secrets.env   # ROOT_PASSWORD, keys
make macos-deps && make download-iso && make render-answer
make prepare-iso-only && make usb-hint
# boot X1 Pro from USB → unattended install
make wait && make site    # Ansible post-install
cd ../proxmox-bootstrap && ./mac/bootstrap.sh --remote --yes
cd ../terraform-lab && terraform apply
```

### C — PXE from Mac (optional, needs USB-Ethernet)

Only with **isolated** cable Mac ↔ X1 Pro — never dnsmasq on home Wi‑Fi.
See [ansible-lab: 04-pxe-install](https://github.com/nasraldin/ansible-lab/blob/main/docs/04-pxe-install.md).

---

## What Ansible should manage (and not)

| ✅ Ansible | ❌ Not Ansible |
| ---------- | -------------- |
| GitLab VM packages, users, Docker | Creating Proxmox VMs (Terraform) |
| AdGuard/Technitium VM prep | kubeadm cluster (Terraform VMs + kubeadm) |
| Security baseline on **guests** | Helm charts in k8s (Argo CD) |
| Optional host tasks overlapping bootstrap | Proxmox from bare metal without ISO |

Kubernetes platform: **Terraform** creates nodes → **Argo CD** owns cluster apps.

---

## answer.toml for your X1 Pro

Already templated in `ansible-lab`:

```bash
cd ~/homelab/ansible-lab
cp proxmox/secrets.example.env proxmox/secrets.env
# Edit ROOT_PASSWORD, SSH_PUBLIC_KEY_FILE
make render-answer   # → proxmox/answer.toml
```

Key fields match your live node:

- FQDN: `pve01.lab.example.com`
- IP: `192.168.1.10/24`, gateway `192.168.1.1`
- ZFS on Samsung only: `filter.ID_SERIAL = "*S73WNJOW803723P*"`
- `first-boot` via ISO embed — **not** inline shell in `.toml`

Do **not** use ChatGPT’s `tank-data` / `tank-ai` first-boot script — use
Terraform for `data01`.

---

## Where you are now

| Step | Status |
| ---- | ------ |
| USB install Proxmox | ✅ done |
| SSH, DNS, API token | ✅ done |
| `proxmox-bootstrap` on node | 🟡 run from Mac |
| `cloudflare-tunnel` | 🟡 run from Mac (on LAN) |
| `terraform apply` (data01, aux01, backups) | 🟡 |
| kubeadm + Argo CD | ⏳ Phase 6–7 |

Next: [current-state.md](../current-state.md) · [installation/next-steps.md](../installation/next-steps.md)
