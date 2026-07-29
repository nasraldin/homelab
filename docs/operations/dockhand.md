# Dockhand

Runs on **`docker-01`** (`192.168.68.21`) under `/opt/dockhand` after the
2026-07-30 restructure (legacy LXC 118 / `.22` retired).

UI: `https://docker.nasraldin.com` (**Cloudflare Access**) · LAN `http://dockhand.lab`

## Role

Dockhand + **Hawser** agents manage Docker engines on lab hosts. Do **not** expose
the Docker TCP API on the WAN (or plain `:2375` on the LAN).

| Environment              | How it connects                                         |
| ------------------------ | ------------------------------------------------------- |
| `dockhand-local`         | Unix socket on docker-01 (`/var/run/docker.sock`)       |
| `docker-01`, `infisical-01` | Hawser **Edge** (outbound WebSocket to Dockhand)     |

## Automate environments

```bash
cd ~/homelab/lab-home-k8s/ansible
DOCKHAND_URL=http://192.168.68.21:3000 ./scripts/dockhand-register-environments.py
ansible-playbook playbooks/dockhand-agents.yml
```

Agents dial **LAN** Dockhand:

`ws://192.168.68.21:3000/api/hawser/connect`

See [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md) · [docker-hosts.md](docker-hosts.md).
