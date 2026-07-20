---
layout: home
hero:
  name: Nasr Aldin Homelab
  text: Platform engineering on hardware I actually run
  tagline: I build and operate this lab the same way I’d build a small platform team stack — Proxmox underneath, Git for truth, Kubernetes when it’s earned, and day-2 ops that don’t lie to you.
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

This site is my working notes for a real homelab — not a brochure. I’m [Nasr Aldin](https://nasraldin.com). I use this lab to practice Platform Engineering end to end: install once, automate what repeats, keep secrets out of Git, and write down what broke so the next pass is faster.

If you’re following along as a student, read **in order**. Skip around and the story falls apart. Start on the MacBook (daily driver), then the build story, then current state, then the install journal. Architecture and roadmap come after you know why the boxes exist.

Swap every [placeholder](/conventions/placeholders) for values from **your** network and password manager. Never commit tokens or passwords.

</div>

## How to read these docs

| Step | Go here | Why |
| ---- | ------- | --- |
| 1 | [MacBook workstation](/macbook/) | Laptop is the control plane for SSH, Git, and tooling |
| 2 | [Build story](/build-story) | Why each choice was made |
| 3 | [Current state](/current-state) | What’s done, next, or blocked |
| 4 | [Install journal](/installation/) | Phase 0: Proxmox install, issues, checks |
| 5 | [Architecture](/architecture/target-topology) | Storage, network, and services |
| 6 | [Roadmap](/roadmap/) | What comes after the foundation |

## What’s in the lab

- **Hypervisor** — Proxmox VE on its own NVMe; VMs on a separate data pool
- **Automation** — bootstrap scripts, Terraform for IaC, Ansible for install media
- **Edge** — Cloudflare Tunnel + Access for UI; no raw `:8006` on the WAN
- **Cluster (planned)** — kubeadm, Argo CD, Harbor, observability
- **Public tooling** — [Docker Lab](https://nasraldin.github.io/docker-lab/) and [Camunda Lab](https://nasraldin.github.io/camunda-lab/) for Mac day-to-day work

## Keep going

- [Platform tooling](/platform-tooling) — who owns what (Terraform vs Ansible vs Argo CD)
- [Community labs](/community-labs) — standalone public projects
- [Decision log](/decisions/log) — locked choices so we don’t re-debate them
