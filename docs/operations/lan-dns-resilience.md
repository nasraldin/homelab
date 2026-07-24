# LAN DNS resilience (AdGuard as Primary)

How lab DNS is supposed to work when Proxmox reboots, when DNS VMs are replaced,
and when AdGuard is briefly unavailable. Misunderstanding this looks like
“the internet is down” on every phone and laptop.

**Related:** [dns-dhcp-cutover.md](dns-dhcp-cutover.md) (router steps) ·
[mac-dns.md](mac-dns.md) (Mac quick commands) ·
[network-dns-ingress.md](../architecture/network-dns-ingress.md) (design) ·
[vm-best-practices.md](../architecture/vm-best-practices.md) (guest hardware) ·
[guest-vmid-map.md](guest-vmid-map.md) (VMIDs / boot order)

## Roles

| Component                    | Address                        | Role                                                 |
| ---------------------------- | ------------------------------ | ---------------------------------------------------- |
| AdGuard Home (`adguard-01`)  | `192.168.68.10` · VMID **110** | **Recursive** resolver for the LAN (ads, forwarding) |
| Technitium (`technitium-01`) | `192.168.68.11` · VMID **111** | **Authoritative** for `lab.nasraldin.com` only       |
| Cloudflare                   | `1.1.1.1`                      | Public recursive fallback (router Secondary DNS)     |
| TP-Link DHCP                 | Gateway `.1`                   | Hands clients Primary + Secondary DNS                |

```text
LAN client (DHCP)
    │
    ├─ Primary DNS ──► AdGuard .10 ──► lab zone → Technitium .11
    │                              └─► everything else → 1.1.1.1
    │
    └─ Secondary DNS ► 1.1.1.1     (used when Primary is unreachable)
```

Technitium must **never** be DHCP Primary or Secondary for general clients. It
does not recurse the public Internet.

## What “internet broke” actually means

Symptoms (browsers fail, apps “offline”, Ansible hangs on downloads) usually mean
**name resolution failed**, not that the WAN uplink is down.

### Failure mode A — Primary DNS unreachable, no Secondary

| Condition                                               | Effect                        |
| ------------------------------------------------------- | ----------------------------- |
| AdGuard VM powered off / destroyed / not yet configured | Primary `.10` does not answer |
| Router Secondary DNS empty                              | Clients have **no** resolver  |
| Result                                                  | Whole LAN appears offline     |

This is the mode hit during the 2026-07 OVMF/SCSI guest recreate when DNS VMs
were replaced in the same batch as everything else.

### Failure mode B — Primary up, service not installed yet

Terraform recreates a blank Debian cloud image with `on_boot = 1`. The guest
boots and holds `.10`, but AdGuard Home is not listening until
`ansible-playbook playbooks/dns.yml` finishes. Same client impact as A until
Ansible completes.

### Failure mode C — control Mac pinned only to AdGuard

If the Mac Wi‑Fi DNS is forced to `.10` only (no public nameserver), the
**operator** loses recursion whenever AdGuard is down — Terraform/Ansible appear
stuck even when phones still work via Secondary.

## Autostart is already correct

| Setting            | Value                                  | Meaning                             |
| ------------------ | -------------------------------------- | ----------------------------------- |
| `on_boot`          | `true` / `onboot: 1`                   | Guest starts when `pve01` boots     |
| `startup` order    | AdGuard `1`, Technitium `2`, then apps | DNS before GitLab / Vault / runners |
| `startup` up delay | AdGuard `15s`, Technitium `10s`        | Give DNS time before next VM        |

Encoded in `terraform-lab` (`modules/vm` + `terraform.tfvars`). Verify on the
node:

```bash
ssh root@192.168.68.13 'grep -E "onboot|startup" /etc/pve/qemu-server/110.conf /etc/pve/qemu-server/111.conf'
# expect: onboot: 1 and startup: order=1,up=15 (AdGuard); order=2 for Technitium
```

Autostart does **not** install AdGuard. After a **disk wipe** (Terraform
`-replace`), you must re-run Ansible.

## Locked resilience policy

| Layer          | Policy                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Router DHCP    | **Primary** = `192.168.68.10`, **Secondary** = `1.1.1.1`                                               |
| Mac (operator) | Prefer DHCP DNS (inherits Primary+Secondary). Before DNS VM replace, run failover script to public DNS |
| Proxmox        | `on_boot` + startup order (above)                                                                      |
| Ansible        | `playbooks/dns.yml` is the only supported way to restore AdGuard/Technitium config                     |

Trade-off: while AdGuard is down, clients that fall back to `1.1.1.1` get
**unfiltered** public DNS (no ad-block, no `*.lab` names). That is intentional —
availability over filtering during an outage.

## Operator runbooks

### Host reboot (`pve01`)

No special DNS steps if AdGuard disk is intact. VMs start in order; wait ~1–2
minutes, then:

```bash
dig @192.168.68.10 example.com +short
dig @192.168.68.10 pve01.lab.nasraldin.com +short   # → 192.168.68.13
```

### Terraform replace / destroy of DNS guests

```bash
# 1) Protect the Mac control plane
~/homelab/ansible-lab/scripts/dns-failover-public.sh

# 2) Confirm router Secondary DNS is still 1.1.1.1 (phones/TVs)

# 3) Apply replace (example)
cd ~/homelab/terraform-lab
terraform apply -replace='module.vm["adguard-01"].proxmox_virtual_environment_vm.this'

# 4) Clear stale SSH host keys
ssh-keygen -R 192.168.68.10
ssh-keygen -R 192.168.68.11

# 5) Wait for cloud-init SSH, then restore services
cd ~/homelab/ansible-lab
ansible-playbook playbooks/dns.yml -e @secrets.yml

# 6) Return Mac to AdGuard (or Empty for DHCP)
./scripts/dns-restore-adguard.sh
```

Do **not** replace DNS VMs in the same apply as the rest of the lab without
steps 1–2 first.

### Scripts (ansible-lab)

| Script                           | Purpose                               |
| -------------------------------- | ------------------------------------- |
| `scripts/dns-failover-public.sh` | Mac Wi‑Fi → `1.1.1.1` / `1.0.0.1`     |
| `scripts/dns-restore-adguard.sh` | Prove AdGuard, then Mac Wi‑Fi → `.10` |

Manual equivalents and how to read `scutil` / `networksetup`:
[mac-dns.md](mac-dns.md).

## Acceptance checks

```bash
# Service path
dig @192.168.68.10 example.com +short
dig @192.168.68.11 pve01.lab.nasraldin.com +short

# Client path (uses system resolvers — should prefer AdGuard when healthy)
dig pve01.lab.nasraldin.com +short

# Proxmox policy
ssh root@192.168.68.13 'qm config 110 | egrep "onboot|startup"'
```

## Decision record

See [decisions/log.md](../decisions/log.md): DHCP Secondary DNS = public
resolver for LAN resilience; AdGuard remains Primary for filtering when healthy.
