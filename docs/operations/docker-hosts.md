# docker-01 — app Compose host

LAN: `192.168.68.22` · VMID **119**

Primary edge proxy: **Nginx Proxy Manager** (`/opt/npm`). Relational DBs live on
[database-01](database-01.md) — not embedded here.

## Stacks

| Path | App |
| ---- | --- |
| `/opt/npm` | Nginx Proxy Manager |
| `/opt/infisical` | Infisical (Postgres → PgCat) |
| `/opt/keycloak` | Keycloak (Postgres → PgCat) |
| `/opt/it-tools` | it-tools |
| `/opt/mailpit` | Mailpit (SMTP 1025, UI 8025) |

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
