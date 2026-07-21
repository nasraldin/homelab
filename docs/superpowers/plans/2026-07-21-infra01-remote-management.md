# Infra01 Remote Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision a hardened Debian 13 operator VM and expose its SSH service through the existing Cloudflare Tunnel and Access policy for secure administration from the MacBook anywhere.

**Architecture:** Terraform creates `infra01`; Ansible installs and hardens the operator toolchain. The existing outbound `cloudflared` connector on `pve01` gains a second ingress rule for SSH. OpenSSH uses a client-side `cloudflared access ssh` proxy, and SSH agent forwarding is opt-in so no private key is stored on `infra01`.

**Tech Stack:** Terraform, Proxmox VE, Debian 13, Ansible, OpenSSH, Cloudflare Tunnel and Access, Bash, ShellCheck

## Global Constraints

- Use `infra01`, VMID `112`, and `192.168.68.12/22`.
- Use 4 vCPU, 8 GiB RAM, and an 80 GiB disk on `data01`.
- Do not expose port 22 through router NAT.
- Do not copy private keys, Cloudflare tokens, GitHub tokens, or Proxmox API credentials to the VM.
- Keep existing `homelab.nasraldin.com` Proxmox ingress working.
- Require both Cloudflare Access and the existing SSH public key.
- Disable password authentication and root SSH login.
- Apply Terraform from a reviewed saved plan.
- A second Ansible run must report `changed=0`.

---

### Task 1: Provision infra01 with Terraform

**Files:**

- Modify: `terraform-lab/terraform.tfvars`
- Modify: `terraform-lab/README.md`

**Interfaces:**

- Consumes: existing `debian-13` image and generic `modules/vm`
- Produces: `infra01` at `192.168.68.12`, VMID `112`

- [ ] **Step 1: Add the VM declaration**

Add to `vms`:

```hcl
infra01 = {
  image   = "debian-13"
  tags    = ["infra", "core", "debian", "management"]
  vm_id   = 112
  cores   = 4
  memory  = 8192
  disk_gb = 80
  ip      = "192.168.68.12/22"
}
```

- [ ] **Step 2: Document ownership**

Add `infra01` to the VM inventory table and state that Terraform owns compute,
disk, and networking while Ansible owns its operating system and tools.

- [ ] **Step 3: Validate and review**

```bash
cd ~/homelab/terraform-lab
terraform fmt -recursive
terraform validate
terraform plan -out=tfplan
terraform show tfplan
```

Expected: one VM create for VMID 112 and no replacement or deletion.

- [ ] **Step 4: Commit**

```bash
git add terraform.tfvars README.md
git commit -m "Provision infra01 operator VM."
```

### Task 2: Add the infra operator Ansible role

**Files:**

- Modify: `ansible-lab/inventory/hosts.yml`
- Create: `ansible-lab/inventory/host_vars/infra01.yml`
- Create: `ansible-lab/playbooks/infra.yml`
- Create: `ansible-lab/roles/infra_operator/defaults/main.yml`
- Create: `ansible-lab/roles/infra_operator/tasks/main.yml`
- Create: `ansible-lab/roles/infra_operator/templates/infra01-ssh-config.j2`
- Create: `ansible-lab/docs/infra01.md`
- Modify: `ansible-lab/README.md`

**Interfaces:**

- Consumes: `guest_common`, Debian 13, user `nasr`
- Produces: hardened operator host with management CLI tools

- [ ] **Step 1: Add the inventory group**

Add:

```yaml
infrastructure:
  hosts:
    infra01:
      ansible_host: 192.168.68.12
      guest_hostname: infra01
  vars:
    ansible_user: nasr
    ansible_python_interpreter: /usr/bin/python3
```

- [ ] **Step 2: Add host firewall variables**

Create:

```yaml
---
guest_extra_ufw_rules: []
```

SSH remains restricted to `192.168.68.0/22`, which includes the connector on
`pve01`.

- [ ] **Step 3: Define the toolchain**

Create defaults:

```yaml
---
infra_operator_user: nasr
infra_operator_packages:
  - ansible
  - ansible-lint
  - bash-completion
  - build-essential
  - ca-certificates
  - curl
  - dnsutils
  - docker.io
  - docker-compose
  - fd-find
  - fzf
  - gh
  - git
  - gnupg
  - htop
  - iperf3
  - jq
  - make
  - mtr-tiny
  - netcat-openbsd
  - nmap
  - pipx
  - python3-pip
  - python3-proxmoxer
  - python3-venv
  - restic
  - ripgrep
  - rsync
  - shellcheck
  - tmux
  - traceroute
  - tree
  - unzip
  - vim
  - yamllint
  - yq
infra_terraform_key_url: https://apt.releases.hashicorp.com/gpg
infra_terraform_repository: >-
  deb [signed-by=/etc/apt/keyrings/hashicorp.gpg]
  https://apt.releases.hashicorp.com trixie main
infra_kubernetes_minor: v1.36
infra_helm_version: v3.18.4
```

- [ ] **Step 4: Implement package repositories and installation**

The role must:

1. Create `/etc/apt/keyrings`.
2. Download/dearmor the HashiCorp signing key.
3. add the HashiCorp repository.
4. Add `pkgs.k8s.io/core:/stable:/v1.36/deb/`.
5. Install `infra_operator_packages`, `terraform`, and `kubectl`.
6. Download Helm `v3.18.4` plus its `.sha256sum`, verify it, and copy
   `linux-amd64/helm` to `/usr/local/bin/helm`.
7. Add `nasr` to the `docker` group without starting containers.

Every `apt`, `get_url`, `unarchive`, `copy`, and `user` operation must use an
idempotent Ansible module; all promise-returning operations are awaited by
Ansible automatically.

- [ ] **Step 5: Harden SSH and sudo**

Create `/etc/ssh/sshd_config.d/20-infra01-hardening.conf`:

```text
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AllowAgentForwarding yes
AllowTcpForwarding yes
X11Forwarding no
```

After writing the drop-in, validate the complete effective configuration before
notifying the reload handler:

```yaml
- name: Validate OpenSSH configuration
  ansible.builtin.command:
    cmd: /usr/sbin/sshd -t
  changed_when: false
```

Create `/etc/sudoers.d/90-infra-operator`:

```text
nasr ALL=(ALL:ALL) NOPASSWD: ALL
```

with:

```yaml
validate: '/usr/sbin/visudo -cf %s'
mode: '0440'
```

- [ ] **Step 6: Add resilient PVE name resolution**

Add:

```text
192.168.68.13 pve01.lab.nasraldin.com pve01
```

using `lineinfile`. Install `/home/nasr/.ssh/config` from the template:

```text
Host pve01
  HostName pve01.lab.nasraldin.com
  User root
  ForwardAgent no
  StrictHostKeyChecking accept-new
```

- [ ] **Step 7: Create the playbook**

```yaml
---
- name: Configure infra01 operator workstation
  hosts: infra01
  gather_facts: true
  roles:
    - role: guest_common
    - role: infra_operator
```

- [ ] **Step 8: Validate**

```bash
cd ~/homelab/ansible-lab
ansible-inventory --graph
ansible-playbook playbooks/infra.yml --syntax-check
yamllint inventory roles playbooks
```

Expected: all commands exit zero and inventory lists `infra01`.

- [ ] **Step 9: Commit**

```bash
git add inventory playbooks/infra.yml roles/infra_operator README.md docs/infra01.md
git commit -m "Configure hardened infra01 operator toolchain."
```

### Task 3: Apply Terraform and Ansible

**Files:**

- Runtime changes only

**Interfaces:**

- Consumes: reviewed Terraform plan and `playbooks/infra.yml`
- Produces: live, configured `infra01`

- [ ] **Step 1: Apply the saved plan**

```bash
cd ~/homelab/terraform-lab
terraform apply tfplan
rm -f tfplan
```

Expected: VMID 112 is created and started.

- [ ] **Step 2: Wait for cloud-init and SSH**

```bash
until ssh -o BatchMode=yes -o ConnectTimeout=5 nasr@192.168.68.12 \
  'cloud-init status --wait'; do sleep 5; done
```

- [ ] **Step 3: Apply twice**

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/infra.yml
ansible-playbook playbooks/infra.yml
```

Expected: second recap is `changed=0 failed=0`.

- [ ] **Step 4: Verify security and tools**

```bash
ssh nasr@192.168.68.12 '
  sudo -n true &&
  terraform version &&
  ansible --version &&
  kubectl version --client &&
  helm version --short &&
  gh --version &&
  docker --version &&
  ssh -G pve01 >/dev/null
'
```

Expected: exit zero with version output for every tool.

### Task 4: Extend Cloudflare Tunnel for SSH

**Files:**

- Modify: `cloudflare-tunnel/config.env.example`
- Modify: `cloudflare-tunnel/lib/cloudflare_api.sh`
- Modify: `cloudflare-tunnel/mac/bootstrap.sh`
- Create: `cloudflare-tunnel/tests/test_ingress.sh`
- Modify: `cloudflare-tunnel/docs/02-runbook.md`
- Modify: `cloudflare-tunnel/README.md`

**Interfaces:**

- Consumes: `SSH_HOSTNAME`, `SSH_ORIGIN`, existing tunnel ID and Access allowlist
- Produces: two-host ingress JSON, DNS CNAME, and Access application for SSH

- [ ] **Step 1: Write a failing ingress test**

Create:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../lib/cloudflare_api.sh
source "$ROOT/lib/cloudflare_api.sh"

json="$(cf_build_ingress_config \
  "homelab.nasraldin.com" "https://127.0.0.1:8006" \
  "infra.nasraldin.com" "ssh://192.168.68.12:22")"

jq -e '.config.ingress | length == 3' <<<"$json" >/dev/null
jq -e '.config.ingress[0].hostname == "homelab.nasraldin.com"' <<<"$json" >/dev/null
jq -e '.config.ingress[1].hostname == "infra.nasraldin.com"' <<<"$json" >/dev/null
jq -e '.config.ingress[1].service == "ssh://192.168.68.12:22"' <<<"$json" >/dev/null
jq -e '.config.ingress[2].service == "http_status:404"' <<<"$json" >/dev/null
```

- [ ] **Step 2: Confirm the test fails**

```bash
bash tests/test_ingress.sh
```

Expected: non-zero because the helper accepts only two arguments.

- [ ] **Step 3: Implement multi-service ingress**

Change the helper signature to:

```bash
cf_build_ingress_config UI_HOST UI_ORIGIN SSH_HOST SSH_ORIGIN
```

Generate:

```json
{
  "config": {
    "ingress": [
      {
        "hostname": "homelab.nasraldin.com",
        "service": "https://127.0.0.1:8006",
        "originRequest": { "noTLSVerify": true }
      },
      {
        "hostname": "infra.nasraldin.com",
        "service": "ssh://192.168.68.12:22"
      },
      { "service": "http_status:404" }
    ]
  }
}
```

Update `cf_tunnel_put_config` to accept and pass all four service arguments.

- [ ] **Step 4: Add configuration defaults**

```bash
SSH_HOSTNAME=infra.nasraldin.com
SSH_ORIGIN=ssh://192.168.68.12:22
SSH_ACCESS_APP_NAME=Infra01 SSH
```

- [ ] **Step 5: Ensure both DNS and Access resources**

Refactor the existing single-host logic into functions accepting hostname and
application name, then call each for the UI and SSH host. Both CNAMEs point to
the same `<tunnel-id>.cfargotunnel.com`; both Access policies use
`ACCESS_EMAILS`.

- [ ] **Step 6: Add SSH smoke verification**

```bash
headers="$(curl -sI --max-time 20 "https://${SSH_HOSTNAME}" || true)"
```

Accept a Cloudflare Access redirect or denial as proof that DNS, Tunnel, and
Access are active. Do not expect an SSH banner through an HTTP request.

- [ ] **Step 7: Pass tests**

```bash
bash tests/test_ingress.sh
bash -n mac/bootstrap.sh lib/*.sh pve/*.sh tests/*.sh
shellcheck -S warning mac/bootstrap.sh lib/*.sh pve/*.sh tests/*.sh
```

Expected: all commands exit zero.

- [ ] **Step 8: Commit**

```bash
git add config.env.example lib/cloudflare_api.sh mac/bootstrap.sh tests/test_ingress.sh docs/02-runbook.md README.md
git commit -m "Expose infra01 SSH through Cloudflare Access."
```

### Task 5: Apply Cloudflare and configure the Mac client

**Files:**

- Create: `cloudflare-tunnel/mac/install-ssh-client.sh`
- Modify: `docs/operations/deploy-and-rebuild.md`
- Create: `docs/operations/infra01-remote-access.md`
- Modify: `docs/.vitepress/config.mts`
- Modify: `docs/current-state.md`

**Interfaces:**

- Consumes: Cloudflare API configuration and Mac Homebrew
- Produces: `infra01` and `infra01-admin` SSH aliases

- [ ] **Step 1: Implement an idempotent Mac installer**

The script must:

1. Install `cloudflared` with Homebrew when missing.
2. Create `~/.ssh/config.d`.
3. Write `~/.ssh/config.d/infra01.conf` with mode `0600`.
4. Ensure `Include ~/.ssh/config.d/*` exists once in `~/.ssh/config`.
5. Preserve all unrelated SSH configuration.

Managed content:

```text
Host infra01 infra01-admin
  HostName infra.nasraldin.com
  User nasr
  ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h
  IdentityFile ~/.ssh/pve01
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3

Host infra01
  ForwardAgent no

Host infra01-admin
  ForwardAgent yes
```

- [ ] **Step 2: Test script syntax and idempotence**

```bash
bash -n mac/install-ssh-client.sh
shellcheck -S warning mac/install-ssh-client.sh
./mac/install-ssh-client.sh
./mac/install-ssh-client.sh
ssh -G infra01 | grep -E 'hostname|proxycommand|forwardagent'
ssh -G infra01-admin | grep -E 'hostname|proxycommand|forwardagent'
```

Expected: the second run changes nothing; only `infra01-admin` forwards the
agent.

- [ ] **Step 3: Apply Cloudflare configuration**

```bash
cd ~/homelab/cloudflare-tunnel
./mac/bootstrap.sh --check
./mac/bootstrap.sh --yes
./mac/bootstrap.sh --check
```

Expected: the final report has `fail: 0`, both Access apps and CNAMEs exist, and
the existing Proxmox URL still reaches Access.

- [ ] **Step 4: Verify SSH through Access**

```bash
ssh infra01 'hostname; sudo -n true'
ssh infra01-admin 'ssh pve01 "hostname -f; pveversion"'
```

Expected: `infra01`, successful sudo, then
`pve01.lab.nasraldin.com` and a Proxmox version.

- [ ] **Step 5: Document normal and recovery operation**

The runbook must cover:

- `ssh infra01` for normal work.
- `ssh infra01-admin` only when agent forwarding is required.
- `ssh infra01-admin 'ssh pve01 ...'` for PVE operations.
- Cloudflare Access session renewal.
- LAN fallback `ssh nasr@192.168.68.12`.
- No private keys or API credentials on `infra01`.

- [ ] **Step 6: Commit**

```bash
git add mac/install-ssh-client.sh
git commit -m "Add idempotent infra01 Mac SSH client setup."

cd ~/homelab
git add docs
git commit -m "Document infra01 remote administration workflow."
```

### Task 6: Final acceptance and push

**Files:**

- All repositories changed by Tasks 1-5

**Interfaces:**

- Consumes: completed implementation
- Produces: clean, pushed repositories and evidence-backed status

- [ ] **Step 1: Run workspace checks**

```bash
cd ~/homelab
make lint
npm run docs:build

cd terraform-lab
terraform validate
terraform plan -detailed-exitcode

cd ../ansible-lab
ansible-playbook playbooks/infra.yml --syntax-check
ansible-playbook playbooks/infra.yml

cd ../cloudflare-tunnel
bash tests/test_ingress.sh
shellcheck -S warning mac/*.sh lib/*.sh pve/*.sh tests/*.sh
```

Expected: all static checks pass, Terraform reports no changes, and Ansible
reports `changed=0`.

- [ ] **Step 2: Run live acceptance**

```bash
ssh infra01 'hostname; sudo -n true; terraform version; ansible --version'
ssh infra01-admin 'ssh pve01 "hostname -f; qm list"'
curl -sI https://homelab.nasraldin.com | grep -iE 'cloudflare|location'
curl -sI https://infra.nasraldin.com | grep -iE 'cloudflare|location'
```

Expected: both SSH checks succeed and both public hostnames reach Cloudflare
Access without exposing an origin directly.

- [ ] **Step 3: Push every logical commit**

```bash
git -C ~/homelab/terraform-lab push origin main
git -C ~/homelab/ansible-lab push origin main
git -C ~/homelab/cloudflare-tunnel push origin main
git -C ~/homelab push origin main
```

- [ ] **Step 4: Verify clean synchronized branches**

```bash
for repo in ~/homelab ~/homelab/terraform-lab ~/homelab/ansible-lab ~/homelab/cloudflare-tunnel; do
  git -C "$repo" status -sb
done
```

Expected: every active branch exactly matches `origin/main`.
