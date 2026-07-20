# Mac: Lima + Docker (no Docker Desktop)

Local Docker practice on Apple Silicon — **fast, terminal-native, production-like Linux underneath**.

Your Mac: **arm64**, **36 GB RAM** (adjust Lima sizing below; ignore generic “64 GB” guides).

---

## Stack

```text
macOS (zsh, Homebrew)
  │
  ├── docker CLI + compose plugin (Homebrew)
  │
  └── Lima (vmType: vz)
        │
        Debian 12 arm64
        │
        dockerd → containerd → runc
```

**Kubernetes stays on the X1 Pro** — not on Lima.

---

## Homebrew messages (expected)

### Lima guest agents

```text
brew install lima-additional-guestagents
```

**Skip** for native **arm64** Linux VMs on Apple Silicon. Only needed for **x86_64** guests via emulation.

### Docker Compose plugin

Homebrew installs the plugin at:

```text
/opt/homebrew/lib/docker/cli-plugins
```

Merge into `~/.docker/config.json` (keep your existing keys):

```json
{
  "cliPluginsExtraDirs": [
    "/opt/homebrew/lib/docker/cli-plugins"
  ]
}
```

Verify:

```bash
docker compose version
```

---

## Migrate off Docker Desktop

You currently have `credsStore: desktop` and `currentContext: desktop-linux` in `~/.docker/config.json`.

1. Quit Docker Desktop (menu bar → Quit).
2. Remove or comment out `"credsStore": "desktop"` and `"currentContext": "desktop-linux"` after Lima works.
3. Point CLI at Lima socket (below).

Optional: `brew uninstall --cask docker` once Lima is validated.

---

## Recommended Lima profile

Copy the template from this repo:

```bash
mkdir -p ~/.lima
cp ~/homelab/homelab-docs/lima/docker-prod.yaml ~/.lima/docker-prod.yaml
limactl start docker-prod --tty=false
```

### Sizing (36 GB Mac)

| Resource | Value | Why |
| -------- | ----- | --- |
| `cpus` | 6 | Leave cores for macOS + IDE |
| `memory` | 12GiB | ~24 GB left for macOS (not 24GiB for Lima) |
| `disk` | 150GiB | Images, layers, build cache |
| `vmType` | `vz` | Apple Virtualization Framework — fastest |
| OS | Debian 12 arm64 | Matches future Proxmox k8s nodes |

Edit `~/.lima/docker-prod.yaml` if you need more RAM for heavy Compose stacks (max **16GiB** on 36 GB host).

---

## Connect Docker CLI

After `limactl start docker-prod`:

```bash
export DOCKER_HOST=unix://${HOME}/.lima/docker-prod/sock/docker.sock
docker version   # must show Server, not "Cannot connect"
```

Add to `~/.zshrc`:

```bash
export DOCKER_HOST=unix://${HOME}/.lima/docker-prod/sock/docker.sock
export DOCKER_BUILDKIT=1
```

```bash
source ~/.zshrc
docker run --rm hello-world
```

---

## Performance practices

### Inside Lima (`limactl shell docker-prod`)

`/etc/docker/daemon.json`:

```json
{
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "features": {
    "buildkit": true
  }
}
```

```bash
sudo systemctl restart docker
```

### BuildKit / buildx

```bash
docker buildx create --name lima-builder --use
docker buildx ls
```

### Compose / Node projects

Avoid bind-mounting huge trees from macOS (`node_modules`, `.next`). Use named volumes:

```yaml
volumes:
  - .:/app
  - node_modules:/app/node_modules
```

### Learn internals (do not skip)

```bash
limactl shell docker-prod
ps aux | grep -E 'dockerd|containerd'
ls /var/lib/docker
containerd --version
runc --version
```

---

## Lima vs VirtualBox

| | Lima (`vz`) | VirtualBox |
| - | ----------- | ---------- |
| Apple Silicon | Native | Poor / emulated |
| Docker workload speed | **Best** | Slower |
| Full VM learning | Good enough | Manual ISO install |
| Your X1 Pro | N/A | Use Proxmox instead |

Use **Proxmox** for “install Debian from ISO, systemd, kubeadm” — use **Lima** for daily Docker CLI speed.

---

## Tooling on Mac (Homebrew)

```bash
brew install lima docker docker-compose kubectl helm terraform ansible jq
```

Skip `lima-additional-guestagents` unless you run x86_64 guests.

---

## Next steps

1. Fix `~/.docker/config.json` (compose plugin path)
2. `limactl start docker-prod`
3. Set `DOCKER_HOST` in `~/.zshrc`
4. `docker run hello-world` + explore with `limactl shell`
5. On X1 Pro: [kubeadm architecture](../kubeadm-architecture.md) Stage A

---

## Related

- [kubeadm architecture](../kubeadm-architecture.md)
- [Lima template](../../../lima/docker-prod.yaml)
