# GitLab Omnibus + Docker Runner

Date: 2026-07-23
Status: approved for implementation

## Goal

Stand up self-hosted GitLab CE as the lab’s day-to-day source of truth (GitHub
remains portfolio/store), with a dedicated Docker-executor runner VM for CI —
starting with a hello-world job, then Terraform pipelines later.

## Locked decisions

| Topic             | Choice                                                         |
| ----------------- | -------------------------------------------------------------- |
| Public URL        | `https://gitlab.nasraldin.com` via existing Cloudflare Tunnel  |
| Edge auth         | **GitLab login only** — no Cloudflare Access on this hostname  |
| Git protocol (v1) | HTTPS + Personal Access Token (SSH later / LAN-only if needed) |
| GitLab install    | Omnibus CE on dedicated Debian 13 VM (not Docker, not in k8s)  |
| Runner            | Separate VM, Docker executor, privileged off                   |
| Bootstrap         | Mac / `infra01` Terraform + Ansible once                       |
| Order             | GitLab before kubeadm so CI can provision later VMs            |

## Guests

Layer-1 VMID order (2026-07 reshuffle): Vault 113 → AIStor 114 → GitLab 115 →
runners 116/117. IPs keep historical last octets. See
[guest-vmid-map.md](../../operations/guest-vmid-map.md).

| Property | `gitlab-01`                | `runner-01`            | `runner-02`                |
| -------- | -------------------------- | ---------------------- | -------------------------- |
| VMID     | `115`                      | `116`                  | `117`                      |
| Address  | `192.168.68.14/22`         | `192.168.68.15/22`     | `192.168.68.16/22`         |
| Compute  | 4 vCPU, 8 GiB              | 4 vCPU, 4 GiB          | 16 vCPU, 32 GiB            |
| Disk     | 100 GiB on `data01`        | 60 GiB on `data01`     | 150 GiB on `data01`        |
| Tags     | `gitlab`, `core`, `debian` | `ci`, `core`, `debian` | `ci`, `monorepo`, `debian` |

Companions (same Layer-1 tier): `vault-01` VMID 113 / `.18`, `vault-seal` VMID 114 / `.19`, `infisical-01` VMID 115 / `.20`, `aistor-01` VMID 116 / `.17`.

## TLS and tunnel

Cloudflare terminates HTTPS. Omnibus uses:

- `external_url 'https://gitlab.nasraldin.com'`
- `nginx['listen_https'] = false` (HTTP on `:80`)
- Let’s Encrypt disabled

Tunnel ingress (same `pve01-homelab` tunnel):

1. `homelab.nasraldin.com` → Proxmox (unchanged, Access gated)
2. `infra.nasraldin.com` → SSH (unchanged, Access gated)
3. `gitlab.nasraldin.com` → `http://192.168.68.14:80` (**no** Access app)
4. Catch-all 404

Proxied CNAME `gitlab` on `nasraldin.com` → `<tunnel-id>.cfargotunnel.com`.

## Automation ownership

| Layer                       | Repo                | Owns                                           |
| --------------------------- | ------------------- | ---------------------------------------------- |
| VMs                         | `terraform-lab`     | Create/start guests on `data01`                |
| Guest OS + Omnibus + Runner | `ansible-lab`       | Packages, `gitlab.rb`, Docker, runner register |
| Public hostname             | `cloudflare-tunnel` | Ingress + DNS; no Access for GitLab            |
| Docs / board                | `homelab`           | Spec, runbook, roadmap                         |

## Secrets (ansible-lab)

| Key                          | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `vault_gitlab_root_password` | Initial Omnibus root password (≥16 chars)                |
| `vault_gitlab_runner_token`  | Runner authentication token (`glrt-…`) from GitLab Admin |

## Acceptance

1. `https://gitlab.nasraldin.com` shows GitLab sign-in (no Access interstitial).
2. SSH to both VMs; `gitlab-ctl status` healthy.
3. HTTPS `git clone` / push with PAT works off-LAN.
4. Runner online; Alpine hello-world job succeeds.
5. Ansible re-run is idempotent where expected.

## Out of scope

- Full `terraform-lab` CI pipeline / remote state
- Git over SSH through the tunnel
- Cloudflare Access on GitLab
- In-cluster runners, Harbor, Vault
