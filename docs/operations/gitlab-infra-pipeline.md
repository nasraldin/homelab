# GitLab CI for Terraform + Ansible (infra pipeline)

Professional contract so **`terraform-lab`** and **`ansible-lab`** can run from
GitLab pipelines: **full stack by default**, or **one guest / play** via
pipeline variables — without redesigning modules.

Status: **scaffolded** (CI YAML + scripts in each repo). Wire remote state and
CI/CD variables when you push these repos to GitLab and turn on runners.

## What this page covers

- Why selective apply must use `-target`, never a filtered `for_each`
- Env var contract (`TF_*`, `ANSIBLE_*`)
- Map of guest keys → Terraform addresses → Ansible limits
- Local dry-run commands (same scripts CI uses)
- Remote state, credentials, safety rails
- Rollout checklist before the first real pipeline

## Design rules (locked)

| Rule                                           | Why                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Do not** shrink `var.vms` for “only infra01” | Missing keys in `for_each` → Terraform **destroys** other VMs                           |
| **Do** use `-target=module.vm["infra01"]`      | Updates/creates one module instance; leaves the rest alone                              |
| Empty `TF_TARGET_GUESTS`                       | Full plan/apply of the whole root module                                                |
| Destroy                                        | Require `TF_TARGET_GUESTS` (or explicit `TF_ALLOW_FULL_DESTROY=true`)                   |
| Ansible                                        | Same playbooks + `--limit`; no playbook rewrite for CI                                  |
| Secrets                                        | CI/CD masked vars / File vars — never commit `credentials.auto.tfvars` or `secrets.yml` |

Guest keys are the keys in `terraform-lab/terraform.tfvars` → `vms` map
(same strings Ansible uses as `inventory_hostname`).

## Variable contract

### Terraform (`terraform-lab`)

| Variable                   | Meaning                                 | Example                           |
| -------------------------- | --------------------------------------- | --------------------------------- |
| `TF_ACTION`                | `plan` \| `apply` \| `destroy`          | `plan`                            |
| `TF_TARGET_GUESTS`         | Comma-separated `vms` keys; empty = all | `infra01` · `vault-01,vault-seal` |
| `TF_AUTO_APPROVE`          | Non-interactive apply/destroy           | `true` in CI apply job            |
| `TF_ALLOW_FULL_DESTROY`    | Required for destroy with empty targets | rarely `true`                     |
| `TF_VAR_proxmox_api_token` | Proxmox API token                       | GitLab masked                     |
| `TF_VAR_proxmox_endpoint`  | API URL if not only in tfvars           | optional                          |
| `SSH_PRIVATE_KEY`          | For provider SSH snippet upload         | GitLab File var                   |

Scripts:

- `scripts/ci-targets.sh` — builds `TF_TARGET_FLAGS`
- `scripts/ci-run.sh` — plan / apply / destroy

Address shape (already true today):

```text
module.vm["infra01"]
module.vm["vault-01"]
module.vm["vault-seal"]
…
```

### Ansible (`ansible-lab`)

| Variable                                  | Meaning                           | Example                        |
| ----------------------------------------- | --------------------------------- | ------------------------------ |
| `ANSIBLE_PLAYBOOK`                        | Playbook path                     | `playbooks/infra.yml`          |
| `ANSIBLE_LIMIT`                           | Host or group; empty = play hosts | `infra01` · `dns` · `vault-01` |
| `ANSIBLE_SECRETS` / `ANSIBLE_SECRETS_YML` | secrets file path or File var     | CI File var                    |
| `ANSIBLE_CHECK`                           | `true` → `--check --diff`         | dry-run                        |

Script: `scripts/ci-run.sh`

## Guest → TF target → Ansible cheat sheet

| Guest                     | `TF_TARGET_GUESTS` | Typical playbook               | `ANSIBLE_LIMIT`       |
| ------------------------- | ------------------ | ------------------------------ | --------------------- |
| `adguard-01`              | `adguard-01`       | `playbooks/dns.yml`            | `adguard-01` or `dns` |
| `technitium-01`           | `technitium-01`    | `playbooks/dns.yml`            | `technitium-01`       |
| `infra01`                 | `infra01`          | `playbooks/infra.yml`          | `infra01`             |
| `vault-seal`              | `vault-seal`       | `playbooks/object-storage.yml` | `vault-seal`          |
| `vault-01`                | `vault-01`         | `playbooks/object-storage.yml` | `vault-01`            |
| `aistor-01`               | `aistor-01`        | `playbooks/object-storage.yml` | `aistor-01`           |
| `gitlab-01`               | `gitlab-01`        | `playbooks/gitlab.yml`         | `gitlab-01`           |
| `runner-01`               | `runner-01`        | `playbooks/gitlab.yml`         | `runners` or name     |
| `database-01`             | `database-01`      | `playbooks/database.yml`       | `database-01`         |
| `docker-01` / Infisical   | `docker-01`        | `playbooks/docker-hosts.yml`   | `docker-01`           |
| `sonarqube-01`            | `sonarqube-01`     | `playbooks/sonarqube.yml`      | `sonarqube-01`        |
| `elastic-01`              | `elastic-01`       | `playbooks/elastic.yml`        | `elastic-01`          |
| `monitoring-01`           | `monitoring-01`    | `playbooks/monitoring.yml`     | `monitoring-01`       |
| `podman-01`               | `podman-01`        | `playbooks/podman-host.yml`    | `podman-01`           |
| `dockhand` (CT)           | `dockhand`         | `playbooks/dockhand.yml`       | `dockhand`            |

**Order still matters for new stacks:** DNS → vault-seal → vault-01 → aistor →
GitLab → **database** → docker-hosts (Infisical/Keycloak) → sonar/elastic/monitoring.
A targeted pipeline does not remove dependency awareness — it only scopes _which_
resource the job touches.

## Local dry-run (same as CI)

```bash
# Terraform — plan only infra01
cd ~/homelab/terraform-lab
TF_ACTION=plan TF_TARGET_GUESTS=infra01 ./scripts/ci-run.sh

# Terraform — full plan
TF_ACTION=plan ./scripts/ci-run.sh

# Ansible — one host
cd ~/homelab/ansible-lab
ANSIBLE_PLAYBOOK=playbooks/infra.yml ANSIBLE_LIMIT=infra01 ./scripts/ci-run.sh
```

## How you run it in GitLab UI

1. Open **CI/CD → Run pipeline**
2. Set variables, e.g.:
   - `TF_TARGET_GUESTS` = `infra01`
   - `TF_ACTION` = `plan` (apply job remains **manual**)
3. For destroy one guest: run **destroy** job with `TF_TARGET_GUESTS=docker-01`

Default branch pipelines without `TF_TARGET_GUESTS` → **full** plan (then manual apply).

## Remote state (before first real CI apply)

Today state is **local** (`terraform.tfstate`). CI skeletons write a temporary
`backend.tf` (`backend "http" {}`) and use GitLab’s HTTP state + job token lock.

**One-time migration** (from a machine with current state), after the project
exists on GitLab:

```bash
cd ~/homelab/terraform-lab
# create backend.tf with backend "http" {}  (same as CI)
# export TF_HTTP_* pointing at the GitLab project state URL + your PAT
terraform init   # migrate state → GitLab
```

Until migration: do **not** apply from CI against a second empty state (split
brain). `resource_group: terraform-lab` serialises jobs; it does not replace
remote state.

## Credentials map

| Secret                  | Where in CI                    | Later SoT                            |
| ----------------------- | ------------------------------ | ------------------------------------ |
| Proxmox API token       | `TF_VAR_proxmox_api_token`     | Vault `infra/data/proxmox/terraform` |
| Ansible `secrets.yml`   | File var `ANSIBLE_SECRETS_YML` | Shrink toward Vault AppRole          |
| SSH to Proxmox / guests | `SSH_PRIVATE_KEY`              | Offline / agent                      |

See [secret-ownership-map.md](../architecture/secret-ownership-map.md).

## What was verified ready (no redesign)

| Capability                    | Ready? | Mechanism                                                          |
| ----------------------------- | ------ | ------------------------------------------------------------------ |
| Full TF plan/apply            | ✅     | empty `TF_TARGET_GUESTS`                                           |
| Single VM create/update       | ✅     | `TF_TARGET_GUESTS=infra01` → `-target=module.vm["infra01"]`        |
| Multi VM                      | ✅     | comma list                                                         |
| Single VM destroy             | ✅     | `TF_ACTION=destroy` + target (full destroy blocked)                |
| Ansible one host              | ✅     | `ANSIBLE_LIMIT`                                                    |
| Ansible one playbook          | ✅     | `ANSIBLE_PLAYBOOK`                                                 |
| Images/pools already in state | ⚠️     | Targeted VM apply assumes image/snippet exist (normal after day-0) |

## Antipatterns

| Don’t                                      | Do                                      |
| ------------------------------------------ | --------------------------------------- |
| `vms = { only = infra01 }` in CI tfvars    | `-target` / `TF_TARGET_GUESTS`          |
| Auto-apply destroy on merge                | Manual destroy job + target             |
| Commit secrets into the TF/Ansible repos   | GitLab masked / File vars → later Vault |
| Two concurrent applies on local + CI state | Migrate to GitLab HTTP state first      |

## Rollout checklist

1. Push `terraform-lab` / `ansible-lab` to GitLab (with `.gitlab-ci.yml` + scripts)
2. Add CI/CD variables (Proxmox token, SSH key, Ansible secrets file)
3. Migrate Terraform state to GitLab HTTP backend once
4. Run pipeline: full **plan** (no targets) — expect no surprise destroys
5. Run pipeline: `TF_TARGET_GUESTS=infra01` plan → manual apply
6. Run Ansible pipeline: `ANSIBLE_PLAYBOOK=playbooks/infra.yml` `ANSIBLE_LIMIT=infra01`
7. Document project IDs / state name in this page when known

## Related

- [deploy-and-rebuild.md](deploy-and-rebuild.md)
- [gitlab.md](gitlab.md)
- [guest-vmid-map.md](guest-vmid-map.md)
- [secret-ownership-map.md](../architecture/secret-ownership-map.md)
- Scripts: `terraform-lab/scripts/ci-*.sh`, `ansible-lab/scripts/ci-run.sh`
