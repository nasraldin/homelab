# Build an HA Kubernetes Cluster with kubeadm on Debian

This is the target layout for an HA kubeadm cluster on Debian VMs under Proxmox. It is sized for the X1 Pro (96 GB RAM) so you still have headroom for GitLab, monitoring, and Wazuh later.

Read this before you create VMs or run `kubeadm init`. It settles API load-balancing, node counts, and why kubeadm — not k3s — is the primary path for CKA and on-prem practice.

## What this page covers

- Why kubeadm over k3s for this lab
- HAProxy roles: API (`:6443`) vs app traffic
- Target topology, sizing, and Phase 6b addons
- Upgrade and ops notes that follow from the layout

## Why kubeadm (not k3s) for your goal

|                       | k3s                           | kubeadm                                           |
| --------------------- | ----------------------------- | ------------------------------------------------- |
| CKA exam alignment    | Partial — hides control plane | **Full** — you manage every component             |
| Production similarity | Edge / small clusters         | **Default** for on-prem and many cloud bootstraps |
| etcd                  | Embedded (simplified)         | **You** run stacked or external etcd              |
| Upgrades / certs      | Simplified                    | **Real** `kubeadm upgrade` workflow               |
| Interview story       | “Fast homelab”                | **“I built and operate HA Kubernetes”**           |

**Decision:** kubeadm on Debian for the primary cluster. The old k3s module was
removed from `terraform-lab`; new work uses ordinary VM entries followed by
kubeadm (manual for CKA depth, then automated where useful).

---

## Two load-balancer roles (do not confuse them)

### 1. HAProxy → Kubernetes API (`:6443`) — **required for HA**

```text
kubectl / kubeadm / kubelet
         │
         ▼
  kube-api.lab.example.com:6443   (VIP on haproxy-01)
         │
    ┌────┴────┐
    │ HAProxy │
    └────┬────┘
    /      |      \
cp01    cp02    cp03
:6443   :6443   :6443
```

- One stable API endpoint for `kubectl`, joining nodes, and **kubeadm upgrades**
- TCP mode, health-check each CP on 6443
- This is what enterprises use (HAProxy, F5, Citrix, cloud LB)

### 2. HAProxy → application traffic (`:80` / `:443`) — **optional early**

```text
Internet / LAN
      │
  HAProxy (:80/:443)
      │
  NGINX Ingress OR Cilium Gateway API
      │
  Services → Pods
```

- **MetalLB is optional** if HAProxy (or router port-forward) fronts ingress
- Many on-prem shops: external LB → Ingress/Gateway — no MetalLB

For CKA Phase 1, **NodePort + `/etc/hosts`** is enough. Add HAProxy for apps when you practice ingress at scale.

---

## Target topology

```text
Proxmox (pve01)
│
├── haproxy-01        VIP 192.168.1.20 — API :6443 (+ optional :80/:443)
│
├── k8s-cp-01 ──┐
├── k8s-cp-02 ──┼── stacked etcd (3 CP)
├── k8s-cp-03 ──┘
│
├── k8s-w-01
└── k8s-w-02

Inside cluster (Phase 6b addons only):
  containerd → kubeadm → Cilium → cert-manager → metrics-server
  → NGINX Ingress → KEDA
```

**DNS (lab):** `kube-api.lab.example.com` → `192.168.1.20` (AdGuard or `/etc/hosts`).

---

## Phased rollout (recommended)

Do **not** build 3 CP + HAProxy on day one if Phase 0–5 are not done. CKA does not require HA on day one.

### Stage A — Learn the control plane (CKA core)

| VM        | vCPU | RAM  | Disk  | IP example   |
| --------- | ---- | ---- | ----- | ------------ |
| k8s-cp-01 | 2    | 4 GB | 40 GB | 192.168.1.30 |
| k8s-w-01  | 4    | 8 GB | 60 GB | 192.168.1.31 |
| k8s-w-02  | 4    | 8 GB | 60 GB | 192.168.1.32 |

- **1 control plane**, 2 workers
- `kubectl` → `https://192.168.1.30:6443` directly
- Covers ~80% of CKA: pods, deployments, services, networking, storage, RBAC, troubleshooting

**RAM budget:** ~20 GB for k8s VMs.

### Stage B — Production HA (stacked etcd)

| VM            | vCPU   | RAM       | Disk       |
| ------------- | ------ | --------- | ---------- |
| haproxy-01    | 2      | 2 GB      | 20 GB      |
| k8s-cp-01..03 | 2 each | 4 GB each | 40 GB each |
| k8s-w-01..02  | 4 each | 8 GB each | 60 GB each |

- Add cp-02, cp-03; point **all** kubelets and `kubectl` at HAProxy VIP
- First CP bootstrapped; others `kubeadm join --control-plane`
- Practice: drain, cordon, upgrade one CP at a time

**RAM budget:** ~32 GB for k8s + HAProxy.

### Stage C — Full platform (later phases)

Add GitLab VM, monitoring, Wazuh — only after Stage B is stable.

---

## Guest OS: Debian 12 or 13

| Choice                   | When                                                    |
| ------------------------ | ------------------------------------------------------- |
| **Debian 12 (bookworm)** | Most mature cloud images and kubeadm docs today         |
| **Debian 13 (trixie)**   | Fine if cloud image is available in Proxmox; same steps |

**Not Fedora** for long-lived cluster nodes — short lifecycle, wrong lesson for “stable production.”

**Ubuntu 24.04 LTS** is acceptable (many CKA tutorials use it) but Debian is leaner and matches your guest-OS strategy.

---

## Node software stack (every VM)

| Component         | Version / notes                                  |
| ----------------- | ------------------------------------------------ |
| Container runtime | **containerd** (not Docker on nodes)             |
| CNI               | **Cilium** (eBPF; Gateway API later)             |
| Kubernetes        | kubeadm + kubelet + kubectl (same minor version) |
| Swap              | **off** (`swapoff -a`, fstab)                    |
| Kernel            | `br_netfilter`, `overlay`, forwarding enabled    |

Install order per node:

1. OS + SSH + static IP (cloud-init or Terraform VM module)
2. containerd
3. kubeadm/kubelet/kubectl packages (pin version)
4. `kubeadm init` (first CP) or `kubeadm join`
5. Cilium (`helm` or `cilium cli`)
6. Cluster addons (below)

---

## Phase 6b — Cluster addons (before platform apps)

Install these **before** Harbor, GitLab-in-cluster, or Argo CD app-of-apps. This is the “minimum viable production cluster.”

| Addon              | Purpose                  | CKA relevance                   |
| ------------------ | ------------------------ | ------------------------------- |
| **Cilium**         | CNI, network policies    | Networking, policies            |
| **cert-manager**   | TLS certificates         | Ingress TLS                     |
| **metrics-server** | `kubectl top`            | HPA, resource metrics           |
| **NGINX Ingress**  | HTTP routing             | Ingress, Services               |
| **KEDA**           | Event-driven autoscaling | ScaledObject (platform pattern) |

**Defer to Phase 7–9:** Argo CD, Longhorn, Velero, Kyverno, ExternalDNS, ESO, Vault, Prometheus stack.

**Optional later:** MetalLB (only if you skip HAProxy for apps), Gateway API (Cilium), Tempo.

---

## HAProxy example (API only)

`/etc/haproxy/haproxy.cfg` (conceptual):

```text
frontend kube-api
    bind *:6443
    mode tcp
    default_backend kube-api-backend

backend kube-api-backend
    mode tcp
    balance roundrobin
    option tcp-check
    server cp01 192.168.1.30:6443 check
    server cp02 192.168.1.33:6443 check
    server cp03 192.168.1.34:6443 check
```

`kubeadm init` must use `--control-plane-endpoint kube-api.lab.example.com:6443` **before** joining additional CPs.

---

## kubeadm init checklist (first control plane)

```bash
# On k8s-cp-01 (Stage A — no HAProxy yet)
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=192.168.1.30

# With HA (Stage B)
sudo kubeadm init \
  --control-plane-endpoint=kube-api.lab.example.com:6443 \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16
```

Then:

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

Install Cilium **before** workloads that need networking.

---

## CKA study mapping

| CKA domain            | Homelab practice                                            |
| --------------------- | ----------------------------------------------------------- |
| Cluster architecture  | kubeadm init/join, static pods, `/etc/kubernetes/manifests` |
| Workloads             | Deployments, DaemonSets, StatefulSets on your workers       |
| Services & networking | Cilium, NetworkPolicy, Ingress, CoreDNS debug               |
| Storage               | hostPath, local-path or Longhorn (Phase 9)                  |
| Troubleshooting       | Break kubelet, fix RBAC, recover etcd snapshot (Stage B)    |
| HA / upgrades         | Stage B: `kubeadm upgrade plan/apply`                       |

Use **killer.sh** or **CKA simulator** alongside the cluster — do not rely on the homelab alone for exam quirks.

---

## Terraform / automation path

| Now                                         | Next                                          |
| ------------------------------------------- | --------------------------------------------- |
| Terraform `vm` module → Debian cloud images | Same — VMs only                               |
| Retire `k8s-cluster` k3s cloud-init         | Ansible role: containerd + kubeadm            |
| Manual kubeadm for CKA depth                | GitOps for **addons** after Argo CD (Phase 7) |

VMs from Terraform; **kubeadm join tokens and upgrades** by hand (or Ansible) until you want full IaC.

---

## What we are **not** doing yet

- Platform services (Harbor, Keycloak, Vault in-cluster)
- GitOps (Argo CD)
- Full observability stack
- Wazuh / Falco / Kyverno
- 3 CP on a single 96 GB host **before** Stage A works

---

## Related

- [Mac Lima Docker](development/mac-lima-docker.md)
- [Guest OS](../guest-os/index.md)
- [Network & DNS](../architecture/network-dns-ingress.md)
