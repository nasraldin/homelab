# Community labs

I keep a few public tools next to this homelab. They’re useful on their own if you only need Docker or Camunda on a laptop — and they plug into the same MacBook workflow I use against Proxmox.

Each project has its **own** docs site so the CLI stories stay focused.

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
