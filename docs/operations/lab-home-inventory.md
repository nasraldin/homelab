# lab-home-k8s inventory (Dev Homelab)

Canonical guest map for **`lab-home-k8s`** on `pve01`. Source of truth:
`lab-home-k8s/terraform/terraform.tfvars` +
`lab-home-k8s/ansible/inventory/group_vars/all.yml`.

**Not** the terraform-lab multi-VM layout — that inventory is documented in
[guest-vmid-map.md](guest-vmid-map.md) (historical / alternate redesign).

Restructure cutover: [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md).

## Status (2026-07-30)

| Area | State |
| ---- | ----- |
| DNS / Infisical / docker-01 / jumpbox | **Live** — CT 121–124; VM 110 + LXC 118/119 destroyed |
| Ollama primary | **Live** on **`llm-01`** `.26` (GPU/ROCm verified); **`ai-01`** standby (do not delete) |
| K8s namespaces | Purpose NS live; old NS pruned — `lab-home-gitops/docs/namespace-taxonomy.md` |
| Still TBD | TP-Link DHCP → `.10`; Cloudflare tunnel apply (token); Mac `/etc/resolver/lab`; Infisical UA seed; AIStor restore from vzdump if needed |

## Guests

| VMID/CTID | Name | IP | Specs | Role |
| --------- | ---- | -- | ----- | ---- |
| — | `pve01` | `.13` | host | Proxmox |
| **121** | `adguard-01` | `.10` | 1c / 512M / 10G | Recursive DNS + filtering (DHCP Primary target) |
| **122** | `dns-01` | `.11` | 1c / 512M / 10G | Technitium authoritative (`lab` / `dev.test`) |
| **124** | `infra-01` | `.14` | 2c / 2G / 20G | Jumpbox (SSH / operator tools only) |
| **111** | `gitlab-01` | `.15` | 4c / 12G | GitLab CE Omnibus |
| **112** | `runner-01` | `.16` | 2c / 4G | Static GitLab Runner (host) |
| **113** | `k8s-cp-01` | `.17` | 2c / 4G | kubeadm control plane |
| **114–116** | `k8s-w-01..03` | `.18–.20` | 4c / 12G + Longhorn disk | Workers |
| **117** | `docker-01` | `.21` | 2c / 8G / 120G | NPM, Stalwart, AIStor, Dockhand, Portainer, OpenClaw edge |
| **120** | `ai-01` | `.24` | standby | Former Ollama VFIO VM — keep stopped for rollback |
| **123** | `infisical-01` | `.25` | 2c / 4G / 40G | Infisical + Postgres 16 + Redis |
| **125** | `llm-01` | `.26` | 8c / 24G / 100G | Ollama + ROCm (`/dev/dri` + `/dev/kfd`) |

Destroyed 2026-07-30: VM **110** (fat infra), LXC **118** (Dockhand), LXC **119** (Portainer).

Cilium LB pool: `192.168.68.100–119` (Argo `.100`, LiteLLM `.108`, OpenClaw `.113`, …).

## Where things run

```text
adguard-01 / dns-01     DNS only
infisical-01            App secrets (Compose)
docker-01               NPM + mail + S3 + Dockhand + Portainer + utility Compose
llm-01                  Ollama (LiteLLM → .26:11434)
infra-01 (jumpbox)      SSH / operator tools only — no app ports
k8s                     Platform + AI UIs (namespaces: see taxonomy)
```

## Related

- [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md)
- [docker-hosts.md](docker-hosts.md) · [infisical.md](infisical.md) · [ollama-llm-01.md](ollama-llm-01.md)
- [service-placement.md](../architecture/service-placement.md)
- [`lab-home-gitops/docs/namespace-taxonomy.md`](https://github.com/nasraldin/lab-home-gitops/blob/main/docs/namespace-taxonomy.md)
