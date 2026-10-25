# Where things stand today

Status board for the live lab (updated 2026-10-25). Build narrative:
[build-story.md](build-story.md). Pages under `docs/` that still describe
kubeadm, k3s, Argo CD or `lab-home-k8s` are historical.

## In one paragraph

One Proxmox host (`pve01`) runs the foundation guests (Infisical, GitLab, a
Docker CI runner) and a **Talos Linux Kubernetes cluster: one control plane and
five workers**. Everything is delivered by GitLab CI pipelines from the repos
below; there is no Argo CD. Public access goes through a Cloudflare Tunnel to
Envoy Gateway; the canonical domain is `ajrly.app`.

## Host

|           |                                                                      |
| --------- | -------------------------------------------------------------------- |
| Node      | `pve01` · `192.168.68.10` · Proxmox VE 9.2                           |
| CPU / RAM | Ryzen AI 9 HX 470 (12C/24T) · 92 GiB, no swap — memory is the limit  |
| `rpool`   | Samsung 990 PRO 2 TB — Proxmox OS, Talos control plane (`local-zfs`) |
| `data01`  | Kingston FURY 4 TB — worker disks and CSI volumes                    |
| ZFS ARC   | capped at 8 GiB by `lab-home-pve01` `proxmox-memory.yml`             |

## Guests

| VMID    | Name              | Size      | Role                                            |
| ------- | ----------------- | --------- | ----------------------------------------------- |
| 111     | infisical-01      | LXC 2c/4G | Infisical (secrets)                             |
| 112     | gitlab-01         | 4c/12G    | GitLab CE (`gitlab.ajrly.app`)                  |
| 113     | runner-01         | 2c/4G     | Docker runner for infra jobs (outside k8s)      |
| 301     | talos-cp01        | 4c/6G     | Control plane + etcd (single member), VIP `.30` |
| 304–305 | talos-worker01–02 | 4c/8G     | `workload=apps`                                 |
| 306     | talos-worker03    | 4c/14G    | `workload=platform`                             |
| 307     | talos-worker04    | 4c/12G    | `workload=stateful`                             |
| 308     | talos-worker05    | 8c/16G    | `workload=apps` (CI capacity)                   |

Why one control plane, and how etcd is backed up:
`homelab-cluster-infra/README.md` and `docs/runbook.md`.

## Repositories (active)

| Repo                        | Host   | Owns                                                                                     |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `proxmox-bootstrap`         | GitHub | Proxmox host bootstrap                                                                   |
| `lab-home-pve01`            | GitHub | Foundation guests (Terraform + Ansible)                                                  |
| `vault`                     | GitLab | GitLab CI variables + Infisical reconciliation                                           |
| `homelab-cluster-infra`     | GitLab | Talos VMs, machine config, upgrades, etcd backups                                        |
| `homelab-platform-services` | GitLab | Cilium, gateway, certs, storage, observability, Harbor, CI runners, shared data services |
| `ajrly-k8s-deployments`     | GitLab | Ajrly application databases and workloads                                                |
| `pipeline-templates`        | GitLab | Shared GitLab CI templates                                                               |
| `cloudflare-tunnel`         | GitHub | Proxmox-side tunnel config (read by `vault`)                                             |

Retired repos live in `archive/` (gitignored) for history only. Clone the
active set with `./clone-labs.sh` (reads `repos.json`).

## Open items

- Off-host backups: etcd snapshots and CNPG/Barman backups stay on this host.
- Alert routing: Alertmanager has no receiver yet.
- Cloudflare Access on admin UIs (Grafana, Harbor, SonarQube, MinIO console).
- Finish the `ajrly.com` / `nasraldin.com` → `ajrly.app` migration leftovers.

## Locked decisions

| Topic      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Hypervisor | Proxmox VE 9.x on ZFS, single host                                |
| Kubernetes | Talos Linux, 1 control plane (never 2), Cilium without kube-proxy |
| Delivery   | GitLab CI pipelines; manual Play gates for mutations              |
| GitLab     | Dedicated VM — not in Kubernetes                                  |
| Secrets    | Infisical source of truth; GitLab variables reconciled by `vault` |
| Namespaces | Purpose-grouped — not one namespace per app                       |
