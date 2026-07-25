# Keycloak (`docker-01`)

Runs as Compose on **docker-01** (`192.168.68.22`) under `/opt/keycloak/`.

## Database

Central Postgres via PgCat:

- Host `192.168.68.21:6432`
- Database / user `keycloak`
- See [database-01.md](database-01.md)

## Runtime

- HTTP + `KC_PROXY_HEADERS=xforwarded` behind NPM / Cloudflare TLS
- Bootstrap admin from `secrets.yml`
- Metrics enabled for Prometheus scrape

## Related

- [docker-hosts.md](docker-hosts.md) · [database-01.md](database-01.md)
