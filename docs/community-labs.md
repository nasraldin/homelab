# Community labs

Optional public projects that complement this homelab curriculum. Their docs are
aggregated into this site when the sibling repos are cloned (or checked out in CI).

| Lab | Standalone docs | Purpose |
| --- | --------------- | ------- |
| [Docker Lab](labs/docker-lab/index.md) | [nasraldin.github.io/docker-lab](https://nasraldin.github.io/docker-lab/) | Native Linux Docker on Apple Silicon (`ducker`) |
| [Camunda Lab](labs/camunda-lab/index.md) | [nasraldin.github.io/camunda-lab](https://nasraldin.github.io/camunda-lab/) | Local Camunda 8 on Docker |

Clone siblings from the workspace root:

```bash
./clone-labs.sh
make docs-serve
```

!!! note "Implementation labs"
    Private day-1 repos (Proxmox bootstrap, Terraform, Ansible, Cloudflare Tunnel)
    are **not** mirrored into this public site. Follow the platform guides here and
    adapt commands to your own automation repositories.
