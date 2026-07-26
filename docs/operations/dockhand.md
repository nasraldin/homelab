# Dockhand

LXC **VMID 200** · LAN `192.168.68.24` · UI: `https://docker.nasraldin.com` (**Cloudflare Access**)

## Role

Dockhand + **Hawser** agents manage Docker engines on lab hosts. Do **not** expose
the Docker TCP API on the WAN (or plain `:2375` on the LAN).

| Environment                                                               | How it connects                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `dockhand-local`                                                          | Unix socket on the Dockhand CT (`/var/run/docker.sock`) |
| `docker-01`, `database-01`, `monitoring-01`, `sonarqube-01`, `elastic-01` | Hawser **Edge** (outbound WebSocket to Dockhand)        |
| `podman-01`                                                               | Not supported (Docker API / Hawser target)              |

## Automate environments (no UI “Add environment”)

Dockhand has a REST API (confirmed in [Finsys/dockhand#248](https://github.com/Finsys/dockhand/discussions/248) and upstream `POST /api/environments`):

```bash
# 1) Create envs + mint Hawser tokens → ansible-lab/files/dockhand-hawser-tokens.json
cd ~/homelab/ansible-lab
./scripts/dockhand-register-environments.py

# 2) Deploy Hawser agents on Docker hosts
ansible-playbook playbooks/dockhand-agents.yml
```

API surface used:

| Method                | Path                 | Purpose                                             |
| --------------------- | -------------------- | --------------------------------------------------- |
| `GET`/`POST`/`DELETE` | `/api/environments`  | List / create / remove environments                 |
| `POST`                | `/api/hawser/tokens` | Mint agent token (`environmentId`) — plaintext once |

With auth **disabled** (default first launch), no Bearer token is required. After you
enable Authentication in Settings, create an API token and pass
`DOCKHAND_API_TOKEN=…` or `./scripts/dockhand-register-environments.py --token …`.

Agents dial **LAN** Dockhand over WebSocket so Cloudflare Access does not block them:

`ws://192.168.68.24:3000/api/hawser/connect`

(`files/dockhand-hawser-tokens.json` is gitignored.)

## Related

- [docker-hosts.md](docker-hosts.md)
- cloudflare-tunnel: `docker.nasraldin.com` ingress + Access app
- Playbooks: `dockhand.yml` (UI) · `dockhand-agents.yml` (Hawser)
