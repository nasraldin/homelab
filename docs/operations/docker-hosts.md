# docker-01 — app Compose host

LAN: `192.168.68.21` · VMID **117**

After [lab-restructure-2026-07-30](lab-restructure-2026-07-30.md): lab-wide HTTP
edge (NPM), mail, AIStor, Dockhand, and Portainer live here with it-tools /
mailpit. DNS and Infisical are dedicated LXCs (`.10` / `.11` / `.25`).

## Stacks

| Path | App |
| ---- | --- |
| `/opt/proxy` | Nginx Proxy Manager (`:80/:443/:81`) + OpenClaw `/__oc_boot` |
| `/opt/stalwart` | Stalwart + Bulwark (webmail CSP rewrite via NPM) |
| `/opt/it-tools` | it-tools (`:1000`) |
| `/opt/mailpit` | Mailpit (SMTP 1025, UI 8025) |
| `/opt/dockhand` | Dockhand UI (`:3000`) |
| `/opt/portainer` | Portainer CE (`:9443`) |
| AIStor systemd | MinIO AIStor Free (`:9000/:9001`) |

OpenClaw **gateway pods** run in k8s (`ai-tools`); NPM on this host only does the
plug-and-play `#token=` bootstrap — [openclaw.md](openclaw.md).

## Playbook

```bash
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml --limit docker-01
# NPM routes / OpenClaw boot only:
ansible-playbook playbooks/proxy-routes.yml -e @secrets.yml
```

## Related

- Proxy Manager: `http://proxy.lab:81`
- [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md) · [lab-home-inventory.md](lab-home-inventory.md)
- [infisical.md](infisical.md) · [stalwart.md](stalwart.md) · [dockhand.md](dockhand.md)
