# Administer the Lab Remotely Through Infra01

`infra01` is the hardened Debian 13 operator workstation:

| Property        | Value                          |
| --------------- | ------------------------------ |
| VMID            | `112`                          |
| LAN address     | `192.168.68.12/22`             |
| Remote hostname | `infra.nasraldin.com`          |
| User            | `nasr`                         |
| Compute         | 4 vCPU, 8 GiB RAM, 80 GiB disk |

Terraform owns the VM. Ansible owns its packages, firewall, sudo, SSH policy,
and PVE client configuration. Cloudflare Tunnel and Access provide the
outbound-only remote path; the router has no SSH port forward.

## One-time Mac setup

```bash
cd ~/homelab/cloudflare-tunnel
./mac/install-ssh-client.sh

ssh -G infra01 | grep -E 'hostname|proxycommand|forwardagent'
ssh -G infra01-admin | grep -E 'hostname|proxycommand|forwardagent'
```

The script installs `cloudflared`, keeps managed settings in
`~/.ssh/config.d/infra01.conf`, and preserves unrelated SSH configuration.
Expected:

- Both aliases use `infra.nasraldin.com` through `cloudflared access ssh`.
- `infra01` has `ForwardAgent no`.
- `infra01-admin` has `ForwardAgent yes`.

## Connect from anywhere

Normal operator shell:

```bash
ssh infra01
```

The first connection opens Cloudflare Access in a browser. Enter the email OTP,
then OpenSSH performs its normal public-key authentication.

Use the admin alias only when commands inside the VM need a key held by the
Mac:

```bash
ssh-add --apple-use-keychain ~/.ssh/pve01
ssh infra01-admin
ssh pve01 'hostname -f; pveversion; qm list'
```

Disconnect the agent-forwarded session after privileged work. A privileged
process on `infra01` can request signatures from the forwarded agent only while
that session exists.

## Common PVE operations

```bash
# Inventory and health
ssh infra01-admin 'ssh pve01 "pveversion; qm list; zpool status"'

# Start, stop, or inspect a VM
ssh infra01-admin 'ssh pve01 "qm status 112"'
ssh infra01-admin 'ssh pve01 "qm start 112"'
ssh infra01-admin 'ssh pve01 "qm shutdown 112"'

# Package/update check only
ssh infra01-admin 'ssh pve01 "/usr/local/bin/pve-check-updates --check"'
```

Run hypervisor upgrades manually and follow the
[safe upgrade runbook](proxmox-updates.md). Do not use `apt full-upgrade`
without its preflight and guest-impact checks.

## Toolchain

The Ansible role installs:

- Terraform and Ansible
- kubectl and Helm
- GitHub CLI, Git, Docker/Compose, Python, and build tools
- jq, yq, ripgrep, rsync, tmux, ShellCheck, yamllint
- DNS, route, packet, transfer, and backup diagnostics

Verify:

```bash
ssh infra01 '
  sudo -n true &&
  terraform version &&
  ansible --version &&
  kubectl version --client &&
  helm version --short &&
  docker compose version
'
```

## Repositories and credentials

No private key or API token is stored on `infra01`. To clone private GitHub
repositories, load the GitHub key on the Mac and use the explicit
agent-forwarded alias:

```bash
ssh-add --apple-use-keychain ~/.ssh/github
ssh infra01-admin
ssh -o StrictHostKeyChecking=accept-new -T git@github.com
git clone git@github.com:nasraldin/homelab.git ~/homelab
```

Supply short-lived or session-only API credentials from the password manager
when a tool needs them. Do not copy the Mac's ignored secret files to
`infra01`.

## LAN and recovery paths

If Cloudflare Access is unavailable while on the home network:

```bash
ssh nasr@192.168.68.12
```

If `infra01` is unavailable, LAN SSH to `pve01` and the existing
`https://homelab.nasraldin.com` Proxmox UI remain independent recovery paths.

Rebuild order:

1. Apply `terraform-lab` and verify VMID 112.
2. Run `ansible-lab/playbooks/infra.yml` twice.
3. Export a Cloudflare API token and run
   `cloudflare-tunnel/mac/bootstrap.sh --yes`.
4. Run `cloudflare-tunnel/mac/install-ssh-client.sh`.
5. Complete one off-LAN `ssh infra01` Access login.
