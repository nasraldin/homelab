# Build a Kubernetes Homelab Like a Professional

This section is the Kubernetes track for the lab: a CKA-aligned, production-style cluster on the X1 Pro. We use **kubeadm** on Debian VMs under Proxmox — not k3s, and not a toy cluster on the Mac.

Use the Mac (Lima) only for Docker and image practice. The real control plane, workers, and GitOps live on Proxmox.

## What this page covers

- Index of the kubeadm, GitOps, and Mac Docker docs
- How Mac vs X1 Pro split for learning
- Which roadmap phases own the cluster and addons
- Links to guest OS and foundation sequencing

## Docs

| Doc                                                  | Topic                                        |
| ---------------------------------------------------- | -------------------------------------------- |
| [kubeadm architecture](kubeadm-architecture.md)      | Node layout, HAProxy, sizing (curriculum)    |
| [GitOps bootstrap](gitops-bootstrap.md)              | Argo CD handoff (curriculum)                 |
| **Live runbooks:** sibling [`k8s-lab`](https://github.com/nasraldin/k8s-lab) `docs/` | Terraform VMs, Ansible, Cilium, etcd DR |
| **GitOps apps:** sibling [`homelab-gitops`](https://github.com/nasraldin/homelab-gitops) | Argo app-of-apps |
| [Mac: Lima + Docker](development/mac-lima-docker.md) | Local container practice on Apple Silicon    |

## Learning split

| Machine              | Role                                                           |
| -------------------- | -------------------------------------------------------------- |
| **Mac** (Lima)       | Docker, Compose, image builds, `containerd`/`runc` exploration |
| **X1 Pro** (Proxmox) | Real kubeadm cluster — same patterns as on-prem production     |

Do **not** run your homelab Kubernetes on Lima. CKA and platform engineering practice belong on Proxmox VMs.

## Phase placement

| Phase | Content                                                                 |
| ----- | ----------------------------------------------------------------------- |
| 6a    | `k8s-lab` Terraform VMs + Ansible kubeadm HA (3 CP + 3 workers)         |
| 6b    | Cilium (CNI + LB IPAM + L2 + Gateway API) — scripted once               |
| 7     | Argo CD + `homelab-gitops` (cert-manager, Istio, Longhorn, observability) |
| 8+    | Platform services (Harbor, …)                                           |

North-south HTTP uses **Cilium Gateway API** (not NGINX Ingress). Istio is east-west mesh only.

## Related

- [Guest OS strategy](../guest-os/index.md)
- [Foundation sequence](../roadmap/foundation-sequence.md)
- [Phases §6](../roadmap/phases.md#phase-6--kubernetes)
