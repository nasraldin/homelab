# docker-01 — app Compose host

LAN: `192.168.68.22` · VMID **119**

Primary edge proxy: **Nginx Proxy Manager** (`/opt/npm`). Relational DBs live on
[database-01](database-01.md) — not embedded here.

Admin UI: `http://192.168.68.22:81` — credentials from `vault_npm_admin_email` /
`vault_npm_admin_password` in `secrets.yml` via
[Auto Initial User Creation](https://nginxproxymanager.com/advanced-config/#auto-initial-user-creation)
(`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`). Those env vars only create the
user on an **empty** `npm_data` volume; changing them later does not rotate an
existing admin.

## Stacks

| Path             | App                          |
| ---------------- | ---------------------------- |
| `/opt/npm`       | Nginx Proxy Manager (**owns host `:80`/`:443`/`:81`**) |
| `/opt/infisical` | Infisical on **`:8090`** (Postgres → PgCat) |
| `/opt/keycloak`  | Keycloak on **`:8080`** (Postgres → PgCat)  |
| `/opt/it-tools`  | it-tools                     |
| `/opt/mailpit`   | Mailpit (SMTP 1025, UI 8025) |

## Expose recipe

1. App on Docker network / published port
2. NPM Proxy Host → container or LAN IP
3. Cloudflare Tunnel ingress to NPM `:80` (or catalogued hostname)
4. Access policy when required

Dockhand manages the engine: [dockhand.md](dockhand.md).

## Playbook

```bash
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml --limit docker-01
```

## Related

- [infisical.md](infisical.md) · [keycloak.md](keycloak.md) · [podman](docker-hosts.md#podman-01)
