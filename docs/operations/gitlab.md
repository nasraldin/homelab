# GitLab Omnibus Operations

Day-2 notes for `gitlab-01` / runners after Terraform + Ansible. Design:
[2026-07-23-gitlab-omnibus-design.md](../superpowers/specs/2026-07-23-gitlab-omnibus-design.md).

**Rule:** day-2 GitLab behaviour that must survive destroy/reapply belongs in
`ansible-lab` (`gitlab_omnibus` / `gitlab_runner`), not one-off `gitlab-rails`
or UI clicks.

## Addresses

| Guest | VMID | LAN | Public |
| ----- | ---- | --- | ------ |
| `gitlab-01` | 113 | `192.168.68.14` | `https://gitlab.nasraldin.com` |
| Container Registry | (same VM) | `:5050` | `https://gregistry.nasraldin.com` |
| `runner-01` | 114 | `192.168.68.15` | — (talks to GitLab over HTTPS) |
| `runner-02` | 115 | `192.168.68.16` | — |

`registry.nasraldin.com` is reserved for a later registry (e.g. Harbor). Package
Registry lives under the main GitLab URL (no separate hostname).

No Cloudflare Access on GitLab/gregistry — GitLab login + HTTPS git with a
Personal Access Token.

## What Ansible enforces (DB / runners)

`playbooks/gitlab.yml` ends with a reconcile on `gitlab-01` so registration
order cannot leave wrong tags:

| Concern | Enforced value | Where |
| ------- | -------------- | ----- |
| Root password | `vault_gitlab_root_password` | `application_settings.rb.j2` |
| Open signup | **off** | `gitlab_signup_enabled: false` |
| Web IDE extension host | `cdn.web-ide.gitlab-static.net` | `gitlab_web_ide_extension_host_domain` |
| Web IDE single-origin fallback | **off** | `gitlab_web_ide_single_origin_fallback` |
| Runner tags / untagged | from `host_vars` (`runner-01`, `runner-02`) | `reconcile_runners.rb.j2` |
| Runner concurrent | `host_vars` | `config.toml` on each runner |
| Omnibus URL / registry / HTTP | `gitlab.rb.j2` | Omnibus reconfigure |

`glrt-…` tokens still come from Admin → Runners (GitLab does not mint those in
Omnibus config). After register, Ansible **overwrites** tag list and
`run_untagged` to match inventory.

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

| Host | Specs | Concurrent | Tag | Untagged jobs |
| ---- | ----- | ---------- | --- | ------------- |
| `runner-01` | 4 vCPU / 4 GiB | **4** | `runner-01` | **yes** (default pool) |
| `runner-02` | 16 vCPU / 32 GiB / 150 GiB | **40** | `runner-02` | no (tag-only) |

Jobs with no `tags:` run on `runner-01`. Pin heavy/monorepo work to `runner-02`:

```yaml
tags:
  - runner-02
```

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

1. Admin → CI/CD → Runners → New instance runner.
2. Tags / untagged in the UI are optional (Ansible reconciles from inventory).
3. Executor: Docker; default image `alpine:latest`.
4. Copy the authentication token (`glrt-…`) into
   `ansible-lab/secrets.yml` under `vault_gitlab_runner_tokens.<hostname>`.
5. Re-run the full playbook (or `--limit` the runner host, then `gitlab-01` for
   reconcile):

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
```

## Hello-world CI proof

In any project, `.gitlab-ci.yml` (no tags → `runner-01`):

```yaml
hello:
  image: alpine:latest
  script:
    - echo "hello from runner-01"
```

Pipeline should run on `runner-01` and succeed.

## Re-apply Ansible

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
# Expect mostly changed=0 on a healthy stack
```

## Health checks

```bash
ssh nasr@192.168.68.14 'sudo gitlab-ctl status'
ssh nasr@192.168.68.15 'sudo gitlab-runner status; docker info >/dev/null && echo docker-ok'
curl -fsS -o /dev/null -w '%{http_code}\n' https://gitlab.nasraldin.com/users/sign_in
```

Expect HTTP 200 (or 302) for sign-in — not a Cloudflare Access challenge page.
