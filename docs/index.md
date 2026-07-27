---
layout: home
hero:
  name: Nasr Aldin Homelab
  text: Platform engineering on real hardware.
  tagline: A working homelab run with production habits — Proxmox underneath, Git as source of truth, Kubernetes only when it earns its place, and day-two operations written down so rebuilds stay boring.
  actions:
    - theme: brand
      text: Where things stand
      link: /current-state
    - theme: alt
      text: Read the build story
      link: /build-story
---

<div class="hero-fullbleed">

![Homelab rack and network gear](/homelab-hero.webp)

</div>

<div class="home-intro">

This site is the notebook for my homelab — not a polished product brochure. I’m
[Nasr Aldin](https://nasraldin.com). I use this lab to practice platform
engineering end to end: build reliable infrastructure, automate the boring
parts, keep secrets out of Git, and write down failures so the next rebuild is
faster.

**How to use the docs:** start with the MacBook page (your laptop is the control
plane), then the build story, then [where things stand](/current-state). After
that, architecture and the roadmap make more sense.

Treat every config as a **reference**, not a copy-paste kit. Swap in your own
IPs, hostnames, and secrets from a password manager. Never commit passwords or
API keys.

</div>

## Suggested reading order

| Step | Page                                          | What you get                              |
| ---- | --------------------------------------------- | ----------------------------------------- |
| 1    | [MacBook workstation](/macbook/)              | SSH, Git, and tooling on the laptop       |
| 2    | [Build story](/build-story)                   | Why each major choice was made            |
| 3    | [Where things stand](/current-state)          | What is done, on hold, or next            |
| 4    | [Install journal](/installation/)             | Phase 0: Proxmox install notes and checks |
| 5    | [Architecture](/architecture/target-topology) | Storage, network, and service layout      |
| 6    | [Roadmap](/roadmap/)                          | What comes after the foundation           |

## What’s running in the lab

- **Hypervisor** — Proxmox VE on its own NVMe; guest disks on a separate data pool
- **Automation** — bootstrap scripts, Terraform for VMs/storage, Ansible for guest config
- **Edge** — Cloudflare Tunnel (+ Access where needed); Proxmox is never exposed on WAN `:8006`
- **OpsHub** — sibling [opshub](https://github.com/nasraldin/opshub) start page / consoles (clone as `opshub/`)
- **Cluster (planned)** — kubeadm, then Argo CD, Harbor, and in-cluster observability
- **Public Mac tools** — [Docker Lab](https://nasraldin.github.io/docker-lab/), [Camunda Lab](https://nasraldin.github.io/camunda-lab/), and [Dev Homelab](https://nasraldin.github.io/dev-homelab/) (separate physical machine)

## Useful runbooks

- [Platform tooling](/platform-tooling) — which tool owns which layer
- [Deploy and rebuild](/operations/deploy-and-rebuild) — command order across repos
- [Lab refresh runbook](/operations/lab-refresh-runbook) — wipe → rebuild checklist
- [Infra01 remote access](/operations/infra01-remote-access) — admin jump box off the LAN
- [Community labs](/community-labs) — standalone public projects
- [Decision log](/decisions/log) — choices we already locked in
