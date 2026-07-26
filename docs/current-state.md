# See Where the Homelab Stands Right Now

Live status board for the lab. Read the [build story](build-story.md) first so
the checkmarks mean something; the approved next sequence is tracked in the
[foundation sequence](roadmap/foundation-sequence.md).

**Overall:** Phase 0 ✅ closed (except Slot 3 / `aux01` ⏸️). DNS VMs and
`infra01` ✅. Off-LAN ops: use
[infra01 remote access](operations/infra01-remote-access.md)
(`infra.nasraldin.com`) — do not open WAN SSH. OPNsense VLAN pilot **archived**
(2026-07-23) — code on `archive/opnsense-vlan-pilot`, live VMs and `vmbr1` removed.
Core container hosts redesign ✅ verified **2026-07-26**.
**Next focus:** Terraform CI on GitLab (optional), then kubeadm Stage A.
NetBird remains optional. GitLab CE ✅ at `https://gitlab.nasraldin.com`.
Vault (`vault-01` `.18`) + AIStor Free (`aistor-01` `.17`) ✅ as core Layer-1.
DNS: IPv4 DHCP → AdGuard Primary + **Secondary `1.1.1.1`** (resilience) ✅;
Deco has no IPv6 DNS UI — Mac pin optional — [lan-dns-resilience](operations/lan-dns-resilience.md).
**Node:** `pve01.lab.nasraldin.com` · `192.168.68.13/22` · Proxmox VE **9.2.4**.

## What this page covers

- Hardware slots and pool roles (`rpool` / `data01` / `aux01`)
- What is already ✅ on the node
- What is ⏸️ deferred (documented reason)
- What is still ⏳ (Phase 2+), plus decisions that won’t be redone

---

## Hardware (installed)

| Slot | PCIe | Disk                        | Role                   | Status                                        |
| ---- | ---- | --------------------------- | ---------------------- | --------------------------------------------- |
| 1    | ×4   | Samsung 990 PRO 2 TB        | `rpool` — Proxmox OS   | ✅                                            |
| 2    | ×4   | Kingston FURY Renegade 4 TB | `data01` — VM disks    | ✅                                            |
| 3    | ×1   | Kingston OM8TAP 2 TB (OEM)  | `aux01` — backups, ISO | ⏸️ disk **not installed** — hold until Slot 3 |

Details: [architecture/hardware-and-storage.md](architecture/hardware-and-storage.md)

---

## What is done (✅)

| Area            | Item                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Install         | Proxmox 9.2.4 on **990 PRO only** (`rpool` ~1.8 TB, single disk)                                                                    |
| Network         | Static IP, FQDN, `vmbr0` on flat TP-Link LAN                                                                                        |
| DNS (lab)       | AdGuard `.10` + Technitium `.11` (`lab.nasraldin.com`); dig proofs ✅                                                               |
| DNS (IPv4 DHCP) | TP-Link primary DNS = AdGuard `192.168.68.10`                                                                                       |
| DNS (Mac path)  | Wi-Fi DNS pinned to `192.168.68.10` (Deco has no IPv6 DNS controls)                                                                 |
| SSH             | Key auth Mac → `root@192.168.68.13` + admin user                                                                                    |
| APT             | deb822, no-subscription enabled, enterprise disabled                                                                                |
| API             | `terraform@pve!provider` token                                                                                                      |
| Host bootstrap  | ZFS tune, ARC 16 GiB, packages, admin, mail endpoint, `iommu=pt`                                                                    |
| Updates         | `pve-update-check.timer` enabled (daily check + notify)                                                                             |
| Storage         | `data01` ONLINE + Proxmox `zfspool`; Stage 1 `local-backup` on rpool                                                                |
| Operator VM     | `infra01` `.12`: hardened management toolchain + PVE access — off-LAN: [infra01-remote-access](operations/infra01-remote-access.md) |
| Tunnel          | Proxmox UI + `infra` SSH + **`gitlab.nasraldin.com`** (no Access) + sonar/kibana/docker                                             |
| GitLab          | Omnibus `gitlab-01` VMID **116** `.14` + `runner-01` VMID **117** `.15` → AIStor ✅                                                 |
| Vault           | OSS Raft on `vault-01` VMID 113 `.18` + seal VMID 114 `.19` — AppRole ✅                                                            |
| Object storage  | AIStor Free on `aistor-01` VMID **115** `.17` — GitLab buckets + runner cache ✅                                                    |
| Infisical       | App env-secrets on **`docker-01` `.22`** (PgCat DB) — HTTP `:8090` ✅ (first UI admin signup if needed)                          |
| Platform hosts  | `database-01` / `docker-01` / `podman-01` / `monitoring-01` / `sonarqube-01` / `elastic-01` / `dockhand` — ✅ verified 2026-07-26 |
| Observability   | Grafana community dashboards + exporters (PVE/AdGuard/Technitium/Vault/GitLab/Sonar) ✅ — [monitoring.md](operations/monitoring.md); logs → Kibana |
| Runner          | Single `runner-01` docker executor online; fleeting manager scaffold ⏳                                                         |
| Firewall        | Datacenter + node firewall enabled (LAN SSH/API + loopback rules)                                                                   |
| Drift check     | `bootstrap.sh --check` + `enable-firewall.sh --check` clean                                                                         |
| Restore drill   | First proof done (weekly cadence continues)                                                                                         |
| Documentation   | Split repos, roadmap, architecture, install journal                                                                                 |
| Git             | Lab repos pushed to `nasraldin/*`                                                                                                   |

---

## Deferred (⏸️)

| Task                         | Reason                               | When to resume                                             |
| ---------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Storage `aux01` (OEM Slot 3) | OEM NVMe **not installed** in Slot 3 | Install disk → `terraform apply` for `aux01`               |
| Stage 2 `aux-backup` migrate | Blocked on `aux01`                   | After `aux01` exists — [backups.md](operations/backups.md) |
| OPNsense / VLANs             | Intentionally simplified for stage   | Restore from `archive/opnsense-vlan-pilot` when needed     |

---

## Next (approved order)

| #   | Task                             | Status                                                                                                                         |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | GitLab Omnibus + Docker runner   | ✅ — `https://gitlab.nasraldin.com` + `runner-01` (no `runner-02`)                                                             |
| 2   | Vault + AIStor (core)            | ✅ — [vault.md](operations/vault.md) · [object-storage.md](operations/object-storage.md)                                       |
| 3   | Core container hosts redesign    | ✅ verified 2026-07-26 — [acceptance](operations/core-hosts-acceptance.md)                                                         |
| 4   | NetBird remote access (optional) | ⏳                                                                                                                             |
| 5   | kubeadm Stage A                  | ⏳ after GitLab CI path is usable                                                                                              |

**Active focus** — Terraform CI on GitLab (optional), then kubeadm Stage A.
GitLab: Tunnel HTTPS, no Access; S3 via AIStor; secrets via Vault; Infisical on
`docker-01`. Keep flat LAN + AdGuard. Fleeting autoscaler:
[gitlab-runner-autoscaling.md](operations/gitlab-runner-autoscaling.md).

---

## Decisions locked (won’t redo)

| Topic        | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| Hypervisor   | Proxmox VE 9.x on ZFS                                         |
| VM disks     | **`data01` (FURY) only** — not `rpool`                        |
| Kubernetes   | **kubeadm** on Debian VMs (CKA) — not k3s for primary cluster |
| Ingress      | **NGINX** — not Traefik                                       |
| GitOps       | Argo CD after cluster exists                                  |
| Registry     | Harbor (proxy cache + CI push)                                |
| GitLab       | **Dedicated VM** — not inside k8s                             |
| Public UI    | Tunnel → Proxmox — not WAN `:8006`                            |
| GPU / IOMMU  | AMD: `iommu=pt` only (no `amd_iommu=on`); VFIO later for 890M |
| Updates      | Check + notify; **manual** hypervisor upgrade                 |
| ITSM         | Zammad for customer tickets; **n8n automates only**           |
| Edge / VLANs | Flat TP-Link for now; OPNsense pilot archived                 |

Full log: [decisions/log.md](decisions/log.md)

---

## Repository status

| Repo                | Role                         | Git    | Applied on node                    |
| ------------------- | ---------------------------- | ------ | ---------------------------------- |
| `homelab`           | Plans, story, architecture   | synced | n/a                                |
| `proxmox-bootstrap` | Layer 0 host                 | synced | ✅ firewall; pilot `vmbr1` removed |
| `terraform-lab`     | Layer 1–2 infra              | synced | ✅ DNS + `infra01`; ⏸️ `aux01`     |
| `cloudflare-tunnel` | Remote UI + operator SSH     | synced | ✅ UI and SSH routes               |
| `opshub` (sibling)  | Ops shell / Terminal / noVNC | synced | n/a (dev on Mac)                   |
| `ansible-lab`       | Guest policy                 | synced | ✅ DNS and `infra01`               |

---

## Validate node (anytime)

Copy-paste checks: [installation/verified-state.md](installation/verified-state.md)

```bash
cd ~/homelab/proxmox-bootstrap && ./mac/bootstrap.sh --remote --check
cd ~/homelab/proxmox-bootstrap && ./mac/enable-firewall.sh --check
```
