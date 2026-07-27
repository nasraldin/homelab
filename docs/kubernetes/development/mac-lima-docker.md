# Run Docker on Apple Silicon Without Docker Desktop

Use [Docker Lab](https://nasraldin.github.io/docker-lab/) (Lima + rootless Docker + `ducker`) on Apple Silicon when you want container practice without Docker Desktop. The guest is a real Linux VM (`dockerd` → `containerd` → `runc`), which is closer to how servers run containers than Desktop’s app wrapper.

This Mac is **arm64** with **36 GB RAM** — size the Lima profile for that, not generic “64 GB” guides. Kubernetes stays on the X1 Pro; Lima is for images, Compose, and runtime exploration only.

## What this page covers

- Docker Lab stack on macOS (Lima + rootless Engine)
- Homebrew paths, Compose plugin, and Desktop migration
- Recommended profile for a 36 GB Mac
- Limits: what belongs on Mac vs Proxmox

## Stack

```text
macOS (zsh, Homebrew)
  │
  ├── docker CLI + compose plugin (Homebrew)
  │
  └── Lima (vmType: vz)
        │
        Debian 13 arm64 (rootless Engine)
        │
        dockerd → containerd → runc
```

**Kubernetes stays on the X1 Pro** — not on Lima.

---

## Install (Docker Lab)

Clone the lab if you have not already:

```bash
cd ~/homelab
./clone-labs.sh          # or: git clone …/docker-lab.git ~/homelab/docker-lab
cd ~/homelab/docker-lab
./ducker cli-install
ducker profile homelab-36gb
ducker install
ducker verify
```

The `homelab-36gb` profile matches a **36 GB Mac**: 6 CPUs, 12 GiB RAM, 150 GiB disk — enough for Compose and builds while leaving headroom for macOS and your IDE.

Full install options and troubleshooting: [Docker Lab installation](https://nasraldin.github.io/docker-lab/installation/).

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

`ducker install` merges this into `~/.docker/config.json`. If you set up manually, keep your existing keys:

```json
{
  "cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]
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
2. Run `ducker install` (or remove Desktop keys after Lima works).
3. Point CLI at the Lima socket (below).

Optional: `brew uninstall --cask docker` once Docker Lab is validated.

---

## Sizing (36 GB Mac)

| Resource | `homelab-36gb`  | Why                                        |
| -------- | --------------- | ------------------------------------------ |
| `cpus`   | 6               | Leave cores for macOS + IDE                |
| `memory` | 12GiB           | ~24 GB left for macOS (not 24GiB for Lima) |
| `disk`   | 150GiB          | Images, layers, build cache                |
| `vmType` | `vz`            | Apple Virtualization Framework — fastest   |
| OS       | Debian 13 arm64 | Matches Docker Lab + future Proxmox nodes  |

Need more RAM for heavy Compose stacks? Try `ducker profile balanced` (16 GiB) — stay at or below **16GiB** on a 36 GB host.

Change profile **before** first install, or recreate after:

```bash
ducker profile homelab-36gb
ducker vm-uninstall && ducker install
```

---

## Connect Docker CLI

After `ducker install`, the managed snippet in `~/.zshrc` sets:

```bash
export DOCKER_HOST=unix://${HOME}/.lima/docker/sock/docker.sock
export DOCKER_BUILDKIT=1
```

Verify:

```bash
source ~/.zshrc
docker version   # must show Server, not "Cannot connect"
docker run --rm hello-world
```

---

## Performance practices

### Guest daemon config (rootless)

Docker Lab uses **rootless** Engine. Config lives at `~/.config/docker/daemon.json` inside the guest — not `/etc/docker/daemon.json`. Edit `~/homelab/docker-lab/config/daemon.json` on the host, then:

```bash
ducker daemon
ducker verify
```

See [Docker Lab — daemon config](https://nasraldin.github.io/docker-lab/docker-daemon/).

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
ducker shell
ps aux | grep -E 'dockerd|containerd'
ls ~/.local/share/docker
containerd --version
runc --version
```

---

## Lima vs VirtualBox

|                       | Lima (`vz`) | VirtualBox          |
| --------------------- | ----------- | ------------------- |
| Apple Silicon         | Native      | Poor / emulated     |
| Docker workload speed | **Best**    | Slower              |
| Full VM learning      | Good enough | Manual ISO install  |
| Your X1 Pro           | N/A         | Use Proxmox instead |

Use **Proxmox** for “install Debian from ISO, systemd, kubeadm” — use **Lima** for daily Docker CLI speed.

---

## Tooling on Mac (Homebrew)

```bash
brew install lima docker docker-compose kubectl helm terraform ansible jq
```

Skip `lima-additional-guestagents` unless you run x86_64 guests.

---

## Next steps

1. `ducker profile homelab-36gb && ducker install`
2. Confirm `docker run hello-world`
3. Explore with `ducker shell`
4. On X1 Pro: [kubeadm architecture](../kubeadm-architecture.md) Stage A

---

## Related

- [kubeadm architecture](../kubeadm-architecture.md)
- [Docker Lab](https://nasraldin.github.io/docker-lab/) — canonical Lima template (`lima-docker.yaml`), profiles, and `ducker` CLI
- [Docker Lab — installation](https://nasraldin.github.io/docker-lab/installation/)
