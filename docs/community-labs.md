# Use the Public Labs Alongside This Homelab

Sibling public labs that sit next to this homelab curriculum. Useful alone if you only need Docker or Camunda on a laptop; same MacBook workflow I use against Proxmox when you’re on the full path. Each project has its own docs site so the CLI stories stay focused.

Read this after [current state](current-state.md) if you’re wiring the Mac control plane; clone sources under `~/homelab` when you want them beside these docs.

## What this page covers

- Docker Lab and Camunda Lab docs links
- How to clone sibling repos with `./clone-labs.sh`
- What stays private (bootstrap / Terraform / tunnel) vs what’s public here

| Lab | Docs | What it’s for |
| --- | ---- | ------------- |
| [Docker Lab](https://nasraldin.github.io/docker-lab/) | Standalone Pages | Real Linux Docker on Apple Silicon (`ducker`) |
| [Camunda Lab](https://nasraldin.github.io/camunda-lab/) | Standalone Pages | Local Camunda 8 on Docker |

Clone the sibling repos under `~/homelab` when you want the source next to this curriculum:

```bash
./clone-labs.sh
```

::: tip Private implementation repos
Day-1 automation (Proxmox bootstrap, Terraform, Ansible, Cloudflare Tunnel) stays private. Follow the guides on this site and map the steps into your own repos — don’t expect those private trees to appear here.
:::

More from [Nasr Aldin](https://nasraldin.com).
