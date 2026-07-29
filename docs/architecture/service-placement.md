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
| **Vault**                                 | 🖥 **VM** (`vault-01` + `vault-seal`) _or_ deferred in lab-home-k8s | ✅/⏳ | Infra/crypto — [vault.md](../operations/vault.md). lab-home-k8s may use Infisical + bootstrap secrets first |
| **Infisical**                             | 📦 **LXC** `infisical-01` (`.25`)            | ✅ live   | App env-secrets + local Postgres/Redis; [infisical.md](../operations/infisical.md) · [lab-restructure](../operations/lab-restructure-2026-07-30.md) |
| **AdGuard / Technitium**                  | 📦 **LXC** `adguard-01` / `dns-01` (`.10`/`.11`) | ✅ live | Dedicated 512M/10G CTs — not on infra-01 |
| **PostgreSQL (lab central)**              | 🖥 **`database-01`** + PgCat _or_ CNPG in k8s | ⏳ | terraform-lab: shared PG; lab-home-k8s: CNPG in `database` NS + Infisical-local PG |
| **Keycloak**                              | ☸ interim `apps` / later **`docker-01`**   | ⏳ core  | [keycloak.md](../operations/keycloak.md)                                                                                                                                 |
| **SonarQube**                             | ☸ interim `apps` / later dedicated VM      | ⏳ core  | [sonarqube.md](../operations/sonarqube.md)                                                                                                                               |
| **Elasticsearch / Kibana**                | 🖥 **`elastic-01`** (terraform-lab)        | ⏳       | Option A: Loki primary; [elastic.md](../operations/elastic.md)                                                                                                           |
| **Prometheus / Grafana / Loki**           | ☸ `observability` (lab-home-k8s)           | ✅/⏳    | Also terraform-lab `monitoring-01` for fleet hosts                                                                                                                       |
| **NPM / Stalwart / it-tools / mailpit**   | 🖥 **`docker-01`** (`.21`)                 | ✅ live   | [docker-hosts.md](../operations/docker-hosts.md) · [stalwart.md](../operations/stalwart.md)                                                                              |
| **Dockhand / Portainer**                  | 🖥 **`docker-01`**                         | ✅ live   | CTs 118/119 destroyed; [dockhand.md](../operations/dockhand.md)                                                                                                           |
| **AIStor Free**                           | 🖥 **`docker-01`** (lab-home-k8s)          | ✅ live   | S3 `:9000`/`:9001` on docker-01; terraform-lab still uses `aistor-01` — [object-storage.md](../operations/object-storage.md)                                           |
| **infra-01**                              | 📦 Jumpbox LXC 124 (`.14`)                 | ✅ live  | SSH/operator only — no DNS/NPM/Infisical/AIStor                                                                                                                          |
| **MinIO in-cluster**                      | ☸ optional later                        | 8+       | Only if a second S3 domain is needed; do not replace AIStor for GitLab                                                                                                   |
| **ExternalDNS**                           | ☸ k8s                                   | 9        | When AdGuard API stable                                                                                                                                                  |
| **Kyverno**                               | ☸ k8s                                   | 9        | Policy                                                                                                                                                                   |
| **Velero**                                | ☸ k8s                                   | 9        | K8s backup → MinIO                                                                                                                                                       |
| **Falco**                                 | ☸ k8s                                   | 9        | Runtime security                                                                                                                                                         |
| **Wazuh**                                 | 🖥 VM                                    | 11+      | SIEM — not in k8s                                                                                                                                                        |
| **Ollama**                                | 📦 **LXC** `llm-01` (`.26`)              | 10       | **Live** host `amdgpu` + `/dev/dri`/`kfd`; UIs via **LiteLLM** — [ollama-llm-01.md](../operations/ollama-llm-01.md) · standby VM `ai-01` (do not delete) |
| **LiteLLM**                               | ☸ k8s                                   | 10       | OpenAI gateway → Ollama only                                                                                                                                             |
| **LibreChat** / OpenClaw  | ☸ k8s                                   | 10       | Through LiteLLM — not Ollama direct                                                                                                                                      |
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

**lab-home-k8s:** `gitlab-01` VMID **111** at **`192.168.68.15`**. Public URL:
`https://gitlab.nasraldin.com` (Tunnel, no Access). Object store → AIStor on
**`docker-01`** (`.21:9000`). App env-secrets → **`infisical-01`** (`.25`).
In-cluster runner → namespace **`gitops`** — [gitlab-runner-k8s.md](../operations/gitlab-runner-k8s.md).

**terraform-lab** (alternate inventory): see [guest-vmid-map.md](../operations/guest-vmid-map.md).

Full Dev Homelab map: [lab-home-inventory.md](../operations/lab-home-inventory.md) ·
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

## Kubernetes namespaces (in-cluster)

Workloads managed by `lab-home-gitops` use a **few purpose-grouped namespaces**
(not one NS per app). Source of truth:
[`lab-home-gitops/docs/namespace-taxonomy.md`](../../lab-home-gitops/docs/namespace-taxonomy.md).

| Namespace       | Examples                                              |
| --------------- | ----------------------------------------------------- |
| `ai-tools`      | n8n, LibreChat, LiteLLM, OpenClaw                     |
| `observability` | Prometheus, Grafana, Loki, Tempo, OTel                |
| `database`      | CNPG Postgres + Redis/RabbitMQ/MariaDB operators      |
| `artifacts`     | Harbor, Verdaccio                                     |
| `storage`       | Longhorn                                              |
| `security`      | cert-manager, Kyverno, ESO, Infisical operator        |
| `gitops`        | GitLab Runner (k8s), KEDA                             |
| `apps`          | Keycloak/Sonar (interim until Docker/VM) + future apps|
| `argocd`        | Argo CD control plane (kept; not renamed to `gitops`) |

System NS (`kube-system`, CNI, etc.) are untouched. PVC moves require recreate
or explicit volume migration — lab default is recreate on cutover.

---

## Related

- [proxmox-storage-layout.md](proxmox-storage-layout.md)
- [target-topology.md](target-topology.md)
- [gitops-bootstrap.md](../kubernetes/gitops-bootstrap.md)
- [platform-tooling.md](../platform-tooling.md)
