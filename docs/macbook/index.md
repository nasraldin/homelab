# MacBook — your day-to-day control plane

Your laptop is part of the platform. SSH keys, Git remotes, Terraform, editors,
and browser sessions live here. Proxmox is the hypervisor; the Mac is how you
drive it on the LAN (and sometimes through Cloudflare Tunnel).

This section is still filling in. Until more pages land, use
[Docker Lab](https://nasraldin.github.io/docker-lab/) for Linux Docker on
macOS, and the [install journal](../installation/) for how the Mac talks to
`pve01` after install. Always check
[placeholders](../conventions/placeholders.md) before you copy IPs or hostnames.

## What this page covers

- What belongs on the Mac vs on the hypervisor
- Planned topics (tools, SSH, CLIs, containers, secrets)
- Links that already exist while this section grows

::: info Coming soon
I’m still writing dedicated Mac setup pages. Until they land, use
[Docker Lab](https://nasraldin.github.io/docker-lab/) for Linux Docker on
macOS, and the [install journal](../installation/) for post-install Mac → node
wiring.
:::

## Planned topics

| Topic             | Intent                                                      |
| ----------------- | ----------------------------------------------------------- |
| Baseline setup    | Homebrew, shells, editors, Git identity                     |
| SSH & hosts       | Key auth to Proxmox, `/etc/hosts` vs lab DNS                |
| Remote desktops   | [remote connectivity](../operations/remote-connectivity.md) |
| Day-to-day CLIs   | Terraform, kubectl (later), lab CLIs                        |
| Containers on Mac | Lima / Docker Lab workflow                                  |
| Secrets hygiene   | What never leaves the password manager                      |

## Related now

- [Remote connectivity](../operations/remote-connectivity.md) — SSH, RDP, RustDesk, NoMachine
- [Mac DNS](../operations/mac-dns.md) — pin / restore DNS when AdGuard is down
- [LAN DNS resilience](../operations/lan-dns-resilience.md) — why `.10` matters for the whole LAN
- [infra01 remote access](../operations/infra01-remote-access.md) — SSH via Cloudflare Access
- [Where things stand](../current-state.md) — lab progress from the hypervisor side
- [Build story](../build-story.md) — how the Mac fits the timeline
- [Placeholders](../conventions/placeholders.md) — example IPs and hostnames in commands
