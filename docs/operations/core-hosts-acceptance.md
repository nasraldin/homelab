# Acceptance checklist — core container hosts redesign

After **factory-reset `pve01` + full lab refresh**, verify before flipping status ✅
in [current-state.md](../current-state.md).

Design: [2026-07-25-core-container-hosts-design.md](../superpowers/specs/2026-07-25-core-container-hosts-design.md).

## Pre-flight

- [ ] Mac DNS failover if needed ([mac-dns.md](mac-dns.md))
- [ ] `proxmox-bootstrap` factory-reset + `adopt-existing.sh` as needed
- [ ] `terraform-lab` apply with new inventory (110–123 + CT 200)
- [ ] `ansible-lab/scripts/refresh-ssh-known-hosts.sh`
- [ ] Secrets filled in `ansible-lab/secrets.yml` (see `secrets.example.yml`)

## Inventory

- [ ] `qm list` / `pct list` matches [guest-vmid-map.md](guest-vmid-map.md)
- [ ] No `infisical-01` / `runner-02` guests

## Spine

- [ ] DNS digs (AdGuard / Technitium)
- [ ] Vault unsealed
- [ ] AIStor health
- [ ] GitLab `https://gitlab.nasraldin.com` sign-in

## Data / apps

- [ ] `database-01`: Postgres + PgCat + PgAdmin + Redis + MariaDB + phpMyAdmin
- [ ] PgCat pools: keycloak, infisical, sonarqube
- [ ] `docker-01`: NPM, Infisical, Keycloak, it-tools, mailpit; **no** embedded Postgres
- [ ] `sonarqube-01`: Compose up; `https://sonar.nasraldin.com` Sonar sign-in; no local PG
- [ ] `elastic-01`: ES green; `https://kibana.nasraldin.com` Kibana sign-in; `:9200` LAN-only
- [ ] `podman-01`: Caddy responds
- [ ] `dockhand`: `https://docker.nasraldin.com` (Access) → Dockhand

## Monitoring (Option A)

- [ ] Prometheus targets green for node exporters + DB exporters + blackbox
- [ ] Loki receiving journal from agents (or documented Alloy follow-up)
- [ ] Grafana Homelab overview shows live data

## CI

- [ ] `runner-01` online; fleeting smoke job (or scaffold documented until API wired)

## Tunnel

```bash
cd ~/homelab/cloudflare-tunnel
./mac/bootstrap.sh --yes   # applies sonar / kibana / docker ingress
```

- [ ] sonar / kibana / docker hostnames resolve via Tunnel

## Status flip

Only after all gates pass: update `current-state.md` / foundation-sequence to ✅
with “verified after factory-reset refresh &lt;date&gt;”.
