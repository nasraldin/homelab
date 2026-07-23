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

| Service                                   | Place                         | Phase    | Notes                                                                                                                |
| ----------------------------------------- | ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| **Proxmox VE**                            | Host                          | 0        | Only hypervisor                                                                                                      |
| **Terraform**                             | Mac + Git                     | 1        | Not a server — IaC in repos                                                                                          |
| **GitLab CE**                             | 🖥 **Dedicated VM** (`data01`) | 2        | Source of truth; **not** inside k8s                                                                                  |
| **GitLab Runner**                         | 🖥 **VM** (`runner-01`) then ☸ | 2 / 8    | Docker executor VM pre-k8s; in-cluster runners later for scale                                                       |
| **GitHub Runner**                         | ☸ k8s                         | 11       | `actions-runner-controller` when needed                                                                              |
| **HAProxy**                               | 🖥 VM                          | 6        | API VIP `:6443` for kubeadm HA                                                                                       |
| **PBS**                                   | 🖥 Dedicated VM                | backup   | Stage 3 — Dell or separate disk                                                                                      |
| **AdGuard / Technitium**                  | 🖥 Debian 13 VMs               | 3        | DNS — outside k8s (`.10` / `.11` on `data01`)                                                                        |
| **kubeadm cluster**                       | 🖥 3–5 VMs                     | 6        | CP + workers on `data01`                                                                                             |
| **k3s**                                   | 🧪 Skip / legacy              | —        | Replaced by kubeadm for CKA                                                                                          |
| **Talos**                                 | 🧪 Optional 2nd cluster       | later    | Learning only                                                                                                        |
| **Cilium**                                | ☸ k8s                         | 6b       | First addon after kubeadm                                                                                            |
| **Longhorn**                              | ☸ k8s                         | 6b/9     | PVCs — **extra vdisk per worker** on `data01`                                                                        |
| **cert-manager**                          | ☸ k8s                         | 6b       | TLS                                                                                                                  |
| **NGINX Ingress**                         | ☸ k8s                         | 6b       | **Not Traefik** (lab standard)                                                                                       |
| **metrics-server**                        | ☸ k8s                         | 6b       | `kubectl top`                                                                                                        |
| **KEDA**                                  | ☸ k8s                         | 6b       | Autoscaling                                                                                                          |
| **Argo CD**                               | ☸ k8s                         | 7        | **Bootstrap once** — then Git owns cluster                                                                           |
| **Helm**                                  | 📦 via Argo CD                | 7        | Not manual `helm install` after bootstrap                                                                            |
| **Harbor**                                | ☸ k8s                         | 8        | Registry — [harbor-registry.md](../platform/harbor-registry.md)                                                      |
| **Zot**                                   | 🧪 Lab VM or skip             | —        | Pick Harbor **or** Zot — not both long-term                                                                          |
| **Prometheus**                            | ☸ k8s                         | 9        |                                                                                                                      |
| **Grafana**                               | ☸ k8s                         | 9        |                                                                                                                      |
| **Loki**                                  | ☸ k8s                         | 9        | App logs                                                                                                             |
| **Alertmanager**                          | ☸ k8s                         | 9        |                                                                                                                      |
| **node-exporter**                         | ☸ k8s DaemonSet               | 9        |                                                                                                                      |
| **kube-state-metrics**                    | ☸ k8s                         | 9        |                                                                                                                      |
| **Elasticsearch / Kibana**                | ☸ k8s (optional)              | 10+      | Prefer Loki first; ES if you want ELK practice                                                                       |
| **Redis**                                 | ☸ k8s                         | 8        | Operator or Helm                                                                                                     |
| **PostgreSQL**                            | ☸ k8s                         | 8        | CloudNativePG for lab                                                                                                |
| **MySQL / MariaDB**                       | ☸ k8s                         | app      | Per-app or operator                                                                                                  |
| **MongoDB / CouchDB / etc.**              | ☸ k8s                         | app      | When an app needs it                                                                                                 |
| **RabbitMQ**                              | ☸ k8s                         | 8        |                                                                                                                      |
| **Keycloak**                              | ☸ k8s                         | 8        |                                                                                                                      |
| **Vault**                                 | TBD                           | pre-k8s  | Separate design; ESO integration comes later                                                                         |
| **Infisical**                             | ☸ k8s                         | alt      | Pick Vault **or** Infisical                                                                                          |
| **MinIO / AIStor**                        | ☸ k8s                         | 8        | Object storage                                                                                                       |
| **ExternalDNS**                           | ☸ k8s                         | 9        | When AdGuard API stable                                                                                              |
| **Kyverno**                               | ☸ k8s                         | 9        | Policy                                                                                                               |
| **Velero**                                | ☸ k8s                         | 9        | K8s backup → MinIO                                                                                                   |
| **Falco**                                 | ☸ k8s                         | 9        | Runtime security                                                                                                     |
| **Wazuh**                                 | 🖥 VM                          | 11+      | SIEM — not in k8s                                                                                                    |
| **n8n**                                   | ☸ k8s                         | 10       | **Workflow only** — not ITSM; see [itsm-and-automation.md](../platform/itsm-and-automation.md)                       |
| **Zammad**                                | ☸ k8s                         | 10+      | Customer tickets when building SaaS                                                                                  |
| **GLPI / iTop**                           | 🖥 VM or lab                   | optional | Internal ITIL / ServiceNow-style practice                                                                            |
| **Ollama**                                | ☸ k8s or GPU VM               | 10       | Host IOMMU/`iommu=pt` via bootstrap; VFIO + Radeon 890M passthrough later — [gpu-passthrough.md](gpu-passthrough.md) |
| **Open WebUI**                            | ☸ k8s                         | 10       |                                                                                                                      |
| **SonarQube**                             | ☸ k8s                         | 11       |                                                                                                                      |
| **Uptime Kuma**                           | 🖥 **Docker VM** or ☸          | 5        | **VM preferred** — alerts when k8s is down                                                                           |
| **Vaultwarden**                           | 🖥 Docker VM                   | optional | Small, personal                                                                                                      |
| **Mealie**                                | ☸ k8s or Docker VM            | app      | Low priority                                                                                                         |
| **Portainer**                             | 🖥 Docker VM                   | lab      | Manages Docker, not k8s                                                                                              |
| **Docker Engine**                         | 🖥 Utility VM                  | lab      | Compose experiments                                                                                                  |
| **Podman**                                | 🖥 Utility VM                  | lab      | RHEL-style practice                                                                                                  |
| **Docker Swarm**                          | 🖥 Separate lab VM             | 🧪       | Do not mix with kubeadm                                                                                              |
| **Dokku / Coolify / Easypanel / Dokploy** | 🖥 Separate lab VM             | 🧪       | PaaS experiments — one at a time                                                                                     |
| **Ceph**                                  | ⛔ Skip                       | —        | Needs 3+ **physical** nodes                                                                                          |
| **Istio**                                 | ☸ optional                    | later    | After NGINX + Cilium solid                                                                                           |
| **API Gateway** (Kong/APISIX)             | ☸ k8s                         | 8+       | After ingress basics                                                                                                 |
| **Jenkins**                               | 🖥 VM or ☸                     | optional | GitLab CI is primary                                                                                                 |
| **Cachet**                                | ☸ k8s                         | app      | Status page                                                                                                          |

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

**Sizing:** 4 vCPU, **8 GB RAM**, 100 GB disk on `data01` (`gitlab-01`, VMID 113,
`192.168.68.14`). Public URL: `https://gitlab.nasraldin.com` (Tunnel, no Access).

**Runner:** dedicated `runner-01` (VMID 114, `192.168.68.15`, 4 vCPU / 4 GB /
60 GB) with Docker executor. In-cluster runners come later after kubeadm.

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
| GitLab VM                  | Dokku / Coolify / Dokploy  |
| kubeadm + Cilium           | Second distro (k3s/Talos)  |
| Longhorn + Argo CD         | Ceph                       |
| Harbor, Keycloak, Postgres | Elasticsearch (after Loki) |

---

## Related

- [proxmox-storage-layout.md](proxmox-storage-layout.md)
- [target-topology.md](target-topology.md)
- [gitops-bootstrap.md](../kubernetes/gitops-bootstrap.md)
- [platform-tooling.md](../platform-tooling.md)
