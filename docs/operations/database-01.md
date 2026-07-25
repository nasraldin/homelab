# database-01 — central data plane

LAN: `192.168.68.21` · VMID **118** · [guest map](guest-vmid-map.md)

**Rule:** relational apps use this Postgres via **PgCat** (`:6432`). Do not install
Postgres inside Keycloak / Infisical / Sonar Compose stacks.

## Stacks (`/opt/`)

| Path | Services | Ports (LAN) |
| ---- | -------- | ----------- |
| `/opt/postgres` | Postgres 18, PgCat, PgAdmin, postgres-exporter | 5432, 6432, 5433 (pgAdmin), 9187, 9930 |
| `/opt/redis` | redis-stack + redis-exporter | 6379, 9121 |
| `/opt/mariadb` | MariaDB + phpMyAdmin + mysqld-exporter | 3306, 3366, 9104 |

## PgCat pools (day-one)

| Pool | Mode | DB / user |
| ---- | ---- | --------- |
| `postgres` | transaction | admin |
| `keycloak` | transaction | keycloak |
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

## Related

- [sonarqube.md](sonarqube.md) · [infisical.md](infisical.md) · [keycloak.md](keycloak.md)
- Design: [core-container-hosts](../superpowers/specs/2026-07-25-core-container-hosts-design.md)
