# Homelab repos — security / CI audit checklist

Date: 2026-07-24 · Living checklist after workspace audit.

## Ownership (DRY)

| Concern | Owner |
| ------- | ----- |
| Host bootstrap, firewall, update timer, host cleanup timer, factory-reset | `proxmox-bootstrap` |
| Guests, storages, vzdump jobs | `terraform-lab` |
| Guest config | `ansible-lab` |
| Public ingress | `cloudflare-tunnel` |
| Ops UI | `opshub` |
| Docs site | `homelab` (+ `homelab-docs` clone helper) |

Do **not** put host systemd timers in Terraform, or guest inventory in bootstrap.

## Secrets hygiene

| Repo | Secrets stay out of git via |
| ---- | --------------------------- |
| ansible-lab | `secrets.yml`, `*.vault`, `.env*`, licenses |
| terraform-lab | `credentials.auto.tfvars`, `*.tfstate`, `.env*` |
| proxmox-bootstrap | `config.env`, `.env*`, `*.pem` / `*.key` |
| cloudflare-tunnel | `config.env`, `.env*`, `state/` |
| opshub | `.env`, `.env.local`, `data/`, `*.db` |

Never commit live tokens. Prefer GitLab/GitHub **masked protected** CI variables.

## CI/CD readiness

| Repo | CI | Jobs |
| ---- | -- | ---- |
| ansible-lab | GitLab | syntax lint + manual run |
| terraform-lab | GitLab | validate / plan / apply |
| proxmox-bootstrap | GitHub Actions | bash -n, shellcheck, shfmt |
| cloudflare-tunnel | GitHub Actions | shell lint + unit tests |
| opshub | GitHub Actions | lint, typecheck, **build** |
| homebrew-tools | GitHub Actions | `brew style` + `brew audit` |
| docker-lab / camunda-lab | GitHub Actions | existing |
| homelab / homelab-docs | GitHub Actions | docs build |

## Destructive / privileged scripts

| Script | Guardrails |
| ------ | ---------- |
| `factory-reset-lab.sh` | `--check`, `--i-understand-destroy`, typed `DESTROY` |
| `host-cleanup.sh` | no guests/pools; `--check` / `--yes` |
| Timer `pve-host-cleanup` | safe defaults; EXTRA_ARGS allowlisted |

## Known debt (non-blocking)

- `camunda-lab` acceptance scripts: shellcheck SC2034 on harness env vars (cross-file).
- Full gitleaks/trufflehog scan in CI: optional follow-up.
- Migrate laptop Terraform state to GitLab HTTP backend before first real CI apply.
