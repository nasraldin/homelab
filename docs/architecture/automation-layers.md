# Automate the Homelab from Bare Metal to GitOps

Nothing automates Proxmox onto empty metal by itself — you need an installer first, then code owns everything after. This page maps which repo and tool handle each layer on the X1 Pro, and where those boundaries sit.

Source of truth for tool boundaries: [platform-tooling.md](../platform-tooling.md).

## What this page covers

- The full stack from bare metal through GitOps, plus the Mac as control plane
- What Ansible and Terraform can and cannot do on empty hardware
- How `proxmox-bootstrap` and `ansible-lab` split host work
- Storage ownership (`rpool` vs `data01`) and remote access paths
- Rebuild workflows and what belongs in Ansible vs elsewhere

## The stack (your lab)

```text
Layer 0 — Bare metal (official installer once)
  Proxmox installer  →  Proxmox on Samsung 990 PRO only

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
  cloudflare-tunnel  →  homelab.nasraldin.com (UI from work)
  SSH + LAN DNS      →  pve01.lab.nasraldin.com (Terraform/Ansible)
```

---

## Can Ansible provision Proxmox from empty hardware?

| Question                                    | Answer                                                      |
| ------------------------------------------- | ----------------------------------------------------------- |
| Ansible on **empty** X1 Pro (no OS)?        | **No** — nothing to SSH to                                  |
| Ansible **after** Proxmox is installed?     | **Yes** — configure guests and optional host tasks          |
| Ansible install Proxmox packages on Debian? | Possible but **not your path** — use official PVE installer |
| Terraform install Proxmox?                  | **No** — needs API on running PVE                           |
| Mac automate **first** Proxmox install?     | **No active path** — use the official installer             |
| Mac automate **everything after** install?  | **Yes** — `proxmox-bootstrap` + `terraform-lab`             |

Professional pattern: **one short manual or unattended install**, then **100% code**.

---

## Mac as control plane (your setup)

You do **not** need an `ansible-control` VM yet. Your Mac is the control plane:

| Mac role      | Tool                         | Target            |
| ------------- | ---------------------------- | ----------------- |
| SSH + DNS     | `proxmox-bootstrap/mac/`     | `pve01`           |
| Host config   | `proxmox-bootstrap --remote` | Proxmox node      |
| VMs / storage | `terraform-lab`              | Proxmox API       |
| Guest config  | `ansible-lab` playbooks      | VMs over SSH      |
| Remote UI     | `cloudflare-tunnel`          | Tunnel on `pve01` |
| Reinstall PVE | Official Proxmox installer   | Bare metal        |

Add a dedicated ansible VM later only if you want CI runners **inside** the lab.

---

## proxmox-bootstrap vs ansible-lab

These repositories no longer overlap:

| Repository          | Owns                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `proxmox-bootstrap` | PVE host APT, SSH, ZFS tuning, firewall, updates, Terraform token |
| `ansible-lab`       | Non-k8s guest OS and applications after Terraform creates VMs     |

The old USB/PXE experiment is retained only in the `ansible-lab`
`host-install` history. It is not part of the supported rebuild sequence.

---

## Storage — ignore ChatGPT “3 pools on install”

Your **decided** layout (two NVMe populated):

| Disk                 | Pool         | Created by                                      |
| -------------------- | ------------ | ----------------------------------------------- |
| Samsung 990 PRO 2 TB | `rpool` (OS) | Official Proxmox installer                      |
| Kingston Fury 4 TB   | `data01`     | **terraform-lab** (not first-boot zpool create) |

Reason: creating an extra pool during install is fragile (disk order, wiping the
wrong disk). The installer selects **one** disk; Terraform owns
`data01` declaratively.

Third M.2 (PCIe x1) and 2 TB disk are **future** — aux backup / `aux01`, not
required for current automation.

Verified disk serials:

- OS: `S73WNJOW803723P` (Samsung 990 PRO)
- Data: `50026B76871D1F07` (Kingston 4 TB)

---

## Remote operation (Ethernet + away from home)

### At home

```text
Mac (Wi‑Fi or Ethernet)
    │
    ├── SSH  →  pve01.lab.nasraldin.com
    ├── API  →  Terraform provider
    └── UI   →  https://192.168.68.13:8006  or LAN FQDN
```

X1 Pro: **Ethernet to router** (`nic0` → `vmbr0`, static `192.168.68.13/22`).
Reserve DHCP for MAC `38:05:25:39:CF:43` on TP-Link.

### From work / cellular

```text
Laptop
    │
    └── https://homelab.nasraldin.com  (Cloudflare Access → Proxmox UI)
```

Terraform and Ansible still run best **on Mac at home** (or via VPN later).
Tunnel is for **UI and emergency access** — see
[cloudflare-tunnel](https://github.com/nasraldin/cloudflare-tunnel/blob/main/README.md).

Tailscale is optional; not in current design.

---

## Rebuild workflow (professional)

### A — Node already installed (today)

```bash
cd ~/homelab/proxmox-bootstrap && ./mac/bootstrap.sh --remote --yes
cd ~/homelab/cloudflare-tunnel && ./mac/bootstrap.sh --yes
cd ~/homelab/terraform-lab && terraform plan -out=tfplan && terraform apply tfplan
cd ~/homelab/ansible-lab && ansible-playbook playbooks/dns.yml -e @secrets.yml
```

### B — Wipe SSD and reinstall Proxmox

1. Install with the official Proxmox installer using the values in the
   [install journal](../installation/journey.md).
2. Run `proxmox-bootstrap`.
3. Review and apply `terraform-lab`.
4. Run the required `ansible-lab` playbooks.

Use the [canonical deploy and rebuild runbook](../operations/deploy-and-rebuild.md)
for exact commands and acceptance gates.

---

## What Ansible should manage (and not)

| ✅ Ansible                        | ❌ Not Ansible                            |
| --------------------------------- | ----------------------------------------- |
| GitLab VM packages, users, Docker | Creating Proxmox VMs (Terraform)          |
| AdGuard/Technitium VM prep        | kubeadm cluster (Terraform VMs + kubeadm) |
| Security baseline on **guests**   | Helm charts in k8s (Argo CD)              |
| Guest application configuration   | Proxmox host configuration                |

Kubernetes platform: **Terraform** creates nodes → **Argo CD** owns cluster apps.

---

## Where you are now

| Step                                         | Status                       |
| -------------------------------------------- | ---------------------------- |
| Official install Proxmox                     | ✅ done                      |
| SSH, DNS, API token                          | ✅ done                      |
| `proxmox-bootstrap` on node                  | ✅ done                      |
| `cloudflare-tunnel`                          | ✅ done                      |
| `terraform apply` (`data01`, Stage 1 backup) | ✅ done                      |
| `aux01` (OEM Slot 3)                         | ⏸️ hold — NVMe not installed |
| Host firewall                                | ✅ done                      |
| AdGuard + Technitium guests                  | ✅ done                      |
| Router DNS cutover                           | ⏳ IPv6 DNS bypass remains   |
| kubeadm + Argo CD                            | ⏳ Phase 6–7                 |

Next: [current-state.md](../current-state.md) · finish DNS cutover, then GitLab
