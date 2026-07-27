# Community labs (public side projects)

These are **public** sibling labs that sit next to this curriculum. You can use
them alone (Docker or Camunda on a laptop) or together with the full Proxmox
path. Each project keeps its own docs site so the CLI stories stay focused.

If you are wiring the Mac as a control plane, skim
[where things stand](current-state.md) first. To clone sources beside this repo:

```bash
./clone-labs.sh
```

That pulls every entry in [`repos.json`](https://github.com/nasraldin/homelab/blob/main/repos.json), including **`lab-home-k8s`**, **`lab-home-gitops`**, and **`dev-homelab`** (each is its own git repo; directories are gitignored inside the homelab hub).

## What this page covers

- Links to Docker Lab, Camunda Lab, and Dev Homelab docs
- How to clone sibling repos (including `lab-home-*` automation repos)
- What stays private vs what is public

| Lab                                                     | Docs             | What it’s for                                 |
| ------------------------------------------------------- | ---------------- | --------------------------------------------- |
| [Docker Lab](https://nasraldin.github.io/docker-lab/)   | Standalone Pages | Real Linux Docker on Apple Silicon (`ducker`) |
| [Camunda Lab](https://nasraldin.github.io/camunda-lab/) | Standalone Pages | Local Camunda 8 on Docker                     |
| [Dev Homelab](https://nasraldin.github.io/dev-homelab/) | Standalone Pages | Daily-use K8s on dedicated Proxmox hardware   |

::: tip Private implementation repos
Day-1 automation (Proxmox bootstrap, Terraform, Ansible, Cloudflare Tunnel)
stays private. Follow the guides on this site and map the steps into your own
repos — don’t expect those private trees to appear here.
:::

More from [Nasr Aldin](https://nasraldin.com).
