# Decide What Runs on a VM, in Kubernetes, or in Docker

Put each service where it belongs by failure domain — not wherever it _can_ run. GitLab and backups stay outside the cluster so you can still recover when Kubernetes is down; Argo CD owns what runs inside.

Aligned with [platform-tooling.md](../platform-tooling.md): Terraform creates VMs; kubeadm once; Argo CD for in-cluster apps.

## What this page covers

- Layer model from Proxmox host through GitOps
- Master placement table (VM vs k8s vs lab) by phase
- Why GitLab is a dedicated VM, not in-cluster
- Docker utility VM sizing and Longhorn disk layout
- What to run now vs defer as isolated lab experiments

## Layer model

```text
Layer 0  Proxmox          hypervisor, ZFS, vzdump only
Layer 1  VMs              GitLab, HAProxy, PBS, Docker lab — recover k8s if broken
Layer 2  Kubernetes       kubeadm cluster (in VMs, never on bare metal)
Layer 3  GitOps           Argo CD → Helm charts from Git
```

**Recoverability rule:** if Kubernetes dies, you must still reach **Git** (GitLab VM) and **backups** (aux01 / PBS).

---

## Master placement table

| Service                                   | Place                                   | Phase    | Notes                                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Proxmox VE**                            | Host                                    | 0        | Only hypervisor                                                                                                                                                          |
| **Terraform**                             | Mac + Git                               | 1        | Not a server — IaC in repos                                                                                                                                              |
| **GitLab CE**                             | 🖥 **Dedicated VM** (`data01`)           | 2        | Source of truth; **not** inside k8s                                                                                                                                      |
| **GitLab Runner**                         | 🖥 **VM** (`runner-01` fleeting manager) | 2        | docker-autoscaler + fleeting; no fat runner-02                                                                                                                           |
| **Vault**                                 | 🖥 **VM** (`vault-01` + `vault-seal`)    | ✅ core  | Infra/crypto secrets + Transit auto-unseal — LAN `:8200`; [vault.md](../operations/vault.md)                                                                             |
| **Infisical**                             | 🖥 Compose on **`docker-01`**            | ⏳       | App env-secrets; DB via PgCat on database-01; [infisical.md](../operations/infisical.md)                                                                                 |
| **PostgreSQL (lab central)**              | 🖥 **`database-01`** + PgCat             | ⏳ core  | Shared relational DB for Keycloak/Infisical/Sonar; [database-01.md](../operations/database-01.md)                                                                        |
| **Keycloak**                              | 🖥 Compose on **`docker-01`**            | ⏳ core  | [keycloak.md](../operations/keycloak.md)                                                                                                                                 |
| **SonarQube**                             | 🖥 **`sonarqube-01`**                    | ⏳ core  | Dedicated VM; JDBC → PgCat; Tunnel `sonar.nasraldin.com`                                                                                                                 |
| **Elasticsearch / Kibana**                | 🖥 **`elastic-01`**                      | ⏳ core  | Option A: Loki remains primary logs; [elastic.md](../operations/elastic.md)                                                                                              |
| **Prometheus / Grafana / Loki**           | 🖥 **`monitoring-01`**                   | ⏳ core  | Day-one fleet telemetry; k8s monitoring still later phase                                                                                                                |
| **NPM / it-tools / mailpit**              | 🖥 **`docker-01`**                       | ⏳ core  | [docker-hosts.md](../operations/docker-hosts.md)                                                                                                                         |
| **Dockhand**                              | 🖥 LXC **200**                           | ⏳ core  | `docker.nasraldin.com` + Access                                                                                                                                          |
| **AIStor Free**                           | 🖥 **VM** (`aistor-01`)                  | ✅ core  | Shared S3 — GitLab + runner cache + Vault snapshots; [object-storage.md](../operations/object-storage.md)                                                                |
| **MinIO in-cluster**                      | ☸ optional later                        | 8+       | Only if a second S3 domain is needed; do not replace AIStor for GitLab                                                                                                   |
| **ExternalDNS**                           | ☸ k8s                                   | 9        | When AdGuard API stable                                                                                                                                                  |
| **Kyverno**                               | ☸ k8s                                   | 9        | Policy                                                                                                                                                                   |
| **Velero**                                | ☸ k8s                                   | 9        | K8s backup → MinIO                                                                                                                                                       |
| **Falco**                                 | ☸ k8s                                   | 9        | Runtime security                                                                                                                                                         |
| **Wazuh**                                 | 🖥 VM                                    | 11+      | SIEM — not in k8s                                                                                                                                                        |
| **Ollama**                                | 🖥 **GPU VM** (dev-homelab: `ai-01`)     | 10       | Radeon 890M VFIO; UIs via **LiteLLM** — [dev-homelab ai-stack](https://nasraldin.github.io/dev-homelab/architecture/ai-stack) · [gpu-passthrough.md](gpu-passthrough.md) |
| **LiteLLM**                               | ☸ k8s                                   | 10       | OpenAI gateway → Ollama only                                                                                                                                             |
| **Open WebUI** / LibreChat / AnythingLLM  | ☸ k8s                                   | 10       | Through LiteLLM — not Ollama direct                                                                                                                                      |
| **n8n**                                   | ☸ k8s                                   | 10       | **Workflow only** — LLM via LiteLLM OpenAI creds; [itsm-and-automation.md](../platform/itsm-and-automation.md)                                                           |
| **Zammad**                                | ☸ k8s                                   | 10+      | Customer tickets when building SaaS                                                                                                                                      |
| **GLPI / iTop**                           | 🖥 VM or lab                             | optional | Internal ITIL / ServiceNow-style practice                                                                                                                                |
| **Uptime Kuma**                           | 🖥 **Docker VM** or ☸                    | 5        | **VM preferred** — alerts when k8s is down                                                                                                                               |
| **Vaultwarden**                           | 🖥 Docker VM                             | optional | Small, personal                                                                                                                                                          |
| **Mealie**                                | ☸ k8s or Docker VM                      | app      | Low priority                                                                                                                                                             |
| **Portainer**                             | 🖥 Docker VM                             | lab      | Manages Docker, not k8s                                                                                                                                                  |
| **Docker Engine**                         | 🖥 Utility VM                            | lab      | Compose experiments                                                                                                                                                      |
| **Podman**                                | 🖥 Utility VM                            | lab      | RHEL-style practice                                                                                                                                                      |
| **Docker Swarm**                          | 🖥 Separate lab VM                       | 🧪       | Do not mix with kubeadm                                                                                                                                                  |
| **Dokku / Coolify / Easypanel / Dokploy** | 🖥 Separate lab VM                       | 🧪       | PaaS experiments — one at a time                                                                                                                                         |
| **Ceph**                                  | ⛔ Skip                                 | —        | Needs 3+ **physical** nodes                                                                                                                                              |
| **Istio**                                 | ☸ optional                              | later    | After NGINX + Cilium solid                                                                                                                                               |
| **API Gateway** (Kong/APISIX)             | ☸ k8s                                   | 8+       | After ingress basics                                                                                                                                                     |
| **Jenkins**                               | 🖥 VM or ☸                               | optional | GitLab CI is primary                                                                                                                                                     |
| **Cachet**                                | ☸ k8s                                   | app      | Status page                                                                                                                                                              |

### Legend

| Icon | Meaning                                         |
| ---- | ----------------------------------------------- |
| 🖥    | Proxmox VM or LXC on `data01`                   |
| ☸    | Inside kubeadm cluster                          |
| 🧪   | Isolated lab — do not run on production cluster |
| 📦   | Tooling, not a workload                         |

---

## GitLab: dedicated VM (not Docker sidecar pile)

| Approach                        | Verdict                                                 |
| ------------------------------- | ------------------------------------------------------- |
| **GitLab Omnibus on Debian VM** | ✅ **Recommended** — official, one package, easy backup |
| GitLab in Docker on utility VM  | OK for learning — more moving parts                     |
| GitLab inside Kubernetes        | ❌ **Avoid** — if k8s dies, you lose Git + Argo source  |

**Sizing:** 6 vCPU, **16 GB RAM**, 120 GB disk on `data01` (`gitlab-01`, VMID 116,
`192.168.68.14`). Public URL: `https://gitlab.nasraldin.com` (Tunnel, no Access).

**Runners:** `runner-01` (VMID 117, `.15`) is the **fleeting manager only** (light
Docker executor until autoscaler API is wired). No static fat `runner-02`.
Object store + cache on `aistor-01` (VMID 115). Secrets on `vault-01` (VMID 113);
Transit seal helper `vault-seal` (VMID 114). App env-secrets: **Infisical on
`docker-01`** (VMID 119, `.22`) with Postgres via PgCat on `database-01` (VMID 118).
Full map: [guest-vmid-map.md](../operations/guest-vmid-map.md) ·
[secret-ownership-map.md](secret-ownership-map.md).

**Companion on GitLab VM:** none — keep Omnibus alone. Not Portainer, not Mealie.

---

## Docker utility VM

| Spec | Value             |
| ---- | ----------------- |
| vCPU | 4                 |
| RAM  | 4–8 GB            |
| Disk | 60 GB on `data01` |
| OS   | Debian 12         |

**Use for:** Portainer, Podman practice, Docker Swarm lab, Uptime Kuma, Vaultwarden, Compose experiments.

**Do not use for:** GitLab (separate VM), Kubernetes nodes, production databases.

---

## Longhorn — where and how

Longhorn runs **inside Kubernetes** but stores data on **Proxmox virtual disks**.

```text
worker1 VM (data01)
├── scsi0  60 GB   OS root
└── scsi1  200 GB  Longhorn data  ← add in Terraform / Proxmox UI

worker2 VM
├── scsi0  60 GB
└── scsi1  200 GB
```

1. Terraform: extra `disk` per worker on `data01`
2. In guest: leave unformatted — Longhorn discovers `/dev/sdb`
3. Install Longhorn via Helm (bootstrap) or Argo CD (Phase 7+)
4. **Default replica count = 2** on two workers (not true HA on one host — learning only)

Do **not** put Longhorn on the OS disk or on Slot 3 (`aux01`).

Details: [gitops-bootstrap.md](../kubernetes/gitops-bootstrap.md).

---

## What to run in parallel vs later

| Run now (foundation)       | Defer (lab VMs)            |
| -------------------------- | -------------------------- |
| Proxmox + bootstrap        | Docker Swarm               |
| GitLab + Vault + AIStor    | Dokku / Coolify / Dokploy  |
| kubeadm + Cilium           | Second distro (k3s/Talos)  |
| Longhorn + Argo CD         | Ceph                       |
| Harbor, Keycloak, Postgres | Elasticsearch (after Loki) |

---

## Related

- [proxmox-storage-layout.md](proxmox-storage-layout.md)
- [target-topology.md](target-topology.md)
- [gitops-bootstrap.md](../kubernetes/gitops-bootstrap.md)
- [platform-tooling.md](../platform-tooling.md)
