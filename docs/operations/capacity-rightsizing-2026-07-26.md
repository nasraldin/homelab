# Capacity right-sizing — 2026-07-26

Live analysis of Prometheus node metrics (30m / 2h averages + 24h peaks) vs
Proxmox assigned `cores` / `memory`. Goal: shrink idle over-allocation with a
~50% headroom buffer on observed use, without cutting below service floors.

Source of truth after apply: `terraform-lab/terraform.tfvars`.

## Method

| Signal | Window | Use |
| ------ | ------ | --- |
| CPU busy % | 30m, 2h avg + 24h peak | Effective cores ≈ `vCPU × peak%/100`, then ×1.5 buffer |
| Memory used | Instant + 24h peak % | Target ≈ `max(used, peak_used) × 1.5`, round to 512/1024 MiB |
| Shrink rule | — | Only decrease when peak mem **&lt; 50%** of assigned (or CPU clearly idle) |
| Fractional CPU | Proxmox `cpulimit` | `cpu_limit = 0.5` on tiny always-on guests still showing 1 vCPU |

**Host at analysis:** `pve01` ~77 GiB / 92 GiB guest-assigned (balloon min = dedicated, so full RAM pinned).

**Host after apply:** ~50 GiB used / 92 GiB (~41 GiB available) — ~27 GiB reclaimed immediately.

**Post-reboot note:** `vault-seal` is Shamir — unseal once after host/guest reboot so `vault-01` Transit auto-unseal can proceed ([vault.md](vault.md)).

## Old → new

| Guest | VMID | Old CPU | New CPU | Old RAM | New RAM | Live (peak CPU% / used GiB / peak mem%) | Notes |
| ----- | ---- | ------- | ------- | ------- | ------- | ---------------------------------------- | ----- |
| `adguard-01` | 110 | 1c | 1c @ **0.5** limit | 2G | **1G** | 11% / 0.63 / 34% | DNS filter |
| `technitium-01` | 111 | 1c | 1c @ **0.5** limit | 2G | **1G** | 8% / 0.48 / 26% | Auth DNS |
| `infra01` | 112 | 4c | **2c** | 8G | **4G** | 10% / 0.73 / 10% | Ops headroom kept |
| `vault-01` | 113 | 1c | 1c @ **0.5** limit | 2G | **1G** | 10% / 0.46 / 26% | Raft secrets |
| `vault-seal` | 114 | 1c | 1c @ **0.5** limit | 2G | **1G** | 13% / 0.46 / 28% | Transit seal |
| `aistor-01` | 115 | 4c | **2c** | 8G | **4G** | 3% / 0.79 / 14% | S3 burst floor |
| `gitlab-01` | 116 | 6c | **2c** | 16G | **8G** | 12% / 4.0 / 30% | Omnibus floor |
| `runner-01` | 117 | 2c | **1c** | 4G | **2G** | 3% / 0.61 / 17% | Manager only |
| `database-01` | 118 | 6c | **2c** | 24G | **8G** | 11% / 1.8 / 8% | PG/Redis/Maria |
| `docker-01` | 119 | 8c | **2c** | 32G | **8G** | 9% / 2.6 / 8% | NPM/KC/Infisical |
| `podman-01` | 120 | 4c | **1c** | 8G | **2G** | 11% / 0.63 / 8% | Practice host |
| `monitoring-01` | 121 | 4c | **2c** | 16G | **6G** | **43%** / 1.4 / 9% | Peak CPU kept 2c |
| `sonarqube-01` | 122 | 4c | **2c** | 16G | **8G** | 10% / 2.6 / 22% | Embedded ES |
| `elastic-01` | 123 | 8c | **2c** | 32G | **16G** | 9% / **10.7** / 34% | Heap still `-Xms8g` |
| `dockhand` (LXC) | 200 | 1c | 1c | 2G | **1G** | 24% / 0.33 / 17% | |

### Totals

| | Old | New | Freed |
| - | --- | --- | ----- |
| vCPU (sum of cores) | 55 | **24** | 31 |
| RAM (assigned) | ~174 GiB | ~**67 GiB** | ~**107 GiB** |

## Floors (do not go below without a new review)

| Class | Min cores | Min RAM |
| ----- | --------- | ------- |
| DNS / Vault tiny | 1 (optional 0.5 limit) | 1G |
| GitLab Omnibus | 2 | 8G |
| Elastic (8g heap) | 2 | 16G |
| Docker multi-app / DB / Sonar | 2 | 8G |
| Monitoring | 2 | 6G |

## Apply

```bash
cd ~/homelab/terraform-lab
terraform plan
terraform apply
```

Memory **decreases** usually restart guests (Proxmox/QEMU). Prefer a quiet
window; DNS first if anything flaps — [lan-dns-resilience](lan-dns-resilience.md).

## Follow-ups

- Re-check Prometheus after 24–48h; bump any guest that approaches ~70% mem or sustained CPU.
- If AIStor / GitLab CI load grows, raise `aistor-01` / `gitlab-01` before others.
- Wazuh (Phase 11+) sized fresh from this method when added.
