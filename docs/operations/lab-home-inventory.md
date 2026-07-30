# lab-home-k8s inventory (Dev Homelab)

Canonical guest map for **`lab-home-k8s`** on `pve01`. Source of truth:
`lab-home-k8s/terraform/terraform.tfvars` +
`lab-home-k8s/ansible/inventory/group_vars/all.yml`.

**Not** the terraform-lab multi-VM layout — that inventory is documented in
[guest-vmid-map.md](guest-vmid-map.md) (historical / alternate redesign).

Restructure cutover: [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md).

## Status (2026-07-30 evening — ID↔IP alignment)

| Area | State |
| ---- | ----- |
| Jumpbox | **`ssh-01`** CT **112** @ **`.12`** (renamed from `infra-01`) |
| AdGuard | CT **114** @ **`.14`** (was `.10` / CT 121) — DHCP/Mac Primary |
| DNS / Infisical / docker / k8s / gitlab | **Live** — VMIDs 115–121; CTs 111/112/114/125/126 |
| Ollama primary | **Live** on **`llm-01`** CT **126** `.26` |
| Mac `*.lab` | `/etc/resolver/lab` → **`.14`** |
| Still TBD | TP-Link DHCP Primary → `.14` if still on `.10` |

## Guests

| VMID/CTID | Name | IP | Specs | Role |
| --------- | ---- | -- | ----- | ---- |
| **111** | `dns-01` | `.11` | 1c / 512M / 10G | Technitium authoritative (`lab` / `dev.test`) |
| **112** | `ssh-01` | `.12` | 2c / 2G / 20G | Jumpbox (SSH / operator tools only) |
| — | `pve01` | `.13` | host | Proxmox |
| **114** | `adguard-01` | `.14` | 1c / 512M / 10G | Recursive DNS + filtering (DHCP Primary) |
| **115** | `gitlab-01` | `.15` | 4c / 12G | GitLab CE Omnibus |
| **116** | `runner-01` | `.16` | 2c / 4G | Static GitLab Runner (host) |
| **117** | `k8s-cp-01` | `.17` | 2c / 6G | kubeadm control plane |
| **118–120** | `k8s-w-01..03` | `.18–.20` | 4c / 12G + Longhorn disk | Workers |
| **121** | `docker-01` | `.21` | 2c / 8G / 120G | NPM, Stalwart, AIStor, Dockhand, Portainer, OpenClaw edge |
| **125** | `infisical-01` | `.25` | 2c / 4G / 40G | Infisical + Postgres 16 + Redis |
| **126** | `llm-01` | `.26` | 8c / 24G / 100G | Ollama + ROCm (`/dev/dri` + `/dev/kfd`) |

Cilium LB pool: `192.168.68.100–119` (Argo `.100`, LiteLLM `.108`, OpenClaw `.113`, …).

## Where things run

```text
dns-01 / adguard-01     DNS only
infisical-01            App secrets (Compose)
docker-01               NPM + mail + S3 + Dockhand + Portainer + utility Compose
llm-01                  Ollama (LiteLLM → .26:11434)
ssh-01 (jumpbox)        SSH / operator tools only — no app ports
k8s                     Platform + AI UIs (namespaces: see taxonomy)
```

## Related

- [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md)
- [docker-hosts.md](docker-hosts.md) · [infisical.md](infisical.md) · [ollama-llm-01.md](ollama-llm-01.md)
- [service-placement.md](../architecture/service-placement.md)
- [`lab-home-gitops/docs/namespace-taxonomy.md`](https://github.com/nasraldin/lab-home-gitops/blob/main/docs/namespace-taxonomy.md)
