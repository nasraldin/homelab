# Kubernetes

CKA-focused, production-style Kubernetes on the X1 Pro — **kubeadm**, not k3s.

## Docs

| Doc | Topic |
| --- | ----- |
| [kubeadm architecture](kubeadm-architecture.md) | Node layout, HAProxy, sizing, cluster addons |
| [GitOps bootstrap](gitops-bootstrap.md) | Argo CD, Longhorn, Helm — bootstrap once |
| [Mac: Lima + Docker](development/mac-lima-docker.md) | Local container practice on Apple Silicon |

## Learning split

| Machine | Role |
| ------- | ---- |
| **Mac** (Lima) | Docker, Compose, image builds, `containerd`/`runc` exploration |
| **X1 Pro** (Proxmox) | Real kubeadm cluster — same patterns as on-prem production |

Do **not** run your homelab Kubernetes on Lima. CKA and platform engineering practice belong on Proxmox VMs.

## Phase placement

| Phase | Content |
| ----- | ------- |
| 6a | VMs + Debian + kubeadm cluster |
| 6b | Cluster addons (Cilium, cert-manager, metrics-server, NGINX, KEDA) |
| 7 | Argo CD + GitOps |
| 8+ | Platform services (Harbor, Vault, …) |

## Related

- [Guest OS strategy](../guest-os/README.md)
- [Foundation sequence](../roadmap/foundation-sequence.md)
- [Phases §6](../roadmap/phases.md#phase-6--kubernetes)
