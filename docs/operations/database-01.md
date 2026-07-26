# database-01 — central data plane

LAN: `192.168.68.21` · VMID **118** · [guest map](guest-vmid-map.md)

**Rule:** relational apps use this Postgres via **PgCat** (`:6432`). Do not install
Postgres inside Keycloak / Infisical / Sonar Compose stacks.

## Stacks (`/opt/`)

| Path            | Services                                       | Ports (LAN)                            |
| --------------- | ---------------------------------------------- | -------------------------------------- |
| `/opt/postgres` | Postgres 18, PgCat, PgAdmin, postgres-exporter | 5432, 6432, 5433 (pgAdmin), 9187, 9930 |
| `/opt/redis`    | redis-stack + redis-exporter                   | 6379, 9121                             |
| `/opt/mariadb`  | **MariaDB** (MySQL protocol) + phpMyAdmin + mysqld-exporter | 3306, 3366, 9104 |

> **MariaDB, not Oracle MySQL** — intentional. Same wire protocol for apps that
> expect MySQL; see [REF-019](lab-refresh-issues.md#ref-019-mariadb-not-oracle-mysql-by-design).

## PgCat pools (day-one)

| Pool        | Mode        | DB / user |
| ----------- | ----------- | --------- |
| `postgres`  | transaction | admin     |
| `keycloak`  | **session** | keycloak  |
| `infisical` | transaction | infisical |
| `sonarqube` | **session** | sonarqube |

App JDBC/URL host: `192.168.68.21` port **6432**.

## Secrets

See `ansible-lab/secrets.example.yml` (`vault_postgres_*`, `vault_redis_*`, `vault_mariadb_*`, app DB passwords).

## Playbook

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/database.yml -e @secrets.yml
```

First-boot failures (Postgres unhealthy, pull “stuck” on MariaDB): see
[REF-017](lab-refresh-issues.md#ref-017-postgres-18-mount-and-init-permissions)
in the lab-refresh issues tracker.

## Related

- [sonarqube.md](sonarqube.md) · [infisical.md](infisical.md) · [keycloak.md](keycloak.md)
- Design: [core-container-hosts](../superpowers/specs/2026-07-25-core-container-hosts-design.md)
- Refresh failures: [lab-refresh-issues.md](lab-refresh-issues.md) (REF-017, REF-019)
