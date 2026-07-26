# Design: Core container hosts + central DB + Sonar + Elastic + monitoring

**Date:** 2026-07-25  
**Status:** Accepted — implement in terraform-lab / ansible-lab / cloudflare-tunnel / docs  
**Scope:** Day-one Layer-1 rebuild (full wipe OK)

## Goals

- Split app/data/quality/search/observability onto dedicated guests
- **Central Postgres** on `database-01` for all relational apps (via PgCat)
- Full-fleet metrics/logs to `monitoring-01` (Prometheus + Grafana + **Loki**)
- Elastic Stack on dedicated VM (**Option A:** Loki remains primary lab logs)
- Professional exposure: GitLab-style Tunnel for Sonar/Kibana; Access for Dockhand

## Architecture rules

1. **Central DB:** Keycloak, Infisical, SonarQube use Postgres on `database-01` via PgCat (`:6432`). No embedded Postgres per app.
2. **MariaDB** on `database-01` only for MySQL-protocol workloads (+ phpMyAdmin).
3. **Per-stack Compose** under `/opt/<stack>/` — not one mega compose file.
4. **Sole-tenant VMs** for SonarQube and Elastic (performance).
5. **Latest stable** images/channels; pin tags in Ansible; no deprecated apt/`ansible_*` facts.
6. **Homelab oversubscription** on single-node `pve01` is accepted (guests do not peak together). Terraform enables **QEMU ballooning** (`memory.floating = dedicated`) so the host is not forced to pin every guest’s full dedicated RAM at once.

## Inventory

Live sizes after right-sizing (2026-07-26):
[capacity-rightsizing-2026-07-26.md](../../operations/capacity-rightsizing-2026-07-26.md).
Source of truth: `terraform-lab/terraform.tfvars`.

| VMID | Guest           | LAN   | Size (current) | Role                                        |
| ---- | --------------- | ----- | -------------- | ------------------------------------------- |
| 110  | `adguard-01`    | `.10` | 1c@0.5/1G/20G  | DNS filter                                  |
| 111  | `technitium-01` | `.11` | 1c@0.5/1G/20G  | Authoritative DNS                           |
| 112  | `infra01`       | `.12` | 2c/4G/80G      | Ops                                         |
| 113  | `vault-01`      | `.18` | 1c@0.5/1G/50G  | Vault Raft                                  |
| 114  | `vault-seal`    | `.19` | 1c@0.5/1G/20G  | Transit seal                                |
| 115  | `aistor-01`     | `.17` | 2c/4G/300G     | S3                                          |
| 116  | `gitlab-01`     | `.14` | 2c/8G/120G     | GitLab CE                                   |
| 117  | `runner-01`     | `.15` | 1c/2G/40G      | Fleeting manager                            |
| 118  | `database-01`   | `.21` | 2c/8G/200G     | Postgres+PgCat+PgAdmin, Redis, MariaDB      |
| 119  | `docker-01`     | `.22` | 2c/8G/120G     | NPM, Infisical, Keycloak, it-tools, mailpit |
| 120  | `podman-01`     | `.23` | 1c/2G/80G      | Podman + Caddy                              |
| 121  | `monitoring-01` | `.25` | 2c/6G/100G     | Prom/Grafana/Loki                           |
| 122  | `sonarqube-01`  | `.26` | 2c/8G/80G      | Sonar Compose → PgCat                       |
| 123  | `elastic-01`    | `.27` | 2c/16G/200G    | ES + Kibana                                 |
| 200  | `dockhand`      | `.24` | 1c/1G/20G      | Dockhand LXC                                |

**Removed:** `infisical-01`, `runner-02` (static fat runner).

## Compose layout

```text
database-01:  /opt/postgres  /opt/redis  /opt/mariadb
docker-01:    /opt/npm  /opt/infisical  /opt/keycloak  /opt/it-tools  /opt/mailpit
monitoring-01:/opt/monitoring
sonarqube-01: /opt/sonarqube
elastic-01:   /opt/elastic
podman-01:    /opt/caddy
dockhand:     Dockhand install
```

## Public hostnames

| Hostname               | Origin                         | Access            |
| ---------------------- | ------------------------------ | ----------------- |
| `gitlab.nasraldin.com` | `.14:80`                       | No (GitLab login) |
| `sonar.nasraldin.com`  | `.26:9000`                     | No (Sonar login)  |
| `kibana.nasraldin.com` | `.27:5601`                     | No (Kibana login) |
| `docker.nasraldin.com` | `.24` Dockhand                 | Yes               |
| NPM apps on docker-01  | via NPM → Tunnel as catalogued | As needed         |

ES `:9200` is **LAN only**.

## Observability (Option A)

- Fleet agents (node_exporter + Alloy) on all guests → Prometheus/Loki on `monitoring-01`
- pve-exporter + blackbox on monitoring-01
- Elastic is **not** the primary log sink day one

## CI

- One `runner-01` manager: GitLab `docker-autoscaler` + fleeting-plugin-proxmox
- `idle_count≈4`; ephemeral workers ~2c/4G; capacity ceiling ~40 jobs

## Deferred

- MSSQL, Logstash / full Elastic Agent dual-write, K8s runners

## Acceptance

Factory-reset `pve01` + full lab refresh; prove inventory 110–123 + CT 200; central PG pools; Sonar/Kibana Tunnel URLs; Loki ingest; then flip status ✅.
