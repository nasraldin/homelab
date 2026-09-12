# lab-home-k8s inventory (Dev Homelab)

Canonical guest map for **`lab-home-k8s`** on `pve01`. Source of truth:
`lab-home-k8s/terraform/terraform.tfvars` +
`lab-home-k8s/ansible/inventory/group_vars/all.yml`.

**Not** the terraform-lab multi-VM layout — that inventory is documented in
[guest-vmid-map.md](guest-vmid-map.md) (historical / alternate redesign).

Restructure cutover: [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md).

## Status (2026-09-12)

| Area                                    | State                                                 |
| --------------------------------------- | ----------------------------------------------------- |
| Jumpbox / Ollama                        | **Removed** — old CT 112 `ssh-01` and CT 126 `llm-01` |
| VMIDs                                   | **Packed 111–120** (IPs unchanged; PVE stays `.13`)   |
| AdGuard                                 | CT **112** @ **`.14`** — DHCP/Mac Primary             |
| DNS / Infisical / docker / k8s / gitlab | IDs 111–120                                           |
| Mac `*.lab`                             | `/etc/resolver/lab` → **`.14`**                       |
| Still TBD                               | TP-Link DHCP Primary → `.14` if still on `.10`        |

## Guests

| VMID/CTID   | Name           | IP        | Specs                    | Role                                                      |
| ----------- | -------------- | --------- | ------------------------ | --------------------------------------------------------- |
| **111**     | `dns-01`       | `.11`     | 1c / 512M / 10G          | Technitium authoritative (`lab` / `dev.test`)             |
| **112**     | `adguard-01`   | `.14`     | 1c / 512M / 10G          | Recursive DNS + filtering (DHCP Primary)                  |
| —           | `pve01`        | `.13`     | host                     | Proxmox                                                   |
| **113**     | `gitlab-01`    | `.15`     | 4c / 12G                 | GitLab CE Omnibus                                         |
| **114**     | `runner-01`    | `.16`     | 2c / 4G                  | Static GitLab Runner (host)                               |
| **115**     | `k8s-cp-01`    | `.17`     | 2c / 6G                  | kubeadm control plane                                     |
| **116–118** | `k8s-w-01..03` | `.18–.20` | 4c / 12G + Longhorn disk | Workers                                                   |
| **119**     | `docker-01`    | `.21`     | 2c / 8G / 120G           | NPM, Stalwart, AIStor, Dockhand, Portainer, OpenClaw edge |
| **120**     | `infisical-01` | `.25`     | 2c / 4G / 40G            | Infisical + Postgres 16 + Redis                           |

Destroyed (do not recreate): `ssh-01`, `llm-01`, VM **110** fat infra, old
Dockhand/Portainer LXCs, VM **`ai-01`**.

Cilium LB pool: `192.168.68.100–119` (Argo `.100`, LiteLLM `.108`, OpenClaw `.113`, …).

## Where things run

```text
dns-01 / adguard-01     DNS only
infisical-01            App secrets (Compose)
docker-01               NPM + mail + S3 + Dockhand + Portainer + utility Compose
k8s                     Platform + AI UIs (namespaces: see taxonomy)
```

SSH directly to guests — no jumpbox. No dedicated Ollama/GPU guest.

## Related

- [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md)
- [docker-hosts.md](docker-hosts.md) · [infisical.md](infisical.md)
- [service-placement.md](../architecture/service-placement.md)
- [`lab-home-gitops/docs/namespace-taxonomy.md`](https://github.com/nasraldin/lab-home-gitops/blob/main/docs/namespace-taxonomy.md)
