# Acceptance checklist — core container hosts redesign

> **terraform-lab** prove-out (2026-07-26). For **lab-home-k8s**, use
> `lab-home-k8s/docs/runbook/e2e-reset-checklist.md` and
> [lab-home-inventory.md](lab-home-inventory.md).

After **factory-reset `pve01` + full lab refresh**, verify before flipping status ✅
in [current-state.md](../current-state.md).

Design: [2026-07-25-core-container-hosts-design.md](../superpowers/specs/2026-07-25-core-container-hosts-design.md).

**Verified:** 2026-07-26 (post factory-reset refresh). Issues fixed during prove-out:
[REF-023](lab-refresh-issues.md#ref-023-guest-common-apt-on-fedora-podman)–[REF-029](lab-refresh-issues.md#ref-029-node-exporter-blocked-by-ufw).

## Pre-flight

- [x] Mac DNS failover if needed ([mac-dns.md](mac-dns.md))
- [x] `proxmox-bootstrap` factory-reset + `adopt-existing.sh` as needed
- [x] `terraform-lab` apply with new inventory (110–123 + CT 200)
- [x] `ansible-lab/scripts/refresh-ssh-known-hosts.sh`
- [x] Secrets filled in `ansible-lab/secrets.yml` (see `secrets.example.yml`)

## Inventory

- [x] `qm list` / `pct list` matches [guest-vmid-map.md](guest-vmid-map.md) (110–123 + CT 200 `dockhand`)
- [x] No `infisical-01` / `runner-02` guests

## Spine

- [x] DNS digs (AdGuard / Technitium) — public hostnames resolve via Cloudflare
- [x] Vault unsealed (`http://192.168.68.18:8200/v1/sys/health` → 200)
- [x] AIStor health (`http://192.168.68.17:9000/minio/health/live` → 200)
- [x] GitLab `https://gitlab.nasraldin.com` sign-in → 200

## Data / apps

- [x] `database-01`: Postgres + PgCat + PgAdmin (`:5433`) + Redis + MariaDB + phpMyAdmin (`:3366`)
- [x] PgCat pools: keycloak (session), infisical, sonarqube (session), postgres
- [x] `docker-01`: NPM, Infisical (`:8090`), Keycloak (`:8080`), it-tools (`:1000`), mailpit; **no** embedded Postgres
- [x] `sonarqube-01`: Compose up; `https://sonar.nasraldin.com` → status UP `26.7.0.124771`; no local PG
- [x] `elastic-01`: ES **green**; `https://kibana.nasraldin.com` → 200; `:9200` LAN (401 without auth)
- [x] `podman-01`: Caddy responds (`http://192.168.68.23` → 200)
- [x] `dockhand`: `https://docker.nasraldin.com` → 302/UI; Hawser envs Connected (docker/database/monitoring/sonar/elastic + local socket)

## Monitoring (Option A)

- [x] Prometheus targets green for node exporters + DB exporters + blackbox (**26/26 up** after REF-028/029)
- [x] Loki ready (`:3100/ready` → 200); Alloy journal shipping = documented follow-up (`observability_agent` note)
- [x] Grafana healthy (`:3000/api/health` → 200); Homelab overview provisioned

## CI

- [x] `runner-01` service running; registered docker executor against LAN GitLab
- [x] Fleeting autoscaler scaffold documented until API fully wired ([gitlab-runner-autoscaling.md](gitlab-runner-autoscaling.md))

## Tunnel

```bash
cd ~/homelab/cloudflare-tunnel
./mac/bootstrap.sh --yes   # applies sonar / kibana / docker ingress
```

- [x] sonar / kibana / docker / gitlab hostnames resolve via Tunnel (curl → 200/302)

## Status flip

- [x] Updated `current-state.md` / foundation-sequence **17b** → ✅ with “verified after factory-reset refresh 2026-07-26”.
