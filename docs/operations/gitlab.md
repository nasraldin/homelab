# GitLab Omnibus Operations

Day-2 notes for `gitlab-01` / runners after Terraform + Ansible.

**lab-home-k8s (live Dev Homelab):** `gitlab-01` = VMID **111**, LAN
**`192.168.68.15`**, object store → AIStor on **docker-01** `.21:9000`.
In-cluster runner: [gitlab-runner-k8s.md](gitlab-runner-k8s.md).

**terraform-lab** design (alternate IPs/VMIDs):
[2026-07-23-gitlab-omnibus-design.md](../superpowers/specs/2026-07-23-gitlab-omnibus-design.md)
· [guest-vmid-map.md](guest-vmid-map.md).

**Rule:** day-2 GitLab behaviour that must survive destroy/reapply belongs in
Ansible (`lab-home-k8s` or `ansible-lab`), not one-off `gitlab-rails` or UI clicks.

## Addresses (lab-home-k8s)

| Guest | VMID | LAN | Public |
| ----- | ---- | --- | ------ |
| `gitlab-01` | 111 | `192.168.68.15` | `https://gitlab.nasraldin.com` |
| Container Registry | (same) | `:5050` | `https://gregistry.nasraldin.com` |
| `runner-01` (host) | 112 | `192.168.68.16` | Static Docker executor |
| Runner (k8s) | — | `gitops` NS | [gitlab-runner-k8s.md](gitlab-runner-k8s.md) |

No Cloudflare Access on GitLab/gregistry — GitLab login + HTTPS git with a PAT.

## What Ansible enforces (DB / runners)

`playbooks/gitlab.yml` ends with a reconcile on `gitlab-01` so registration
order cannot leave wrong tags:

| Concern                        | Enforced value                      | Where                                   |
| ------------------------------ | ----------------------------------- | --------------------------------------- |
| Root password                  | `vault_gitlab_root_password`        | `application_settings.rb.j2`            |
| Open signup                    | **off**                             | `gitlab_signup_enabled: false`          |
| Default branch                 | `main`                              | ApplicationSettings                     |
| Auto DevOps                    | **off**                             | ApplicationSettings                     |
| Web IDE extension host         | `cdn.web-ide.gitlab-static.net`     | `gitlab_web_ide_extension_host_domain`  |
| Web IDE single-origin fallback | **off**                             | `gitlab_web_ide_single_origin_fallback` |
| Object store / registry S3     | AIStor on **docker-01** `.21:9000` (lab-home-k8s) | Omnibus `object_store` |
| Runner mint (`glrt-…`)         | `CreateRunnerService` → token files | `mint_runners.rb.j2` (no Admin UI)      |
| Runner tags / untagged         | from `host_vars` (`runner-01`)      | `reconcile_runners.rb.j2`               |
| Runner concurrent + S3 cache   | `host_vars` + AIStor `runner-cache` | `config.toml` on each runner            |
| Omnibus URL / registry / HTTP  | `gitlab.rb.j2`                      | Omnibus reconfigure                     |

Ansible mints instance runners on `gitlab-01` and writes tokens under
`/etc/gitlab/ansible-runner-tokens/` (mode `0770`, group `git` — mint runs as
`git` and must not `chmod` the directory). Runner hosts fetch their token over
SSH — do not create runners in the Admin UI for day-2 inventory hosts.

S3 distributed cache is applied by
`roles/gitlab_runner/files/fix_runner_cache.py` (replaces the empty
`[runners.cache]` block from `gitlab-runner register` without duplicating keys).

Secrets for S3 and root password live in Vault (`apps/gitlab/…`) after seed;
`secrets.yml` keeps Vault AppRole material + thin bootstrap keys. See
[vault.md](vault.md) and [object-storage.md](object-storage.md).
Guest IDs: [guest-vmid-map.md](guest-vmid-map.md).

## Web IDE

Browsers load VS Code assets from `*.cdn.web-ide.gitlab-static.net`. Override
the Ansible vars only if that CDN is blocked (air-gapped); then you need a
wildcard DNS + TLS path into Omnibus (see
[GitLab docs](https://docs.gitlab.com/administration/settings/web_ide/)).

## Container Registry / Package Registry

- Push images to `gregistry.nasraldin.com/<project>/…` after enabling the
  project’s Container Registry in GitLab.
- Package Registry (npm/PyPI/Maven/…) is under
  `https://gitlab.nasraldin.com` — no separate hostname.
- Dependency Proxy is available in modern CE (no extra Ansible toggle).

## Runners

| Host        | Specs               | Role                                              |
| ----------- | ------------------- | ------------------------------------------------- |
| `runner-01` | **2c / 4G** manager | `docker-autoscaler` + fleeting; untagged + tagged |

Ephemeral workers (~2c/4G) provide concurrency. See
[gitlab-runner-autoscaling.md](gitlab-runner-autoscaling.md).

## First login

1. Open `https://gitlab.nasraldin.com` (expect GitLab sign-in, not Access OTP).
2. Sign in as `root` with the password from `ansible-lab/secrets.yml`
   (`vault_gitlab_root_password`). Ansible keeps root’s password matched to that
   secret on every apply.

## HTTPS git (like gitlab.com)

1. GitLab → Preferences → Access Tokens → create a PAT with `read_repository`
   and `write_repository` (and `api` if needed).
2. Clone:

```bash
git clone https://gitlab.nasraldin.com/<group>/<project>.git
# Username: your GitLab username (or root)
# Password: the PAT (not your account password)
```

3. Optional credential helper:

```bash
git config --global credential.helper osxkeychain   # macOS
```

## Create a runner authentication token

Preferred: re-run `playbooks/gitlab.yml` — mint + register is automated for
inventory runners. Manual Admin UI mint is only for one-off experiments.

If you must mint by hand:

1. Admin → CI/CD → Runners → New instance runner.
2. Tags / untagged in the UI are optional (Ansible reconciles from inventory).
3. Executor: Docker; default image `alpine:latest`.
4. Prefer letting Ansible mint; otherwise put `glrt-…` in
   `ansible-lab/secrets.yml` under `vault_gitlab_runner_tokens.<hostname>`.
5. Re-run:

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
```

Fleeting autoscaler on `runner-01` is **core** —
[gitlab-runner-autoscaling.md](gitlab-runner-autoscaling.md).

## Hello-world CI proof

In any project, `.gitlab-ci.yml` (no tags → `runner-01`):

```yaml
hello:
  image: alpine:latest
  script:
    - echo "hello from runner-01"
```

Pipeline should run on `runner-01` and succeed.

## Infra pipelines (Terraform + Ansible)

Targeted create/update/destroy (e.g. only `infra01`) uses pipeline variables —
not a filtered `vms` map. Full contract, env vars, and rollout checklist:
[gitlab-infra-pipeline.md](gitlab-infra-pipeline.md).

## Re-apply Ansible

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
# Expect mostly changed=0 on a healthy stack
```

## Fresh-install failures (debug → fix)

Full write-ups live in [lab-refresh-issues.md](lab-refresh-issues.md):

| ID      | Symptom                                                     | Tracker                                                                                         |
| ------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| REF-014 | `gitlab-ce` half-configured / LE ACME / “public attributes” | [REF-014 details](lab-refresh-issues.md#ref-014-gitlab-omnibus-lets-encrypt-half-configured)    |
| REF-015 | `vault-seal` → Enable file audit device (`no_log`)          | [REF-015 details](lab-refresh-issues.md#ref-015-vault-file-audit-pipefail-sigpipe)              |
| REF-016 | Runner register fails; public HTTPS 530                     | [REF-016 details](lab-refresh-issues.md#ref-016-gitlab-runner-register-via-public-url-530)      |
| REF-018 | LAN GitLab 200, public `gitlab.nasraldin.com` 530           | [REF-018 details](lab-refresh-issues.md#ref-018-gitlab-public-url-cloudflare-530-after-rebuild) |

Quick triage: if LAN `:80` works and public does not → Tunnel ([REF-018](lab-refresh-issues.md#ref-018-gitlab-public-url-cloudflare-530-after-rebuild)), not Omnibus.

## Prometheus metrics (scraped by `monitoring-01`)

Ansible enables Omnibus exporters (bundled Prometheus stays **off**):

| Endpoint          | Port    | Notes                                               |
| ----------------- | ------- | --------------------------------------------------- |
| `gitlab-exporter` | `:9168` | `gitlab_exporter['listen_address'] = '0.0.0.0'`     |
| Gitaly            | `:9236` | `gitaly['configuration']['prometheus_listen_addr']` |
| Workhorse         | `:9229` |                                                     |
| Registry debug    | `:5001` | `registry['debug_addr']`                            |
| Sidekiq           | `:8082` |                                                     |
| Runner            | `:9252` | `listen_address` in `config.toml` on `runner-01`    |

UFW allows those ports from `lab_cidr`. Dashboards: Grafana → **GitLab** folder
([monitoring.md](monitoring.md)).

## Health checks

```bash
ssh nasr@192.168.68.14 'sudo gitlab-ctl status'
ssh nasr@192.168.68.15 'sudo gitlab-runner status; docker info >/dev/null && echo docker-ok'
# Prefer LAN until Tunnel is re-applied after a rebuild
curl -fsS -o /dev/null -w 'lan:%{http_code}\n' http://192.168.68.14/users/sign_in
curl -fsS -o /dev/null -w 'public:%{http_code}\n' https://gitlab.nasraldin.com/users/sign_in
# Metrics (from monitoring CIDR / localhost)
curl -fsS -o /dev/null -w 'gitlab-exporter:%{http_code}\n' http://192.168.68.14:9168/metrics
curl -fsS -o /dev/null -w 'runner:%{http_code}\n' http://192.168.68.15:9252/metrics
```

Expect LAN `200`. Public `200`/`302` only after Cloudflare Tunnel bootstrap (not Access).
