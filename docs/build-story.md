# Build story — from zero to platform lab

A human-readable timeline of building this homelab. Technical detail lives in
linked docs — this page is the **narrative spine**.

**Status today:** [current-state.md](current-state.md) (🔄 setup — Phase 0 automation pending)

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
3. Static `192.168.1.10/24`, FQDN `pve01.lab.example.com`
4. Fixed DNS trap: Cloudflare wildcard broke `*.lab` — interim `/etc/hosts`
5. SSH keys from Mac, Terraform API user created

**Problems catalogued:** wrong-disk install, Ghostty `TERM`, Cosign quoting — see
[installation/issues-tracker.md](installation/issues-tracker.md).

→ [installation/journey.md](installation/journey.md)

---

## Chapter 4 — Automation written (Phase 0b) 🟡 ← **you are here**

Repos created and pushed; **not yet applied** on `pve01`:

| Layer | Repo | What it does |
| ----- | ---- | ------------ |
| 0 | `proxmox-bootstrap` | Repos, ZFS tune, ARC cap, admin user, update checks |
| 1 | `terraform-lab` | `data01`, `aux01`, vzdump jobs, VMs when defined |
| Edge | `cloudflare-tunnel` | `homelab.example.com` → PVE UI |
| Docs | `homelab-docs` | This story, roadmap, architecture |

**Next:** Run bootstrap → Terraform apply → tunnel → prove restore drill.

→ [installation/next-steps.md](installation/next-steps.md)  
→ [roadmap/foundation-sequence.md](roadmap/foundation-sequence.md)

---

## Chapter 5 — DNS and GitLab (Phase 2–3) ⏳

**Planned:**

- AdGuard + Technitium VMs — replace `/etc/hosts` hacks
- **GitLab CE on dedicated VM** (`data01`) — Git for GitOps; survives k8s outages
- GitHub repos remain; GitLab is self-hosted source of truth for cluster config

→ [architecture/network-dns-ingress.md](architecture/network-dns-ingress.md)

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

**Core services (via Argo):** Harbor, Keycloak, Vault, MinIO, Postgres, Redis,
RabbitMQ.

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

Ollama, Open WebUI, GitLab Runners in k8s, SonarQube, optional ELK if learning
Elasticsearch.

→ [architecture/service-placement.md](architecture/service-placement.md)

---

## How chapters map to phases

| Chapter | Roadmap phases |
| ------- | -------------- |
| 1–2 | Planning (all) |
| 3 | Phase 0a ✅ |
| 4 | Phase 0b–1 🔄 |
| 5 | Phase 2–3 |
| 6 | Phase 6 |
| 7 | Phase 7–8 |
| 8 | Phase 9–11 |
| 9 | Phase 10–11 |

Task tables: [roadmap/phases.md](roadmap/phases.md)

---

## Reading order for newcomers

1. [current-state.md](current-state.md) — where we are **now**
2. [build-story.md](build-story.md) — this page
3. [installation/next-steps.md](installation/next-steps.md) — what to run next
4. [platform-tooling.md](platform-tooling.md) — who owns what
5. Deep dives by topic from [README.md](README.md)
