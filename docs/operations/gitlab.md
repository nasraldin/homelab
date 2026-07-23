# GitLab Omnibus Operations

Day-2 notes for `gitlab-01` / `runner-01` after Terraform + Ansible. Design:
[2026-07-23-gitlab-omnibus-design.md](../superpowers/specs/2026-07-23-gitlab-omnibus-design.md).

## Addresses

| Guest | VMID | LAN | Public |
| ----- | ---- | --- | ------ |
| `gitlab-01` | 113 | `192.168.68.14` | `https://gitlab.nasraldin.com` |
| `runner-01` | 114 | `192.168.68.15` | — (talks to GitLab over HTTPS) |

No Cloudflare Access on `gitlab.nasraldin.com` — GitLab login + HTTPS git with
a Personal Access Token.

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
2. Tags: `docker`, `homelab` (optional).
3. Executor: Docker; default image `alpine:latest`.
4. Copy the authentication token (`glrt-…`) into
   `ansible-lab/secrets.yml` as `vault_gitlab_runner_token`.
5. Re-run:

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/gitlab.yml -e @secrets.yml --limit runner-01
```

## Hello-world CI proof

In any project, `.gitlab-ci.yml`:

```yaml
hello:
  image: alpine:latest
  tags:
    - docker
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
