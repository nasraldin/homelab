# MacBook workstation

This is the machine I sit at every day — a MacBook that talks to the Proxmox node over the LAN (and sometimes over Tunnel). Treat it as part of the platform: SSH keys, Git remotes, Terraform, editors, and browser tabs all live here.

Docs in this section will cover how I set up the laptop for homelab work: CLI tools, SSH config, DNS/hosts tricks, Docker on Apple Silicon, and the habits that keep secrets out of the wrong places.

::: info Coming soon
I’m still writing these pages. Until they land, use [Docker Lab](https://nasraldin.github.io/docker-lab/) for Linux Docker on macOS, and the [install journal](../installation/) for how the Mac talks to `pve01` after install.
:::

## What will go here

| Topic | Intent |
| ----- | ------ |
| Baseline setup | Homebrew, shells, editors, Git identity |
| SSH & hosts | Key auth to Proxmox, `/etc/hosts` vs lab DNS |
| Day-to-day CLIs | Terraform, kubectl (later), lab CLIs |
| Containers on Mac | Lima / Docker Lab workflow |
| Secrets hygiene | What never leaves the password manager |

## Related now

- [Current state](../current-state.md) — lab progress from the hypervisor side
- [Build story](../build-story.md) — how the Mac fits into the overall timeline
- [Placeholders](../conventions/placeholders.md) — example IPs and hostnames used in commands
