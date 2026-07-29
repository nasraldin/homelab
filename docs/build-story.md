# Homelab story — from bare metal to platform

This is the **story** of the lab: what happened in order, and why each call was
made. Deep runbooks live in the linked pages. I’m
[Nasr Aldin](https://nasraldin.com) — this is a Platform Engineering portfolio
on real hardware, not a throwaway laptop VM.

**New here?** Read this page first. Then check
[where things stand](current-state.md) for the live checklist. Use the
[install journal](installation/index.md) and [roadmap](roadmap/index.md) when
you need commands or phase status.

## What this page covers

- Why the lab exists and the principles locked early
- Hardware / storage design and install lessons
- Phase 0: install + host automation (`aux01` still waiting on Slot 3 disk)
- What already shipped after Phase 0, and what is still ahead

---

## Chapter 1 — Why this lab exists

**Goal:** A production-style **Platform Engineering** portfolio on real hardware —
not a toy cluster. Learn the same patterns used in enterprise cloud: IaC, GitOps,
observability, supply chain security, and safe operations.

**Machine:** Minisforum **AI X1 Pro-470** — Ryzen AI 9 HX 470, **96 GB RAM**, three
M.2 slots (two full-speed ×4, one ×1).

**Principles locked early:**

- Proxmox is the hypervisor only — workloads live in VMs and Kubernetes
- Everything reproducible from Git (Terraform, bootstrap scripts, later Argo CD)
- No exposing Proxmox on the public internet — Cloudflare Tunnel + Access
- Backups and recoverability before fancy platform services

→ [platform-tooling.md](platform-tooling.md)

---

## Chapter 2 — Hardware and storage design

We chose a three-tier NVMe layout instead of one big pool:

```text
Slot 1  990 PRO 2TB     Proxmox OS (rpool) — ~20 GB used, rest for bounded backups/ISO
Slot 2  FURY 4TB        data01 — ALL production VM disks
Slot 3  OEM 2TB (×1)    aux01 — vzdump staging, ISO archive, cold data
```

**Lesson learned:** Slot 3 is PCIe **×1** (~2 GB/s max) — never buy a flagship 4 TB
drive for it. The included OEM 2 TB is the right fit.

**Lesson learned:** During first install, both SSDs were in the machine and
`rpool` grew to ~4 TB — wrong disk. **Reinstalled with Samsung only**, then add
FURY via Terraform.

→ [architecture/hardware-and-storage.md](architecture/hardware-and-storage.md)  
→ [architecture/proxmox-storage-layout.md](architecture/proxmox-storage-layout.md)

---

## Chapter 3 — Proxmox install (Phase 0a) ✅

**Done manually** via USB (July 2026):

1. Selected **Samsung 990 PRO by model**, not `nvme0`/`nvme1` order
2. ZFS `rpool`, `ashift=12`, `lz4`, ~8 GB swap
3. Static `192.168.68.13/22`, FQDN `pve01.lab.nasraldin.com`
4. Fixed DNS trap: Cloudflare wildcard broke `*.lab` — interim `/etc/hosts`
5. SSH keys from Mac, Terraform API user created

**Problems catalogued:** wrong-disk install, Ghostty `TERM`, Cosign quoting — see
[installation/issues-tracker.md](installation/issues-tracker.md).

→ [installation/journey.md](installation/journey.md)

---

## Chapter 4 — Automation applied (Phase 0b) ✅

Repos created, pushed, and **applied** on `pve01` (July 2026):

| Layer | Repo                | Status  | What it does                                       |
| ----- | ------------------- | ------- | -------------------------------------------------- |
| 0     | `proxmox-bootstrap` | ✅      | Repos, ZFS, ARC, admin, updates, firewall, IOMMU   |
| 1     | `terraform-lab`     | ✅ / ⏸️ | `data01` + Stage 1 vzdump ✅; `aux01` ⏸️ (no disk) |
| Edge  | `cloudflare-tunnel` | ✅      | Public UI via Tunnel + Access                      |
| Docs  | `homelab`           | ✅      | This story, roadmap, architecture                  |

**Hold:** Slot 3 OEM NVMe not installed → `aux01` / Stage 2 backup migrate deferred.

**Next:** Terraform CI on GitLab (optional) → kubeadm Stage A. Vault + AIStor
are ✅ core Layer-1. NetBird optional. OPNsense/VLANs archived on
`archive/opnsense-vlan-pilot`.

→ [current-state.md](current-state.md)  
→ [installation/next-steps.md](installation/next-steps.md)  
→ [roadmap/foundation-sequence.md](roadmap/foundation-sequence.md)

---

## Chapter 5 — DNS and early platform services ✅

**What we settled on:**

- AdGuard `192.168.68.10` + Technitium `192.168.68.11` on the flat
  `192.168.68.0/22` LAN (no VLAN router in the path today).
- Home DHCP hands IPv4 clients to AdGuard; Deco still has no IPv6 DNS UI, so the
  Mac pins AdGuard when needed.
- An OPNsense VLAN pilot was proven, then archived (2026-07-23) so Wi-Fi Mac
  admin and kubeadm practice stay simple.
- **GitLab CE**, **Vault**, and **AIStor** now run as dedicated VMs on
  `data01` — that recoverability choice shipped; next focus is kubeadm.

→ [network, DNS & ingress](architecture/network-dns-ingress.md)  
→ [where things stand](current-state.md)

---

## Chapter 6 — Kubernetes with kubeadm (Phase 6) ⏳

**Decision:** **kubeadm** (not k3s) for CKA depth and production similarity.

**Staged rollout:**

1. **Stage A:** 1 control plane + 2 workers on `data01`
2. **Stage B:** HAProxy VM + 3 control planes (stacked etcd)

**Cluster addons (6b):** Cilium, cert-manager, metrics-server, NGINX Ingress, KEDA,
Longhorn (extra vdisk per worker).

**Mac side:** Lima + Docker for local container practice — k8s stays on Proxmox.

→ [kubernetes/kubeadm-architecture.md](kubernetes/kubeadm-architecture.md)  
→ [kubernetes/development/mac-lima-docker.md](kubernetes/development/mac-lima-docker.md)

---

## Chapter 7 — GitOps platform (Phase 7–8) ⏳

**Bootstrap once:** kubeadm → Cilium → Longhorn → **Argo CD** → never manual
`helm install` again.

**Git repo layout:** `homelab-gitops` with app-of-apps.

**Core services (via Argo):** Harbor, Keycloak, MinIO, Postgres, Redis,
RabbitMQ. Vault is earlier foundation work with its own design.

→ [kubernetes/gitops-bootstrap.md](kubernetes/gitops-bootstrap.md)  
→ [platform/harbor-registry.md](platform/harbor-registry.md)

---

## Chapter 8 — Security and operations (Phase 9–11) ⏳

**Supply chain:** Trivy + Cosign in CI → Harbor → Kyverno `verifyImages`.

**Observability:** Prometheus, Grafana, Loki (in cluster).

**SOC:** Wazuh on dedicated VM (after monitoring baseline).

**ITSM:** Zammad for customer tickets; n8n for webhooks only.

→ [security/supply-chain-and-policies.md](security/supply-chain-and-policies.md)  
→ [security/wazuh.md](security/wazuh.md)  
→ [platform/itsm-and-automation.md](platform/itsm-and-automation.md)

---

## Chapter 9 — AI and developer platform (Phase 10–11) ⏳

Ollama on **`llm-01`**, LibreChat / LiteLLM / n8n / OpenClaw in k8s **`ai-tools`**,
GitLab Runner in **`gitops`**, Sonar interim in **`apps`**.

→ [architecture/service-placement.md](architecture/service-placement.md) ·
[operations/lab-home-inventory.md](operations/lab-home-inventory.md)

---

## How chapters map to phases

| Chapter | Roadmap phases           |
| ------- | ------------------------ |
| 1–2     | Planning (all)           |
| 3       | Phase 0a ✅              |
| 4       | Phase 0b ✅ (`aux01` ⏸️) |
| 5       | Phase 2–3                |
| 6       | Phase 6                  |
| 7       | Phase 7–8                |
| 8       | Phase 9–11               |
| 9       | Phase 10–11              |

Task tables: [roadmap/phases.md](roadmap/phases.md)

---

## Reading order for newcomers

1. This page — the story and the “why”
2. [Where things stand](current-state.md) — what is live **today**
3. [Install next steps](installation/next-steps.md) — commands after Phase 0
4. [Platform tooling](platform-tooling.md) — which tool owns each layer
5. Topic deep dives from the [docs home](index.md)
