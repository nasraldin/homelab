# GitLab Omnibus Operations

Day-2 notes for `gitlab-01` / `runner-01` after Terraform + Ansible. Design:
[2026-07-23-gitlab-omnibus-design.md](../superpowers/specs/2026-07-23-gitlab-omnibus-design.md).

## Addresses

| Guest | VMID | LAN | Public |
| ----- | ---- | --- | ------ |
| `gitlab-01` | 113 | `192.168.68.14` | `https://gitlab.nasraldin.com` |
| Container Registry | (same VM) | `:5050` | `https://gregistry.nasraldin.com` |
| `runner-01` | 114 | `192.168.68.15` | — (talks to GitLab over HTTPS) |

`registry.nasraldin.com` is reserved for a later registry (e.g. Harbor). Package
Registry lives under the main GitLab URL (no extra hostname).

No Cloudflare Access on GitLab/gregistry — GitLab login + HTTPS git with a
Personal Access Token.

## Container Registry / Package Registry

- Push images to `gregistry.nasraldin.com/<project>/…` after enabling the
  project’s Container Registry in GitLab.
- Package Registry (npm/PyPI/Maven/…) is under
  `https://gitlab.nasraldin.com` — no separate hostname.
- Dependency Proxy is enabled at the instance level (Admin).

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
   (`vault_gitlab_root_password`).
3. Change the root password in the UI if you prefer a different one than the
   vault value (keep Ansible secret in sync if you do).

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
2. Tags: inventory hostname (`runner-01` or `runner-02`).
3. For `runner-01`, enable **Run untagged jobs**; leave it off for `runner-02`.
4. Executor: Docker; default image `alpine:latest`.
5. Copy the authentication token (`glrt-…`) into
   `ansible-lab/secrets.yml` under `vault_gitlab_runner_tokens`.
6. Re-run:

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/gitlab.yml -e @secrets.yml --limit runner-01
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
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
```

## Health checks

```bash
ssh nasr@192.168.68.14 'sudo gitlab-ctl status'
ssh nasr@192.168.68.15 'sudo gitlab-runner status; docker info >/dev/null && echo docker-ok'
curl -fsS -o /dev/null -w '%{http_code}\n' https://gitlab.nasraldin.com/users/sign_in
```

Expect HTTP 200 (or 302) for sign-in — not a Cloudflare Access challenge page.
