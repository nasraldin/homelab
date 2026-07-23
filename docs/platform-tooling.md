# Know Which Tool Owns Each Layer — and Stay in Bounds

This is the ownership map for the lab. Each tool has one job. Crossing layers “because it’s convenient” creates two sources of truth and painful drift — the same failure mode platform teams hit when Terraform and Helm both claim the same chart.

Read this before you add a new VM, bootstrap Kubernetes, or put an app in Git.
The exact commands and gates are in the
[deploy and rebuild runbook](operations/deploy-and-rebuild.md).

## What this page covers

- Layer model: infra → cluster bootstrap → GitOps workloads
- What each repo owns (and must not own)
- How professional teams create and operate Kubernetes
- Day-2 task → tool mapping and common anti-patterns

## The three layers (correct model)

```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — Workloads (GitOps)                               │
│  Argo CD / Flux                                             │
│  cert-manager, ingress, monitoring, Harbor, apps…           │
│  Source of truth: Git. No manual kubectl for day-2.         │
└──────────────────────────▲──────────────────────────────────┘
                           │ sync
┌──────────────────────────┴──────────────────────────────────┐
│  Layer 2 — Cluster bootstrap                                │
│  cloud-init / Cluster API / Talos / kubeadm                 │
│  Install Kubernetes ONCE (kubelet, CNI, CSI)                  │
│  Here: terraform-lab/ VMs + Ansible/kubeadm for cluster install │
└──────────────────────────▲──────────────────────────────────┘
                           │ boots
┌──────────────────────────┴──────────────────────────────────┐
│  Layer 1 — Infrastructure                                   │
│  Terraform / OpenTofu                                       │
│  Disks, pools, VMs, LXC, networks, cloud images             │
│  Here: terraform-lab/                                           │
└─────────────────────────────────────────────────────────────┘

Side path (not Layer 3):
  Ansible → guest OS config for NON-Kubernetes VMs only
            (packages, users, Docker, GitLab Runner on a VM, …)
```

| Layer | Tool in this repo                               | Owns                                                              | Does **not** own                            |
| ----- | ----------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| 0     | `proxmox-bootstrap/`                            | Fresh Proxmox host: repos, SSH, ZFS tuning, API token, ISO upload | VMs, pools, k8s apps                        |
| 1     | `terraform-lab/`                                | ZFS pools, resource pools, images, VMs, LXC, backups              | Helm charts, Ingress rules, app Deployments |
| 2     | Ansible / kubeadm (on VMs)                      | Kubernetes install on Debian VMs                                  | Day-2 cluster config via GitOps             |
| 3     | Argo CD (planned under `argocd/` / Git)         | Everything _in_ the cluster                                       | Creating Proxmox VMs                        |
| side  | Ansible (`ansible-lab/` roles, later dedicated) | Non-k8s guest config                                              | k8s manifests / Helm                        |

Guiding rule: **don’t manually configure anything the layer above can own.**
A full rebuild is:

```text
official installer → proxmox-bootstrap → terraform apply → Ansible for non-k8s VMs → Argo CD sync
```

## How professional teams do Kubernetes

### Create the cluster

- **Cloud (EKS/GKE/AKS):** Terraform creates the managed control plane; node groups are infra.
- **Homelab / bare metal (this lab):** Terraform creates Debian VMs; **kubeadm** installs Kubernetes.

### Set up the platform _inside_ the cluster

After the API server is up:

1. Bootstrap **Argo CD once** (small exception: one-time install, then Argo manages itself).
2. Put every other component in Git (Application / ApplicationSet / Helm / Kustomize).
3. Argo syncs: cert-manager, **NGINX Ingress**, monitoring, Harbor, GitLab Runner (in-cluster), your apps.

**Do not** use Terraform `kubernetes`/`helm` providers for long-lived platform
charts if Argo CD is the plan — you get two sources of truth and painful drift.

**Do not** use Ansible to `helm upgrade` Grafana “because we already have playbooks.”
That pattern does not scale and is not how platform teams operate day-2.

### Day-2 operations

| Task                             | Tool                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Add a VM / disk / kubeadm node   | Terraform (`terraform.tfvars` + apply)                                                         |
| Change a Deployment / Helm value | Git commit → Argo CD sync                                                                      |
| Install packages on a GitLab VM  | Ansible                                                                                        |
| Install qemu-guest-agent in a VM | cloud-init (new) or Ansible (existing) — [guest-os](guest-os/#qemu-guest-agent)                |
| Attach Radeon 890M to an AI VM   | Terraform `hostpci` after host IOMMU — [gpu-passthrough](architecture/gpu-passthrough.md)      |
| Expose a service publicly        | Cloudflare Tunnel + Access (GitOps for apps later); Proxmox UI only at `homelab.nasraldin.com` |
| Browse the live cluster          | `kubectl` / **k9s** (UI only — not provisioning)                                               |

**k9s** is a terminal UI for inspecting clusters. It is **not** part of
provisioning and does not replace Terraform or Argo CD.

## Decision table (“where do I put this?”)

| I want to…                                     | Put it in…                                                     |
| ---------------------------------------------- | -------------------------------------------------------------- |
| Create / wipe ZFS `data01`, resource pools     | `terraform-lab/`                                               |
| Create an Ubuntu VM or LXC                     | `terraform-lab/terraform.tfvars` (`vms` / `containers`)        |
| Create a kubeadm cluster                       | `terraform-lab` VM entries + kubeadm docs                      |
| Upload a local `.iso` with no public URL       | `proxmox-bootstrap/mac/upload-isos.sh`                         |
| Download Ubuntu cloud image from the internet  | `terraform-lab/` (`cloud_images`)                              |
| Harden Proxmox host / SSH / APT                | `proxmox-bootstrap/`                                           |
| Configure AdGuard / GitLab _VM_ packages       | Ansible                                                        |
| Install qemu-guest-agent in guests             | cloud-init / Ansible — **not** a Proxmox VMID script           |
| Pass GPU into one AI VM                        | Terraform + [gpu-passthrough](architecture/gpu-passthrough.md) |
| Install cert-manager, ingress, Grafana, Harbor | **Argo CD** (Git) — **NGINX Ingress**, not Traefik             |
| Deploy my application                          | **Argo CD** (Git)                                              |
| One-off debug on a pod                         | `kubectl` / k9s (then fix it in Git)                           |

## Anti-patterns (do not do)

| Anti-pattern                                     | Why it’s wrong                                 | Do this instead                                                  |
| ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| Click VMs / storage in Proxmox UI                | Not reproducible                               | Terraform                                                        |
| Terraform applies Helm charts forever            | Fights GitOps; secret sprawl                   | Argo CD                                                          |
| Ansible installs the whole k8s platform          | Drift, no Git history of cluster desired state | TF for cluster + Argo for apps                                   |
| Manual `kubectl apply` for anything permanent    | Snowflakes                                     | Commit to Git                                                    |
| Expose Proxmox `:8006` on the WAN without Access | Attack surface                                 | Use `cloudflare-tunnel/` → `homelab.nasraldin.com` + Access only |
| Store API tokens / kubeconfigs in Git            | Credential leak                                | gitignored tfvars, password manager, sealed secrets              |
| Host script `install-guest-agent --vmid N`       | Chicken-and-egg; wrong layer                   | cloud-init / Ansible — [guest-os](guest-os/#qemu-guest-agent)    |
| Manual `apt` guest packages with no Git          | Snowflakes                                     | Ansible role                                                     |
| Snowflake `qm set … hostpci` never in Terraform  | Lost on rebuild                                | Encode GPU VM in `terraform-lab`                                 |

## What exists in this repo today

| Path                                       | Status                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Documentation index](index.md)            | **Documentation index** — roadmap, architecture, operations                                                                                                                  |
| [platform-tooling.md](platform-tooling.md) | Layer ownership (this file)                                                                                                                                                  |
| `proxmox-bootstrap/`                       | Layer 0 — host bootstrap, firewall, updates, ops runbooks                                                                                                                    |
| `cloudflare-tunnel/`                       | Remote UI + infra01 SSH — Tunnel + Access for `homelab.nasraldin.com` / `infra.nasraldin.com`                                                                                |
| `opshub/` (sibling clone)                  | Ops shell — hub, Proxmox plugin, Terminal, embedded noVNC; remote API needs [Service Auth](https://github.com/nasraldin/cloudflare-tunnel/blob/main/docs/04-service-auth.md) |
| `terraform-lab/`                           | Layers 1–2 — storage, pools, VMs, LXC, vzdump backups                                                                                                                        |
| `ansible-lab/`                             | Non-k8s guest configuration                                                                                                                                                  |
| Argo CD / `argocd/` app manifests          | Planned (Phase 7) — create when the first cluster exists                                                                                                                     |

**Live phase status:** see [roadmap overview](roadmap/index.md) (updated 2026-07-20).

## Related docs

- **[Documentation index](index.md)** · **[Docs site](https://nasraldin.github.io/homelab/)**
- [Guest OS strategy](guest-os/index.md) — Debian, CoreOS, Talos
- [Proxmox updates](operations/proxmox-updates.md) — check vs upgrade
- [Backups](operations/backups.md) — vzdump stages

Private GitHub:

- [proxmox-bootstrap architecture & roadmap](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/00-architecture.md)
- [Terraform README](https://github.com/nasraldin/terraform-lab/blob/main/README.md)
- [Bootstrap runbook](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/06-runbook.md)
- [OpsHub Access runbook](https://github.com/nasraldin/opshub/blob/main/docs/runbooks/proxmox-via-cloudflare-access.md) — Service Token when calling Proxmox off-LAN
- [Tunnel Service Auth](https://github.com/nasraldin/cloudflare-tunnel/blob/main/docs/04-service-auth.md)
