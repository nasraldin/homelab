# Homelab workspace

Root git repo for **shared tooling only**. Each lab under this directory is its
own repository (ignored here) with its own remote.

| Lab | Repo |
|-----|------|
| Docs / ownership guide | https://github.com/nasraldin/homelab-docs |
| Ansible + install media | https://github.com/nasraldin/ansible-lab |
| Proxmox day-1 bootstrap | https://github.com/nasraldin/proxmox-bootstrap |
| Proxmox IaC | https://github.com/nasraldin/terraform-lab |
| Cloudflare Tunnel + Access | https://github.com/nasraldin/cloudflare-tunnel |
| Docker on Apple Silicon (`ducker`) | https://github.com/nasraldin/docker-lab |
| Camunda 8 local CLI | https://github.com/nasraldin/camunda-lab |
| Homebrew taps (nested tap repos) | local `taps/` only — not a single git repo |

All of the directories above are **gitignored by this root repo** the same way so they do not nest inside `nasraldin/homelab`. Each lab (except `taps/`) keeps its own `.git` and remote.

Local clones still live as siblings under `~/homelab/` so relative paths and
`make format` / `make lint` work across labs.

## Format & lint everything

```bash
cd ~/homelab
brew install yamllint shellcheck   # once
# optional: brew install shfmt terraform
npm install                        # Prettier
make format                        # write
make lint                          # check
```

| Tool | Config | Formats / checks |
|------|--------|------------------|
| EditorConfig | [`.editorconfig`](.editorconfig) | Indent, charset, newlines (all editors) |
| Prettier | [`.prettierrc.json`](.prettierrc.json) | Markdown, JSON, YAML |
| yamllint | [`.yamllint.yaml`](.yamllint.yaml) | YAML / Ansible / Compose |
| ShellCheck | [`.shellcheckrc`](.shellcheckrc) | `*.sh` |
| terraform fmt | (CLI) | `terraform-lab/**/*.tf` |
| shfmt (optional) | `make format-sh` | Shell indent |

Secrets (`config.env`, `credentials.auto.tfvars`, …) are in
[`.prettierignore`](.prettierignore) so formatters skip them.

## Lab map

See [homelab-docs](https://github.com/nasraldin/homelab-docs) (local: `./homelab-docs/`) for the platform ownership guide.
