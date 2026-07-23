# Walk the Homelab Roadmap Phase by Phase

Task-level status for each roadmap phase. Read the [roadmap overview](index.md) first; use [foundation sequence](foundation-sequence.md) when you need the ordered “do this before k8s” list instead of phase tables. Symbols: [status legend](../conventions/status-legend.md).

## What this page covers

- Phase 0 — Proxmox foundation (install → bootstrap → storage → tunnel)
- Phases 1–3 — IaC, source control, and DNS
- Phase 4 OPNsense VLAN pilot archived (simplified lab)
- Later phases — monitoring, kubeadm, GitOps, and platform

## Approved execution order

The next sequence is:

1. **DNS polish (TP-Link IPv6 / RDNSS)** — ⏳ IPv4 DHCP → AdGuard is done
2. **NetBird remote access** — ⏳ optional
3. **Vault** — ⏳ optional
4. **kubeadm Stage A** — ⏳ when ready

The historical phase numbers below remain unchanged, but this approved order
controls what happens next. The TP-Link edge, live `192.168.68.0/22` LAN, DNS
VMs, and Cloudflare Tunnel remain the daily path. OPNsense/VLANs are archived.

---

## Phase 0 — Proxmox foundation

**Goal:** Hardened hypervisor, backups, safe updates.

| Task                                | Status | Where                                                     |
| ----------------------------------- | ------ | --------------------------------------------------------- |
| Install Proxmox 9.x on 990 PRO      | ✅     | USB                                                       |
| Hostname / FQDN                     | ✅     | bootstrap                                                 |
| APT repos (no-subscription, deb822) | ✅     | bootstrap                                                 |
| NTP, postfix, admin user, SSH       | ✅     | bootstrap                                                 |
| ZFS tuning, ARC, TRIM               | ✅     | bootstrap                                                 |
| Terraform API token                 | ✅     | bootstrap                                                 |
| Storage `data01` (FURY)             | ✅     | terraform                                                 |
| Storage `aux01` (OEM Slot 3)        | ⏸️     | **Hold** — OEM NVMe not in Slot 3                         |
| Backups `local-backup` + daily job  | ✅     | Stage 1 on rpool — [backups.md](../operations/backups.md) |
| Update check timer                  | ✅     | [proxmox-updates.md](../operations/proxmox-updates.md)    |
| Cloudflare Tunnel                   | ✅     | cloudflare-tunnel                                         |
| Host firewall                       | ✅     | `enable-firewall.sh`                                      |
| Restore drill (first proof)         | ✅     | weekly cadence ongoing                                    |
| Bootstrap drift check               | ✅     | `bootstrap.sh --check`                                    |
| OPNsense VLAN Pilot                 | ⏸️     | archived 2026-07-23 — `archive/opnsense-vlan-pilot`       |
| Stage 2 `aux-backup` migrate        | ⏸️     | blocked on `aux01`                                        |

---

## Phase 1 — Control plane & IaC

| Task                                | Status  | Where                                    |
| ----------------------------------- | ------- | ---------------------------------------- |
| `terraform-lab` module              | ✅      | Git                                      |
| `data01`, pools, images             | ✅ / ⏸️ | `data01` ✅; `aux01` ⏸️ (no Slot 3 disk) |
| VM / LXC modules                    | ✅      | Git                                      |
| Retire legacy k3s cloud-init module | ✅      | Kubernetes uses ordinary VMs + kubeadm   |
| Mac control plane                   | ✅      | bootstrap applied                        |
| `infra01` VM                        | ✅      | operator VM on `192.168.68.12`           |

**Existing foundation VMs:** `adguard-01`, `technitium-01`, and `infra01`.
GitLab and kubeadm nodes remain pending and are not the next deployment.

---

## Phase 2 — Source control

| Task                 | Status      |
| -------------------- | ----------- |
| GitHub `nasraldin/*` | ✅          |
| Self-hosted GitLab   | ⏳ optional |

---

## Phase 3 — DNS & networking

| Task                | Status | Note                                          |
| ------------------- | ------ | --------------------------------------------- |
| AdGuard Home        | ✅     | Filtering and child-safety policy is Ansible  |
| Technitium DNS      | ✅     | Authoritative `lab.nasraldin.com`             |
| Current DNS VMs     | ✅     | AdGuard `.10`; Technitium `.11` on live `/22` |
| IPv4 DHCP → AdGuard | ✅     | TP-Link primary DNS = `192.168.68.10`         |
| TP-Link IPv6 RDNSS  | ⏸️     | Deco UI has no IPv6 DNS controls              |
| Mac DNS pin         | ✅     | Wi-Fi DNS = AdGuard (bypasses ISP IPv6 RA)    |
| OPNsense VLAN Pilot | ⏸️     | archived; live LAN stays flat                 |
| VLAN segmentation   | ⏸️     | deferred until needed (e.g. with kubeadm)     |

See [network-dns-ingress.md](../architecture/network-dns-ingress.md).

---

## Phase 4 — OPNsense VLAN pilot (archived)

The bounded pilot was proven in July 2026, then **removed from the live lab**
on 2026-07-23 to keep the stage simple (flat TP-Link + AdGuard + Technitium).
Code and docs live on branch `archive/opnsense-vlan-pilot` in `homelab`,
`terraform-lab`, `ansible-lab`, and `proxmox-bootstrap`. Restore from that
branch only when real VLAN / edge firewall practice is needed.

---

## Phase 5 — Monitoring

Prometheus, Grafana, Loki, Alertmanager — deploy via Argo CD (⏳).

---

## Phase 6 — Kubernetes (kubeadm)

| Task                                 | Status | Notes                                                         |
| ------------------------------------ | ------ | ------------------------------------------------------------- |
| Debian VMs (Terraform)               | ⏳     | `terraform-lab` VM module                                     |
| kubeadm Stage A (1 CP + 2 workers)   | ⏳     | [kubeadm-architecture](../kubernetes/kubeadm-architecture.md) |
| kubeadm Stage B (3 CP + HAProxy)     | ⏳     | After Stage A stable                                          |
| Cilium, cert-manager, metrics-server | ⏳     | Phase 6b                                                      |
| Longhorn, NGINX Ingress, KEDA        | ⏳     | Phase 6b                                                      |
| Talos cluster (optional)             | 🔮     | [guest-os](../guest-os/index.md)                              |

---

## Phase 7 — GitOps

Argo CD bootstrap, app-of-apps, no permanent manual `kubectl` (⏳).

---

## Phase 8 — Core platform services

Harbor, Keycloak, MinIO, PostgreSQL, Redis, RabbitMQ — in k8s via Argo CD (⏳).

---

## Phase 9 — Kubernetes operations

KEDA, ExternalDNS, ESO, Kyverno, Velero, OpenTelemetry (⏳). Longhorn in Phase 6b.

---

## Phase 10 — AI platform

Ollama, Open WebUI, LiteLLM, Qdrant (⏳).

---

## Phase 11 — Developer platform

Runners, SonarQube, Renovate, Trivy, Backstage (⏳).
