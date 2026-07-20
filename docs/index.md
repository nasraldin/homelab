---
layout: home
hero:
  name: Nasr Aldin Homelab
  text: Platform engineering, built and operated for real.
  tagline: This homelab is my platform engineering playground, run with production principles. Proxmox provides the foundation, Git is the source of truth, Kubernetes is introduced only where it makes sense, and every service is managed with day-two operations in mind.
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

This site documents my working homelab—not a polished showcase. I’m [Nasr Aldin](https://nasraldin.com), and I use this lab to practice platform engineering end to end: build reliable infrastructure, automate repetitive work, keep secrets out of Git, and document failures so the next iteration is faster.

If you're following along as a student, read the documentation in order. Start with the MacBook (daily driver), then the build story, current state, and installation journal. The architecture and roadmap make more sense once you understand why the infrastructure exists.

Every configuration here is intended as a reference, not a copy-and-paste solution. Replace placeholders with values from your own environment and password manager, and never commit passwords, API keys, or other secrets to Git.

</div>

## How to read these docs

| Step | Go here                                       | Why                                                   |
| ---- | --------------------------------------------- | ----------------------------------------------------- |
| 1    | [MacBook workstation](/macbook/)              | Laptop is the control plane for SSH, Git, and tooling |
| 2    | [Build story](/build-story)                   | Why each choice was made                              |
| 3    | [Current state](/current-state)               | What’s done, next, or blocked                         |
| 4    | [Install journal](/installation/)             | Phase 0: Proxmox install, issues, checks              |
| 5    | [Architecture](/architecture/target-topology) | Storage, network, and services                        |
| 6    | [Roadmap](/roadmap/)                          | What comes after the foundation                       |

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
