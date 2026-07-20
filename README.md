# Homelab workspace

Root repository for the **Platform Engineering homelab curriculum** and shared
tooling. Documentation is published as a searchable GitHub Pages site.

**Docs site:** https://nasraldin.github.io/homelab/ — by [Nasr Aldin](https://nasraldin.com)

Each lab under this directory is its own repository (gitignored here) with its
own remote. Clone them as siblings for local development and docs aggregation.

| Lab                                | Repo                                           | Notes                          |
| ---------------------------------- | ---------------------------------------------- | ------------------------------ |
| Docs (this repo)                   | https://github.com/nasraldin/homelab           | Public curriculum + Pages      |
| Ansible + install media            | https://github.com/nasraldin/ansible-lab       | Private implementation         |
| Proxmox day-1 bootstrap            | https://github.com/nasraldin/proxmox-bootstrap | Private implementation         |
| Proxmox IaC                        | https://github.com/nasraldin/terraform-lab     | Private implementation         |
| Cloudflare Tunnel + Access         | https://github.com/nasraldin/cloudflare-tunnel | Private implementation         |
| Docker on Apple Silicon (`ducker`) | https://github.com/nasraldin/docker-lab        | Public community project       |
| Camunda 8 local CLI                | https://github.com/nasraldin/camunda-lab       | Public community project       |
| Homebrew taps (nested tap repos)   | local `homebrew/` only                         | Not a single git repo          |

> Legacy docs repo `homelab-docs` still exists locally until migration is
> verified; do not treat it as the source of truth anymore.

## Clone all labs (fresh machine)

```bash
git clone git@github.com:nasraldin/homelab.git ~/homelab
cd ~/homelab
./clone-labs.sh              # clone everything in repos.conf
./clone-labs.sh --pull       # also fast-forward update existing clones
./clone-labs.sh --protocol https
```

Add a future lab: one line in [`repos.conf`](repos.conf) (`path` + tab + `owner/repo`),
then re-run `./clone-labs.sh`. Nested paths like `homebrew/homebrew-tools` are supported.

## Documentation site

VitePress site with full-text search. Published at
https://nasraldin.github.io/homelab/

```bash
make docs-install   # once (npm install — VitePress)
make docs-serve     # http://localhost:5173/homelab/
make docs-build     # output: docs/.vitepress/dist
```

- Platform guides live in [`docs/`](docs/) (committed).
- Community labs (`docker-lab`, `camunda-lab`) keep their **own** MkDocs sites — linked from this hub.
- Values that look like IPs or hostnames are **[placeholders](docs/conventions/placeholders.md)** — adapt them; never commit secrets.

## Format & lint everything

```bash
cd ~/homelab
brew install yamllint shellcheck   # once
# optional: brew install shfmt terraform
npm install                        # Prettier
make format                        # write
make lint                          # check
```

| Tool             | Config                                 | Formats / checks                        |
| ---------------- | -------------------------------------- | --------------------------------------- |
| EditorConfig     | [`.editorconfig`](.editorconfig)       | Indent, charset, newlines (all editors) |
| Prettier         | [`.prettierrc.json`](.prettierrc.json) | Markdown, JSON, YAML                    |
| yamllint         | [`.yamllint.yaml`](.yamllint.yaml)     | YAML / Ansible / Compose                |
| ShellCheck       | [`.shellcheckrc`](.shellcheckrc)       | `*.sh`                                  |
| terraform fmt    | (CLI)                                  | `terraform-lab/**/*.tf`                 |
| shfmt (optional) | `make format-sh`                       | Shell indent                            |

Secrets (`config.env`, `credentials.auto.tfvars`, …) are in
[`.prettierignore`](.prettierignore) so formatters skip them.
