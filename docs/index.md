---
layout: home
hero:
  name: Nasr Aldin Homelab
  text: Platform engineering on hardware I actually run
  tagline: I build and operate this lab the same way I’d build a small platform team stack — Proxmox underneath, Git for truth, Kubernetes when it’s earned, and day-2 ops that don’t lie to you.
  image:
    src: /homelab-hero.webp
    alt: Homelab rack and network gear
  actions:
    - theme: brand
      text: Where things stand
      link: /current-state
    - theme: alt
      text: Read the build story
      link: /build-story
---

<div class="home-intro">

This site is my working notes for a real homelab — not a marketing brochure. I’m [Nasr Aldin](https://nasraldin.com), and I use this lab to practice Platform Engineering end to end: install once, automate what repeats, keep secrets out of Git, and write down what broke so the next pass is faster.

If you’re a student following along, read **in order**. Jumping around will feel like half the story is missing. Start on the MacBook (that’s the daily driver), then the build story, then current state, then the install journal. Architecture and roadmap come after you know *why* the boxes exist.

Replace every [placeholder](/conventions/placeholders) with values from **your** network and password manager. Never commit tokens or passwords.

</div>

## How to read these docs

| Step | Go here | Why |
| ---- | ------- | --- |
| 1 | [MacBook workstation](/macbook/) | Your laptop is the control plane for SSH, Git, and tooling |
| 2 | [Build story](/build-story) | The narrative — why each choice was made |
| 3 | [Current state](/current-state) | What’s done, what’s next, what’s blocked |
| 4 | [Install journal](/installation/) | Phase 0: Proxmox install, issues, verified checks |
| 5 | [Architecture](/architecture/target-topology) | How storage, network, and services fit together |
| 6 | [Roadmap](/roadmap/) | Phases after the foundation is solid |

## What’s in the lab

- **Hypervisor** — Proxmox VE on dedicated NVMe, VMs on a separate data pool
- **Automation** — bootstrap scripts, Terraform for IaC, Ansible where install media matters
- **Edge** — Cloudflare Tunnel + Access for UI; no raw `:8006` on the WAN
- **Cluster (planned)** — kubeadm, Argo CD, Harbor, observability
- **Public tooling** — [Docker Lab](https://nasraldin.github.io/docker-lab/) and [Camunda Lab](https://nasraldin.github.io/camunda-lab/) for day-to-day Mac workflows

## Keep going

- [Platform tooling](/platform-tooling) — who owns what (Terraform vs Ansible vs Argo CD)
- [Community labs](/community-labs) — standalone public projects
- [Decision log](/decisions/log) — locked choices so we don’t redo debates
