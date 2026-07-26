# Homelab workspace

This is the **docs and curriculum hub** for my Platform Engineering homelab.
The searchable site is on GitHub Pages:

**Docs:** https://nasraldin.github.io/homelab/ — [Nasr Aldin](https://nasraldin.com)

Each lab under this folder is its **own Git repo** (they are gitignored here).
Clone them as siblings so local scripts and the docs site can see everything.

| Lab                                | Repo                                           | Notes                            |
| ---------------------------------- | ---------------------------------------------- | -------------------------------- |
| Docs (this repo)                   | https://github.com/nasraldin/homelab           | Public curriculum + Pages        |
| OpsHub (homelab dashboard)         | https://github.com/nasraldin/opshub            | Service hub, notes, plugins      |
| Ansible guest configuration        | https://github.com/nasraldin/ansible-lab       | Private                          |
| Proxmox day-1 bootstrap            | https://github.com/nasraldin/proxmox-bootstrap | Private                          |
| Proxmox IaC                        | https://github.com/nasraldin/terraform-lab     | Private                          |
| Cloudflare Tunnel + Access         | https://github.com/nasraldin/cloudflare-tunnel | Private                          |
| Docker on Apple Silicon (`ducker`) | https://github.com/nasraldin/docker-lab        | Public                           |
| Camunda 8 local CLI                | https://github.com/nasraldin/camunda-lab       | Public                           |
| Homebrew taps                      | local `homebrew/` only                         | Nested tap repos, not one remote |

## Fresh machine — clone everything

```bash
git clone git@github.com:nasraldin/homelab.git ~/homelab
cd ~/homelab
./clone-labs.sh              # clone everything listed in repos.json
./clone-labs.sh --pull       # also fast-forward existing clones
./clone-labs.sh --protocol https
```

To add a lab later: one line in [`repos.json`](repos.json)
(`"local/path": "owner/repo"`), then run `./clone-labs.sh` again. Nested paths
like `homebrew/homebrew-tools` work. Needs [`jq`](https://jqlang.org/)
(`brew install jq`).

## Documentation site

VitePress with full-text search: https://nasraldin.github.io/homelab/

```bash
make docs-install   # once
make docs-serve     # http://localhost:5173/homelab/
make docs-build     # output: docs/.vitepress/dist
```

Start reading at [docs/](docs/) (or the Pages site). Good first stops:

- [Where things stand](docs/current-state.md) — live status
- [Deploy and rebuild](docs/operations/deploy-and-rebuild.md) — command order
- [Infra01 remote access](docs/operations/infra01-remote-access.md) — off-LAN admin

Community labs (`docker-lab`, `camunda-lab`) keep their **own** MkDocs sites;
this hub links to them. Values that look like IPs or hostnames are
[placeholders](docs/conventions/placeholders.md) — adapt them; never commit
secrets.

## Format and lint

```bash
cd ~/homelab
brew install yamllint shellcheck   # once
# optional: brew install shfmt terraform
npm install                        # Prettier
make format                        # write
make lint                          # check
```

| Tool             | Config                                 | What it checks                                     |
| ---------------- | -------------------------------------- | -------------------------------------------------- |
| EditorConfig     | [`.editorconfig`](.editorconfig)       | Indent, charset, newlines                          |
| Prettier         | [`.prettierrc.json`](.prettierrc.json) | Markdown, JSON, YAML                               |
| yamllint         | [`.yamllint.yaml`](.yamllint.yaml)     | YAML / Ansible / Compose                           |
| ShellCheck       | [`.shellcheckrc`](.shellcheckrc)       | `*.sh`                                             |
| terraform fmt    | (CLI)                                  | `terraform-lab/**/*.tf`                            |
| shfmt (optional) | `make format-sh`                       | Shell indent — use **v3.10.0** flags that match CI |

Secrets (`config.env`, `credentials.auto.tfvars`, …) stay in
[`.prettierignore`](.prettierignore) so formatters skip them.
