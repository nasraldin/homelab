# Where things stand today

This page is the **status board** for the live lab — what is finished, what is
on hold, and what comes next.

If you are new here, read the [build story](build-story.md) first so the
checkmarks make sense. The approved work order lives in the
[foundation sequence](roadmap/foundation-sequence.md).

## In one paragraph

The Proxmox foundation is done. DNS, remote access, GitLab, Vault, object
storage, and the core app VMs are up. Guest CPU and RAM were right-sized from
live metrics on **2026-07-26**. The next big build is **Kubernetes (kubeadm)**;
optional Terraform CI on GitLab can come first. One disk slot (`aux01`) is still
empty on purpose.

|                   |                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Node**          | `pve01.lab.nasraldin.com` · `192.168.68.13/22` · Proxmox VE **9.2.4**                                                     |
| **Public GitLab** | `https://gitlab.nasraldin.com`                                                                                            |
| **Off-LAN admin** | [infra01 remote access](operations/infra01-remote-access.md) (`infra.nasraldin.com`) — do **not** open WAN SSH to Proxmox |
| **DNS**           | LAN DHCP → AdGuard; secondary resolver `1.1.1.1` for resilience — [lan-dns-resilience](operations/lan-dns-resilience.md)  |
| **Right-sizing**  | [capacity-rightsizing-2026-07-26](operations/capacity-rightsizing-2026-07-26.md)                                          |

## What this page covers

- Physical disks and what each pool is for
- Finished work (safe to treat as “already built”)
- Deferred work (waiting on hardware or a deliberate pause)
- Next tasks in the approved order
- Decisions we will not reopen

---

## Hardware (installed)

| Slot | PCIe | Disk                        | Role                    | Status                           |
| ---- | ---- | --------------------------- | ----------------------- | -------------------------------- |
| 1    | ×4   | Samsung 990 PRO 2 TB        | `rpool` — Proxmox OS    | Done                             |
| 2    | ×4   | Kingston FURY Renegade 4 TB | `data01` — all VM disks | Done                             |
| 3    | ×1   | Kingston OM8TAP 2 TB (OEM)  | `aux01` — backups / ISO | On hold — disk not installed yet |

Details: [hardware and storage](architecture/hardware-and-storage.md).

---

## What is done

These pieces are live and treated as complete unless a refresh runbook says otherwise.

| Area           | What you get                                                                         |
| -------------- | ------------------------------------------------------------------------------------ |
| Install        | Proxmox 9.2.4 on the 990 PRO only (`rpool` ~1.8 TB)                                  |
| Network        | Static IP, FQDN, bridge `vmbr0` on the flat TP-Link LAN                              |
| Lab DNS        | AdGuard `.10` + Technitium `.11` for `lab.nasraldin.com`                             |
| Home DNS       | TP-Link DHCP hands out AdGuard `192.168.68.10` as primary DNS                        |
| Mac DNS        | Wi-Fi pinned to AdGuard (Deco has no IPv6 DNS UI)                                    |
| SSH            | Key login from Mac to `root@192.168.68.13` and the admin user                        |
| APT            | No-subscription repos enabled; enterprise repo off                                   |
| Terraform API  | Token user `terraform@pve!provider`                                                  |
| Host bootstrap | ZFS tune, 16 GiB ARC, packages, admin, mail, `iommu=pt`                              |
| Updates        | Daily Proxmox update check + notify (upgrade stays manual)                           |
| Storage        | `data01` online; Stage 1 `local-backup` still on `rpool`                             |
| Operator VM    | `infra01` (`.12`) — jump box for off-LAN work                                        |
| Tunnel         | Public routes for Proxmox UI, infra SSH, GitLab, Sonar, Kibana, Dockhand             |
| GitLab         | Omnibus on `gitlab-01` + `runner-01`, backed by AIStor                               |
| Vault          | Raft on `vault-01` + seal VM — AppRole ready                                         |
| Object storage | AIStor Free on `aistor-01` — GitLab buckets and runner cache                         |
| Infisical      | App env secrets on `docker-01` (HTTP `:8090`)                                        |
| Platform hosts | database, docker, podman, monitoring, Sonar, Elastic, Dockhand — verified 2026-07-26 |
| Observability  | Grafana community dashboards + exporters — [monitoring](operations/monitoring.md)    |
| Firewall       | Datacenter + node firewall on (LAN SSH/API + loopback)                               |
| Drift checks   | `bootstrap.sh --check` and `enable-firewall.sh --check` clean                        |
| Docs / Git     | Lab repos on GitHub under `nasraldin/*`                                              |

---

## On hold

| Task                         | Why                                 | When to resume                                                        |
| ---------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Storage `aux01` (OEM Slot 3) | OEM NVMe not in the chassis yet     | Install the disk, then `terraform apply` for `aux01`                  |
| Stage 2 `aux-backup` migrate | Needs `aux01`                       | After `aux01` exists — [backups](operations/backups.md)               |
| OPNsense / VLANs             | Lab kept simple on flat LAN for now | Restore branch `archive/opnsense-vlan-pilot` when you need real VLANs |

---

## What comes next

| #   | Task                               | Status                                                                               |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | GitLab Omnibus + Docker runner     | Done — `https://gitlab.nasraldin.com`                                                |
| 2   | Vault + AIStor (core secrets + S3) | Done — [vault](operations/vault.md) · [object storage](operations/object-storage.md) |
| 3   | Core container hosts redesign      | Done — verified 2026-07-26 — [acceptance](operations/core-hosts-acceptance.md)       |
| 4   | NetBird remote access              | Optional — not started                                                               |
| 5   | kubeadm Stage A                    | Next major build after optional GitLab Terraform CI                                  |

**Focus now:** optional Terraform CI pipelines on GitLab, then kubeadm Stage A.
Keep the flat LAN and AdGuard. Runner autoscaling notes:
[gitlab-runner-autoscaling](operations/gitlab-runner-autoscaling.md).

---

## Locked decisions (do not reopen casually)

| Topic        | Choice                                                          |
| ------------ | --------------------------------------------------------------- |
| Hypervisor   | Proxmox VE 9.x on ZFS                                           |
| VM disks     | Only on `data01` (FURY) — never on `rpool`                      |
| Kubernetes   | kubeadm on Debian VMs (CKA path) — not k3s for the main cluster |
| Ingress      | NGINX — not Traefik                                             |
| GitOps       | Argo CD after the cluster exists                                |
| Registry     | Harbor (proxy cache + CI push)                                  |
| GitLab       | Dedicated VM — not inside Kubernetes                            |
| Public UI    | Cloudflare Tunnel → Proxmox — not WAN port `:8006`              |
| GPU / IOMMU  | AMD: `iommu=pt` only for now; VFIO later for the 890M           |
| Updates      | Check + notify; **manual** hypervisor upgrade                   |
| Tickets      | Zammad for humans; n8n for automation only                      |
| Edge / VLANs | Flat TP-Link for now; OPNsense pilot archived                   |

Full history: [decision log](decisions/log.md).

---

## Repository sync

| Repo                | Role                       | Git    | On the node                                 |
| ------------------- | -------------------------- | ------ | ------------------------------------------- |
| `homelab`           | Plans, story, architecture | Synced | n/a                                         |
| `proxmox-bootstrap` | Host day-1                 | Synced | Applied (firewall on; old `vmbr1` removed)  |
| `terraform-lab`     | Storage, VMs, backups      | Synced | Applied; `aux01` still on hold              |
| `cloudflare-tunnel` | Public UI + operator SSH   | Synced | Applied                                     |
| `opshub`            | Browser ops hub            | Synced | Runs on Mac / deploy target                 |
| `ansible-lab`       | Guest OS and apps          | Synced | Applied for DNS + infra and platform guests |

---

## Quick health checks

Copy-paste checks: [verified state](installation/verified-state.md).

```bash
cd ~/homelab/proxmox-bootstrap && ./mac/bootstrap.sh --remote --check
cd ~/homelab/proxmox-bootstrap && ./mac/enable-firewall.sh --check
```
