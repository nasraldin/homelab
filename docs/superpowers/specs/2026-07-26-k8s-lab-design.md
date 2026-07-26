# Design: k8s-lab HA kubeadm + homelab-gitops

**Date:** 2026-07-26  
**Status:** Accepted — implement as sibling repos `k8s-lab` and `homelab-gitops`  
**Scope:** New git repos under the homelab workspace root; curriculum hub links only

## Goals

- Production-style **HA kubeadm** cluster: **3 control planes + 3 workers** on Debian VMs under Proxmox
- **HAProxy** in front of the Kubernetes API (`:6443`) for zero-downtime control-plane maintenance
- **Cilium** as CNI with **LoadBalancer IPAM**, **L2 Announcements**, and **Gateway API** (north-south)
- **Istio** for east-west mesh (mTLS / traffic policy) — not for public ingress
- Separate **`homelab-gitops`** repo for Argo CD day-2 apps (DRY, single source of truth in Git)
- Balanced VM sizing that can be **resized later** via Terraform without rebuilding the cluster
- Documented drills: HA API, CP upgrades, etcd backup/restore, scheduling/affinity, platform stack
- Latest non-deprecated channels (`pkgs.k8s.io`, current stable charts)

## Decisions (locked)

| Topic | Choice |
| ----- | ------ |
| VM ownership | **`k8s-lab/terraform`** owns HAProxy + 3 CP + 3 workers (own state). `terraform-lab` stays non-k8s. |
| Ingress / mesh | Cilium Gateway API + LB IPAM + L2; Istio mesh only |
| Talos | Primary path = kubeadm on Debian. Talos = **docs-only** future optional path |
| Observability | **In-cluster** Prometheus + Grafana + Loki + Tempo via Argo; `monitoring-01` stays for non-k8s |
| GitOps | Bootstrap in `k8s-lab`; apps in separate **`homelab-gitops`** |
| Sizing | Balanced (option 1); resize later via Terraform |
| Approach | Layered bootstrap: TF → Ansible → Cilium+Argo scripts → GitOps |

## Architecture

```text
Layer 1 — k8s-lab/terraform
  haproxy-01 + k8s-cp-01..03 + k8s-w-01..03  (Proxmox VMs)

Layer 2 — k8s-lab/ansible + scripts
  OS, containerd, kubeadm HA, HAProxy, labels, etcd cron
  one-shot: Cilium (CNI+LB+L2+Gateway API), Argo CD

Layer 3 — homelab-gitops (Argo CD)
  cert-manager, Kyverno, Longhorn, Istio, observability, practice apps
```

### API HA path

```text
kubectl / kubelet / kubeadm
  → kube-api.lab.nasraldin.com:6443
  → HAProxy (TCP, health-check :6443)
  → k8s-cp-01..03:6443
```

- Stacked etcd on three control planes
- `kubeadm init --control-plane-endpoint=kube-api.lab.nasraldin.com:6443 --upload-certs`

### North-south vs east-west

| Traffic | Owner |
| ------- | ----- |
| Public / LAN HTTP(S) into cluster | **Cilium Gateway API** + LB IPAM + L2 Announcements |
| Pod-to-pod policy / mTLS | **Istio** |
| Non-k8s guest metrics/logs | Existing `monitoring-01` (unchanged) |

## Inventory (sizing 1 — resizable)

Suggested LAN addresses avoid existing `.10–.27` guests. Final values live in `k8s-lab` tfvars / group_vars.

| VMID band | Guest | Example IP | vCPU / RAM / disk | Role |
| --------- | ----- | ---------- | ----------------- | ---- |
| 3xx | `haproxy-01` | `192.168.68.40` | 1 / 1 GB / 20 GB | API LB |
| 3xx | `k8s-cp-01..03` | `.41–.43` | 2 / 4 GB / 40 GB each | Control plane + stacked etcd |
| 3xx | `k8s-w-01..03` | `.44–.46` | 4 / 8 GB / 60 GB OS + ~50 GB data each | Workloads + Longhorn |
| — | Cilium LB pool | `192.168.68.100–119` | — | LoadBalancer / Gateway VIP range |

- Pod CIDR: `10.244.0.0/16`
- Service CIDR: `10.96.0.0/12`
- Worker labels (scheduling practice): e.g. `workload=apps`, `workload=platform`, `workload=storage` (exact map in Ansible group_vars)

**Resize later:** edit Terraform `memory` / `cores` (and disks) → `terraform apply`. Documented as a day-2 op; no cluster rebuild required for simple vertical scale.

## Target versions

| Component | Target |
| --------- | ------ |
| Kubernetes | **1.36.x** latest patch (`pkgs.k8s.io`) |
| Guest OS | Debian 12 or 13 cloud image |
| Runtime | **containerd** |
| CNI / Gateway | Cilium (current stable Helm chart) |
| Mesh | Istio (current stable) |
| GitOps | Argo CD |
| Policy | Kyverno |
| Certs | cert-manager |
| Storage | Longhorn |
| Observability | kube-prometheus-stack + Loki + Tempo |

Pin versions in Ansible `group_vars` and GitOps values; bump deliberately. Do **not** use deprecated Kubernetes apt mirrors.

## Repo layouts

### `k8s-lab/`

```text
k8s-lab/
├── README.md
├── docs/                 # HA, upgrades, etcd DR, Cilium, Istio handoff, Talos notes
├── terraform/            # own state: 7 VMs
├── ansible/
│   ├── inventory/
│   ├── playbooks/
│   ├── roles/            # common, containerd, kubernetes, haproxy, etcd_backup
│   └── group_vars/       # versions, CIDRs, labels, LB pool
├── scripts/              # install-cilium.sh, install-argocd.sh, etcd-restore.sh, verify.sh
├── config/               # kubeadm ClusterConfiguration examples
└── Makefile
```

### `homelab-gitops/`

```text
homelab-gitops/
├── bootstrap/root-app.yaml
├── clusters/prod/
├── platform/
│   ├── cert-manager/
│   ├── kyverno/
│   ├── longhorn/
│   ├── istio/
│   ├── observability/    # Prometheus, Grafana, Loki, Tempo
│   └── …
└── apps/                 # affinity / scheduling practice workloads
```

### Hub (`homelab`)

- Add `"k8s-lab"` and `"homelab-gitops"` to `repos.json`
- Link from README + `docs/kubernetes/`
- Update platform-tooling ownership table: k8s VMs → `k8s-lab`, not `terraform-lab`

## Bootstrap order

1. **Terraform** — create 7 VMs  
2. **Ansible** — OS, containerd, kube packages, HAProxy, kubeadm init/join, labels, etcd backup cron  
3. **Script** — Cilium with CNI + LoadBalancer IPAM + L2 Announcements + Gateway API  
4. **Script** — Argo CD once; register `homelab-gitops`  
5. **Argo sync** — cert-manager → Kyverno → Longhorn → Istio → observability → sample apps  

Manual / Ansible must **not** Helm-install day-2 platform charts after Argo is live (no dual source of truth).

## Day-2 operations (documented in `k8s-lab/docs/`)

| Topic | Practice |
| ----- | -------- |
| HA API | Drain/stop one CP; kubectl via HAProxy still works |
| Zero-downtime CP upgrade | `kubeadm upgrade` one node at a time behind LB |
| etcd backup / restore | Cron snapshot (+ optional copy to AIStor); restore drill |
| Scheduling | Labels/taints + affinity sample apps in GitOps |
| Vertical resize | Terraform bump → apply |
| Policy / GitOps | Kyverno + Argo; no manual kubectl for permanent config |
| Talos | Architecture comparison only until a future optional cluster |

## Out of scope (v1)

- Provisioning a Talos cluster  
- Moving non-k8s VMs out of `terraform-lab`  
- Ansible/Helm for long-lived platform apps after Argo exists  
- Replacing `monitoring-01` for non-k8s guests  

## Success criteria

- `kubectl` works only through `kube-api.lab.nasraldin.com:6443` (HAProxy)
- Three Ready control planes and three Ready workers with intended labels
- Cilium provides CNI, allocates LB IPs from the pool, announces via L2, and serves Gateway API
- Argo CD syncs platform stack including metrics, logs, and traces
- etcd backup job exists; restore runbook is executable
- Docs under `k8s-lab/docs/` are detailed, human-readable, and match this design

## Related

- [kubeadm architecture](../../kubernetes/kubeadm-architecture.md) (hub curriculum; this design supersedes VM ownership for k8s nodes)
- [GitOps bootstrap](../../kubernetes/gitops-bootstrap.md)
- [Platform tooling](../../platform-tooling.md)
- [Guest OS](../../guest-os/index.md)
