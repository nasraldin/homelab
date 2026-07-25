# Administer the Lab Remotely Through Infra01

Canonical runbook for the **operator workstation** VM. Humans and agents should
read this before assuming the Mac on the LAN is the only control plane.

**Off-LAN rule:** if you are not on the home network, do **not** try to SSH
directly to `192.168.68.x`. Use `infra01` (this page) or the Proxmox UI tunnel.
There is **no** router port-forward for SSH.

Related: [remote-connectivity.md](remote-connectivity.md) (RDP / desktop tools) ·
[deploy-and-rebuild.md](deploy-and-rebuild.md) (full stack order).

---

## What it is / what it is not

| It **is** | It is **not** |
| --------- | ------------- |
| Hardened Debian 13 **jump box** + ops toolchain | DNS, GitLab, Vault, AIStor, or app hosting |
| Secure **SSH from anywhere** via Cloudflare Access | A place to store API tokens or `secrets.yml` |
| Path to administer **Proxmox** (`pve01`) with a short-lived forwarded agent | A second Mac — prefer the Mac when you are on LAN |
| Always-on host for long Terraform/Ansible jobs without leaving a laptop awake | Where Docker Compose *apps* should live long-term |

If Cloudflare Access is down and you are **on LAN**, fall back to
`ssh nasr@192.168.68.12`. If `infra01` itself is down, use LAN SSH to `pve01`
or `https://homelab.nasraldin.com` (Proxmox UI).

---

## When to use (decision table)

| Your situation | Prefer | Why |
| -------------- | ------ | --- |
| Mac on home LAN | Local `terraform` / `ansible` / `ssh` to guests and `root@192.168.68.13` | Lowest friction; no Access OTP |
| Away from home, phone hotspot, travel | `ssh infra01` then work from the VM | Outbound-only Tunnel; no WAN `:22` |
| Need Proxmox CLI off-LAN | `ssh infra01-admin` + `ssh pve01 …` | Agent-forward `~/.ssh/pve01` only for that session |
| Need private Git clone on the VM | `ssh infra01-admin` with GitHub key in agent | No durable deploy key on disk |
| Break-glass “see the console” | Proxmox UI / OpsHub noVNC | Does not replace SSH for day-2 automation |
| Coding agent with no LAN to the lab | Instruct operator to use `infra01` path; do not invent direct `192.168.68.x` SSH from the internet | Agents often assume LAN reachability |
| Brand-new laptop, never on home Wi‑Fi | [New local machine (outside the lab)](#new-local-machine-outside-the-lab) — Tunnel client + key + Access | No non-tunnel SSH path exists |

```text
On home LAN?
  yes → Mac control plane (local TF/Ansible/SSH)
  no  → cloudflared Access → ssh infra01
           → shell / tools on infra01
           → (optional) infra01-admin + agent → ssh pve01 / git
```

---

## Identity card

| Property | Value |
| -------- | ----- |
| Guest name | `infra01` |
| VMID | `112` |
| LAN | `192.168.68.12/22` |
| Remote SSH hostname | `infra.nasraldin.com` |
| OS user | `nasr` (passwordless sudo; root SSH disabled) |
| Compute | 4 vCPU / 8 GiB / 80 GiB (see `terraform-lab`) |

| Layer | Owns |
| ----- | ---- |
| **Terraform** (`terraform-lab`) | VM hardware, cloud-init, static IP |
| **Ansible** (`ansible-lab` · `playbooks/infra.yml`) | Packages, UFW, SSH policy, `/etc/hosts` pin for `pve01`, sudo |
| **Cloudflare Tunnel** | Public hostname + Access policy for SSH; **no** WAN port-forward |

Apply notes for the guest OS live in
[ansible-lab/docs/infra01.md](https://github.com/nasraldin/ansible-lab/blob/main/docs/infra01.md).

---

## New local machine (outside the lab)

Use this when you have a **new laptop** (or a reinstall) and you are **not** on
the home LAN. The only supported path is **Cloudflare Tunnel + Access** to
`infra.nasraldin.com`. There is **no** “direct SSH from the internet” and **no**
router port-forward — that is intentional.

```text
New machine (anywhere on Internet)
        ↓
  cloudflared access ssh
        ↓
  infra.nasraldin.com  (Access email OTP)
        ↓
  OpenSSH to infra01 as nasr  (your public key must already be authorized)
        ↓
  Lab LAN from inside (guests / pve01 with agent-forward)
```

### Prerequisites

| Need | Notes |
| ---- | ----- |
| macOS + Homebrew | `install-ssh-client.sh` uses `brew install cloudflared` |
| Cloudflare Access allowlist | Your email must be allowed for the SSH Access app (same family as Proxmox UI) |
| SSH private key on this machine | Default client config uses `IdentityFile ~/.ssh/pve01` — copy that key from your password manager / old Mac, or generate a new key and authorize it on `infra01` (see below) |
| Network | Any Internet path; you do **not** need VPN or home Wi‑Fi |

### Step 1 — Get the tunnel client repo (or full homelab)

From the new machine (GitHub must be reachable):

```bash
# Minimal: only the tunnel client kit
git clone git@github.com:nasraldin/cloudflare-tunnel.git ~/homelab/cloudflare-tunnel
# Or clone the umbrella and pull siblings:
# git clone git@github.com:nasraldin/homelab.git ~/homelab && cd ~/homelab && ./clone-labs.sh
```

If you do not have a GitHub SSH key on this machine yet, clone over HTTPS or
copy the `cloudflare-tunnel` folder another way — only `mac/install-ssh-client.sh`
is required for SSH into the lab.

### Step 2 — Install `cloudflared` + SSH aliases

```bash
cd ~/homelab/cloudflare-tunnel
./mac/install-ssh-client.sh

ssh -G infra01 | grep -E 'hostname|proxycommand|identityfile|forwardagent'
ssh -G infra01-admin | grep -E 'hostname|proxycommand|identityfile|forwardagent'
```

Expect `HostName infra.nasraldin.com`, `ProxyCommand … cloudflared access ssh`,
and `IdentityFile ~/.ssh/pve01`.

### Step 3 — Place your SSH key on the new machine

The managed config authenticates to `infra01` with **`~/.ssh/pve01`**.

```bash
# Preferred: restore the same key you already use for pve01 / infra01
mkdir -p ~/.ssh && chmod 700 ~/.ssh
# copy pve01 + pve01.pub from password manager / old Mac → ~/.ssh/
chmod 600 ~/.ssh/pve01
chmod 644 ~/.ssh/pve01.pub
ssh-add --apple-use-keychain ~/.ssh/pve01
```

**New key on a brand-new machine** (old key lost):

1. `ssh-keygen -t ed25519 -f ~/.ssh/pve01 -C "infra01-from-<machine>"`
2. Authorize the **public** key on `infra01` while you still have *some* admin path:
   - On LAN from another machine: `ssh nasr@192.168.68.12` and append to
     `~/.ssh/authorized_keys`, or
   - Off-LAN: Proxmox UI → `infra01` console → same append, or
   - Re-run cloud-init / Ansible with the new public key in Terraform/Ansible
     inventory (preferred long-term).
3. Until the new pubkey is on `infra01`, Tunnel + Access alone are not enough —
   Access gets you to the SSH port; OpenSSH still needs a matching key.

### Step 4 — First connection from outside

```bash
ssh infra01
```

1. Browser opens Cloudflare Access → sign in with the allowlisted email → OTP.
2. OpenSSH then uses `~/.ssh/pve01` against `infra01`.
3. You should land in a shell as `nasr` on `192.168.68.12` (inside the lab).

Prove it:

```bash
ssh infra01 'hostname; ip -4 addr show | grep 192.168.68; sudo -n true'
```

### Step 5 — Optional: PVE / Git from the new machine

Same as day-2 workflows below (`infra01-admin` + `ssh-add`). You need the
private keys on **this** machine (`~/.ssh/pve01` already; add `~/.ssh/github`
if you will clone private repos onto `infra01`).

### What you must not do from outside

| Anti-pattern | Why |
| ------------ | --- |
| `ssh nasr@192.168.68.12` from a café / hotspot | Private LAN — unreachable; not a misconfiguration |
| Open router WAN port `:22` to “make it easier” | Forbidden; use Tunnel only |
| Skip Access and “just use the IP of the tunnel” | Access is the identity gate; OTP is expected |
| Copy `secrets.yml` permanently onto the new laptop *and* onto `infra01` | Prefer password manager + short-lived session files |

### After you are inside `infra01`

You are on the lab LAN. From that shell you can reach guests by LAN IP (if your
key is authorized on them) and run tools installed by Ansible. For Proxmox host
CLI, use a **new** `infra01-admin` session from the Mac with agent-forward (do
not leave agent-forward always on).

---

## One-time setup (machine already used on LAN)

If this Mac was already on the home LAN and only needs the remote path enabled,
the short form is enough:

```bash
cd ~/homelab/cloudflare-tunnel
./mac/install-ssh-client.sh

ssh -G infra01 | grep -E 'hostname|proxycommand|forwardagent'
ssh -G infra01-admin | grep -E 'hostname|proxycommand|forwardagent'
```

The script installs `cloudflared` and writes managed snippets under
`~/.ssh/config.d/infra01.conf` without clobbering unrelated SSH config.

**Expected:**

| Alias | `ForwardAgent` | Use for |
| ----- | -------------- | ------- |
| `infra01` | `no` | Everyday shell, tooling, LAN-side SSH from the VM to guests |
| `infra01-admin` | `yes` | Only when the VM must use a key that lives on the Mac (`pve01`, GitHub) |

Both aliases target `infra.nasraldin.com` through `cloudflared access ssh`.

For a **brand-new machine that has never been on the LAN**, use
[New local machine (outside the lab)](#new-local-machine-outside-the-lab)
instead.

---

## Day-2 workflows (copy-paste)

### A. Operator shell (anywhere)

```bash
ssh infra01
```

First connection: Cloudflare Access opens in the browser → email OTP → then
normal SSH public-key auth as `nasr`.

Verify toolchain:

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

### B. Proxmox administration (agent-forward)

Keys stay on the Mac. Forward only while needed:

```bash
ssh-add --apple-use-keychain ~/.ssh/pve01
ssh infra01-admin
ssh pve01 'hostname -f; pveversion; qm list; zpool status'
```

One-liners from the Mac:

```bash
ssh infra01-admin 'ssh pve01 "pveversion; qm list; zpool status"'
ssh infra01-admin 'ssh pve01 "qm status 112"'
ssh infra01-admin 'ssh pve01 "qm start 112"'
ssh infra01-admin 'ssh pve01 "qm shutdown 112"'
ssh infra01-admin 'ssh pve01 "/usr/local/bin/pve-check-updates --check"'
```

Disconnect when finished. While `infra01-admin` is connected, a privileged
process on the VM can request signatures from the forwarded agent.

Hypervisor upgrades: follow [proxmox-updates.md](proxmox-updates.md). Do not
blindly `apt full-upgrade` on `pve01`.

Ansible pins `pve01.lab.nasraldin.com` → `192.168.68.13` in `/etc/hosts` on
`infra01` so a DNS outage does not block emergency PVE SSH.

### C. Clone private GitHub repos onto infra01

No durable GitHub deploy key on the VM:

```bash
ssh-add --apple-use-keychain ~/.ssh/github
ssh infra01-admin
ssh -o StrictHostKeyChecking=accept-new -T git@github.com
git clone git@github.com:nasraldin/homelab.git ~/homelab
# then clone-labs / sibling repos as needed
```

### D. Run Terraform / Ansible from infra01

Use when the Mac is off-LAN or you want a long job on an always-on host.

1. Clone repos (workflow C) or `git pull` under `~/homelab`.
2. Prefer **short-lived** credentials from the password manager for that session
   (export in the shell, or paste into a temp file you delete afterward).
3. **Do not** permanently copy Mac gitignored files (`secrets.yml`,
   `credentials.auto.tfvars`, Cloudflare tokens, Vault init JSON) onto
   `infra01` disk.

Example pattern (secrets stay session-scoped):

```bash
ssh infra01
cd ~/homelab/ansible-lab
# Operator pastes secrets.yml for this session only, then:
ansible-playbook playbooks/dns.yml -e @secrets.yml
shred -u secrets.yml   # or rm after work — do not leave secrets on disk
```

Guest SSH from `infra01` uses the lab LAN (`192.168.68.x`) — the VM is already
inside the network. Ensure the operator’s SSH public key is in guest
`authorized_keys` (cloud-init / Ansible), same as from the Mac.

### E. On-LAN fallback (no Tunnel)

```bash
ssh nasr@192.168.68.12
```

---

## Toolchain (what Ansible installs)

- Terraform, Ansible, ansible-lint, yamllint, ShellCheck
- kubectl, Helm
- GitHub CLI, Git, Docker Engine + Compose plugin, Python, build tools
- jq, yq, ripgrep, rsync, tmux
- DNS / route / packet / transfer / backup diagnostics

Re-apply:

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/infra.yml
ansible-playbook playbooks/infra.yml   # expect changed=0
```

---

## Security rules (locked)

| Rule | Detail |
| ---- | ------ |
| No WAN SSH port-forward | Only Cloudflare Tunnel + Access to `infra.nasraldin.com` |
| No durable secrets on disk | No Proxmox API token, Cloudflare token, GitHub PAT, or `secrets.yml` left on the VM |
| Agent forward is opt-in | Use `infra01-admin` only for PVE/GitHub keys; disconnect after |
| Password SSH / root SSH off | Ansible enforces; login as `nasr` with key + sudo |
| Prefer Mac on LAN | Less blast radius; Tunnel path is for remote and always-on jobs |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| Browser Access / OTP loop | First login or expired Access session | Complete OTP; retry `ssh infra01` |
| `cloudflared: command not found` / ProxyCommand fails | Client not installed | Re-run `cloudflare-tunnel/mac/install-ssh-client.sh` |
| New laptop: Access OK but `Permission denied (publickey)` | Key on this machine not in `infra01` `authorized_keys` | Restore `~/.ssh/pve01` or authorize new pubkey (console / LAN / Ansible) — see [new machine](#new-local-machine-outside-the-lab) |
| Trying `ssh 192.168.68.12` from outside | Expected failure | Use `ssh infra01` (Tunnel) only |
| Host key verification failed | VM recreated after wipe | `ssh-keygen -R infra.nasraldin.com` and `ssh-keygen -R 192.168.68.12` (or ansible-lab `refresh-ssh-known-hosts.sh`) |
| `Permission denied (publickey)` to infra01 | Wrong key / Access OK but SSH key mismatch | Confirm Mac key is the one cloud-init/Ansible authorized |
| `ssh pve01` fails from infra01 | No agent / wrong alias | Use `infra01-admin` after `ssh-add ~/.ssh/pve01` |
| Off-LAN cannot reach `192.168.68.12` directly | Expected | Use `infra.nasraldin.com` via Tunnel — never open WAN `:22` |
| Tunnel / Access outage while at home | CF path down | LAN: `ssh nasr@192.168.68.12` or Proxmox UI |
| infra01 down | Guest stopped or broken | Proxmox UI / LAN `qm` on `pve01`; rebuild TF + `infra.yml` + tunnel |

---

## For agents (and remote operators)

1. **Assume off-LAN unless the user says they are on the home LAN.** Do not
   prescribe raw `ssh root@192.168.68.13` or guest IPs as the only path.
2. **Remote control plane = `infra01`.** Point the operator at this doc;
   commands should use `ssh infra01` / `ssh infra01-admin` patterns above.
   On a **new machine**, follow
   [New local machine (outside the lab)](#new-local-machine-outside-the-lab)
   (Tunnel is mandatory; do not suggest WAN port-forwards).
3. **Never instruct copying** `secrets.yml`, `credentials.auto.tfvars`, Vault
   init JSON, or Cloudflare tokens onto `infra01` for long-term storage.
4. **Do not confuse** `infra01` (operator jump box) with app VMs, OpsHub
   (browser hub), or future Docker management UIs.
5. After factory-reset of guests, remind the operator to refresh SSH host keys
   ([lab-refresh-runbook.md](lab-refresh-runbook.md) ·
   `ansible-lab/scripts/refresh-ssh-known-hosts.sh`).

---

## Rebuild order (infra01 path)

1. `terraform-lab` apply — confirm VMID **112** / `.12` running.
2. `ansible-lab/playbooks/infra.yml` twice (second run `changed=0`).
3. Export Cloudflare API token → `cloudflare-tunnel/mac/bootstrap.sh --yes`.
4. `cloudflare-tunnel/mac/install-ssh-client.sh` on the operator Mac.
5. Prove off-LAN: `ssh infra01` (Access OTP once) and
   `ssh infra01-admin 'ssh pve01 hostname'`.

---

## OpsHub vs infra01

| Need | Use |
| ---- | --- |
| Browser Proxmox / guest console | OpsHub or `https://homelab.nasraldin.com` |
| Interactive SSH + CLI toolchain from anywhere | **infra01** (this page) |
| Remote Proxmox **API** from OpsHub | Access Service Auth (see OpsHub / tunnel docs) |

OpsHub Terminal → Console opens Proxmox xterm.js via the UI hostname. SSH inside
OpsHub still needs a reachable address (LAN or this Tunnel path) — it does not
replace `infra01`.

---

## Related

- [remote-connectivity.md](remote-connectivity.md) — RDP / RustDesk / NoMachine for GUI guests
- [deploy-and-rebuild.md](deploy-and-rebuild.md) — Mac-first full stack order
- [lab-refresh-runbook.md](lab-refresh-runbook.md) — wipe → rebuild checklist
- [proxmox-updates.md](proxmox-updates.md) — safe host upgrades
- [mac-dns.md](mac-dns.md) — Mac resolver when AdGuard is down
- [OpsHub Proxmox via Access](https://github.com/nasraldin/opshub/blob/main/docs/runbooks/proxmox-via-cloudflare-access.md)
- [Tunnel Service Auth](https://github.com/nasraldin/cloudflare-tunnel/blob/main/docs/04-service-auth.md)
