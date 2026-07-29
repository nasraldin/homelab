# Stalwart — local lab mail (`dev.test`)

Runs on **`docker-01`** (`/opt/stalwart`) after
[lab-restructure-2026-07-30](lab-restructure-2026-07-30.md). Ansible bootstraps
the server and seeds mailboxes — no setup wizard. **Bulwark** provides the web
inbox.

## Why `dev.test` (not `dev.lab`)

Stalwart only accepts reserved local TLDs (`.test`, `.localhost`, …) or real
public domains. `.lab` is rejected. Addresses are therefore `*@dev.test`.

## URLs / DNS

| What | Value |
|------|--------|
| Webmail (inbox) | http://webmail.lab (alias http://inbox.lab) |
| Admin UI | http://mail.lab/admin |
| JMAP (browser) | same-origin under webmail: `http://webmail.lab/jmap/` |
| SMTP / IMAP host | `mail.lab` or `mail.dev.test` (`192.168.68.21`) |
| Zone | `dev.test` (Technitium on `dns-01`) → AdGuard upstream to `.11` |
| Apex A / MX | docker-01 / `mail.dev.test` |

Use AdGuard (`192.168.68.10`) as LAN DNS so `dev.test` and `*.lab` resolve.

## Credentials (from `secrets.yml`)

| Account | Password var |
|---------|----------------|
| Recovery (bootstrap only) | `vault_stalwart_recovery_password` |
| Admin UI `admin@dev.test` | `vault_stalwart_admin_password` |
| Seed mailboxes `info@` `noreply@` `support@` `notify@` | `vault_stalwart_mailbox_password` (shared) |
| Bulwark session cookie | `vault_bulwark_session_secret` |

Host copy of admin/mailbox metadata: `/opt/stalwart/bootstrap-admin.json`.

## Apply / rebuild

```bash
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml --limit docker-01 --tags ''
```

Role: `ansible/roles/stalwart` · DNS: `lab_mail_zone: dev.test` in `inventory/group_vars/all.yml`.

## Webmail CSP / JMAP (Bulwark)

Browsers load Bulwark from `http://webmail.lab` (and alias `http://inbox.lab`).
If `/api/config` returns `jmapServerUrl` pointing at a Docker hostname or a
different origin, CSP `connect-src 'self'` blocks JMAP and the inbox fails.

**Fix (in tree):** NPM on **docker-01** proxies `/api/config` and uses
`sub_filter` to rewrite `jmapServerUrl` to `$scheme://$host` (same-origin).
Works for both `webmail.lab` and `inbox.lab`.

```bash
# After docker-hosts / proxy-routes on docker-01:
curl -sS http://webmail.lab/api/config | jq .jmapServerUrl
# expect "http://webmail.lab" (or inbox.lab when hit that host) — not a container name
```

Live apply is **pending** if docker-01 was unreachable; Ansible role
`stalwart` + `proxy` already encode the rewrite.

## Related

- [docker-hosts.md](docker-hosts.md) · [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md)
