# Infra01 remote management and IPv6 DNS completion

Date: 2026-07-21  
Status: approved for autonomous implementation

## Goal

Provide a hardened Debian 13 operator VM that Nasr can reach securely from the
MacBook anywhere, then use it to administer `pve01` and the rest of the lab
without opening inbound router ports or storing a private SSH key on the VM.
Complete the AdGuard cutover so IPv6 DNS cannot silently bypass filtering.

## Decisions

### Remote access

Extend the existing remotely managed Cloudflare Tunnel instead of introducing
Tailscale, WireGuard, or a WAN port forward.

- Public Access hostname: `infra.nasraldin.com`
- Tunnel origin: `ssh://192.168.68.12:22`
- Authentication: existing Cloudflare Access email allowlist, followed by the
  existing SSH public key
- Client: `cloudflared access ssh` as an OpenSSH `ProxyCommand`
- Connector: the existing `cloudflared` service on `pve01`

This reuses an operating outbound-only control plane and requires no router
change. Tailscale or Cloudflare One Client private routing can be revisited when
full subnet access is needed; they add device enrollment that cannot be
completed unattended today. Direct WireGuard or SSH exposure is rejected
because it requires router changes and creates a larger Internet-facing attack
surface.

### Operator VM

Terraform creates:

| Property | Value                                   |
| -------- | --------------------------------------- |
| Name     | `infra01`                               |
| VMID     | `112`                                   |
| Address  | `192.168.68.12/22`                      |
| Image    | Debian 13                               |
| Compute  | 4 vCPU, 8 GiB RAM                       |
| Disk     | 80 GiB on `data01`                      |
| Tags     | `infra`, `core`, `debian`, `management` |

Ansible owns the operating system after SSH becomes reachable. It applies the
common guest baseline, a dedicated operator role, SSH hardening, passwordless
sudo for `nasr`, and a reproducible management toolchain:

- Git, GitHub CLI, curl, jq, yq, rsync, ripgrep, fzf, tmux, Vim
- Terraform, Ansible, ansible-lint, yamllint, ShellCheck
- kubectl and Helm for the planned Kubernetes phase
- Docker CLI/Compose, Python tooling, build tools, and network diagnostics

Password authentication and root SSH login remain disabled. No private key,
Cloudflare token, Proxmox API token, or repository secret is copied to
`infra01`.

### Privileged lab administration

Two access patterns are documented:

1. `ssh infra01` reaches the operator shell without forwarding credentials.
2. `ssh -A infra01` is the explicit trusted-session mode. The forwarded Mac
   agent can then authenticate to `pve01` and GitHub without leaving key
   material on disk.

The VM receives an `/etc/hosts` entry for `pve01.lab.nasraldin.com` so management
still works during DNS troubleshooting. `nasr` has passwordless sudo on
`infra01`; existing key-based root access controls privileges on `pve01`.

Agent forwarding is intentionally opt-in because a privileged process on
`infra01` could use the forwarded agent while the session is active. The
runbook tells the operator to disconnect after privileged work.

## IPv6 DNS design

Current evidence shows clients receive ISP resolvers `2a00:f28:2::2` and
`2a00:f28:2::20` through router advertisements. AdGuard listens on IPv6, but
UFW only permits DNS from `192.168.68.0/22`.

Automation will:

1. Assign AdGuard an explicit locally administered MAC so its EUI-64 link-local
   IPv6 address remains stable across VM replacement.
2. Permit TCP and UDP port 53 from `fe80::/10` only.
3. Verify filtering through AdGuard's IPv6 address.
4. Document and test the client resolver list after the TP-Link change.

The preferred TP-Link IPv6 DNS/RDNSS value is AdGuard's stable link-local
address. Link-local RDNSS is standards-compliant and does not depend on the
ISP's changing delegated prefix. If the TP-Link firmware rejects a link-local
DNS server, disable its IPv6 DNS advertisement. If it cannot separate DNS
advertisement from IPv6 service, temporarily disable LAN IPv6; advertising a
public secondary resolver is not acceptable because clients may bypass
AdGuard.

Changing the router requires the owner TP-Link ID password. Automation must not
guess, extract, or store that credential. Everything before and after the
authenticated router setting is automated, and the runbook records the exact
remaining click path if no authenticated session is available.

## Data and control flow

```text
MacBook OpenSSH
  -> cloudflared Access login
  -> Cloudflare Tunnel (outbound connector on pve01)
  -> infra01:22
  -> Debian operator shell
  -> SSH agent forwarding on explicit sessions
  -> pve01 / GitHub
```

```text
LAN client
  -> TP-Link RDNSS advertises AdGuard link-local IPv6
  -> AdGuard filtering
  -> Technitium for lab.nasraldin.com
  -> public upstream for other names
```

## Failure behavior

- Cloudflare Access denial stops the connection before SSH.
- SSH still requires the authorized key after Access succeeds.
- If `infra01` is unavailable, the Proxmox UI remains available through its
  existing hostname and LAN SSH remains unchanged.
- Tunnel configuration always retains the Proxmox ingress and terminal 404
  rule when adding SSH.
- Ansible package or repository failures stop the playbook without weakening
  SSH or firewall policy.
- Terraform is applied from a saved plan and must not replace existing DNS VMs.
- Router authentication failure is reported as a bounded manual action, not
  worked around by exposing DNS or management ports.

## Verification

Completion requires:

- Terraform plan contains only the intended VM/network updates and applies
  successfully.
- `infra01` boots, survives an Ansible second run with `changed=0`, and reports
  all required tool versions.
- LAN SSH to `infra01` works; password and root SSH authentication do not.
- `infra01` can resolve and reach `pve01`.
- The Cloudflare Access hostname returns an Access challenge and the tunnel
  configuration contains both UI and SSH ingress entries.
- The Mac has `cloudflared` and a documented SSH configuration.
- IPv4 and IPv6 queries sent directly to AdGuard block a known advertising
  domain.
- Final `scutil --dns` contains only AdGuard. If router authentication is
  unavailable, this last assertion remains explicitly blocked with the exact
  TP-Link action documented.
- Formatting, lint, Terraform validation, Ansible syntax checks, shell tests,
  documentation build, and repository status checks pass before push.
