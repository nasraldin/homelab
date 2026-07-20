# Set Up the MacBook as Your Homelab Workstation

Day-to-day control plane for the lab: the MacBook that talks to Proxmox over the LAN (and sometimes over Tunnel). SSH keys, Git remotes, Terraform, editors, and browser sessions live here — treat the laptop as part of the platform, not a side note.

Pages in this section are still landing. Until they do, use [Docker Lab](https://nasraldin.github.io/docker-lab/) for Linux Docker on macOS, and the [install journal](../installation/) for how the Mac talks to `pve01` after install. Pair with [placeholders](../conventions/placeholders.md) before you copy IPs or hostnames.

## What this page covers

- What belongs on the Mac vs on the hypervisor
- Planned topics (baseline tools, SSH/hosts, CLIs, containers, secrets)
- Links to current state and build story while this section fills in

::: info Coming soon
I’m still writing these pages. Until they land, use [Docker Lab](https://nasraldin.github.io/docker-lab/) for Linux Docker on macOS, and the [install journal](../installation/) for how the Mac talks to `pve01` after install.
:::

## What will go here

| Topic             | Intent                                       |
| ----------------- | -------------------------------------------- |
| Baseline setup    | Homebrew, shells, editors, Git identity      |
| SSH & hosts       | Key auth to Proxmox, `/etc/hosts` vs lab DNS |
| Day-to-day CLIs   | Terraform, kubectl (later), lab CLIs         |
| Containers on Mac | Lima / Docker Lab workflow                   |
| Secrets hygiene   | What never leaves the password manager       |

## Related now

- [Current state](../current-state.md) — lab progress from the hypervisor side
- [Build story](../build-story.md) — how the Mac fits into the overall timeline
- [Placeholders](../conventions/placeholders.md) — example IPs and hostnames used in commands
