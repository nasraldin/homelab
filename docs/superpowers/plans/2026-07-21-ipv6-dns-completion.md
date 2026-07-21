# IPv6 DNS Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AdGuard safely reachable through a stable IPv6 identity and complete the TP-Link RDNSS cutover without permitting an ISP resolver fallback.

**Architecture:** Terraform pins AdGuard's virtual NIC MAC so its EUI-64 link-local address is deterministic. Ansible permits DNS from IPv6 link-local clients while retaining default-deny UFW policy. The router advertises that address as its only IPv6 DNS resolver; if its firmware rejects link-local RDNSS, IPv6 DNS advertisement or LAN IPv6 is disabled.

**Tech Stack:** Terraform, BPG Proxmox provider, Ansible, UFW, AdGuard Home, TP-Link Deco, `dig`, macOS `scutil`

## Global Constraints

- Keep AdGuard at `192.168.68.10` and VMID `110`.
- Do not expose DNS, SSH, or web administration to arbitrary global IPv6 sources.
- Never advertise a public secondary DNS resolver.
- Do not guess, extract, or store the TP-Link owner password.
- Apply Terraform from a reviewed saved plan.
- A second Ansible run must report `changed=0`.

---

### Task 1: Pin AdGuard's virtual NIC identity

**Files:**

- Modify: `terraform-lab/variables.tf`
- Modify: `terraform-lab/vms.tf`
- Modify: `terraform-lab/modules/vm/variables.tf`
- Modify: `terraform-lab/modules/vm/main.tf`
- Modify: `terraform-lab/terraform.tfvars`

**Interfaces:**

- Consumes: optional `vms.<name>.mac_address`
- Produces: `module.vm.mac_address`, passed to Proxmox `network_device.mac_address`

- [ ] **Step 1: Add the root VM input**

Add to the object in `variable "vms"`:

```hcl
mac_address = optional(string)
```

- [ ] **Step 2: Add the module input**

```hcl
variable "mac_address" {
  description = "Optional explicit MAC address for a stable IPv6 EUI-64 identity"
  type        = string
  default     = null

  validation {
    condition = (
      var.mac_address == null ||
      can(regex("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$", var.mac_address))
    )
    error_message = "mac_address must be null or six colon-separated hexadecimal octets."
  }
}
```

- [ ] **Step 3: Wire the input through the root module**

Add to `module "vm"`:

```hcl
mac_address = each.value.mac_address
```

- [ ] **Step 4: Configure the Proxmox NIC**

Update the network block:

```hcl
network_device {
  bridge      = var.bridge
  mac_address = var.mac_address
}
```

- [ ] **Step 5: Assign AdGuard's deterministic MAC**

Add to the `adguard-01` map:

```hcl
mac_address = "02:00:00:00:00:10"
```

Its deterministic link-local address is `fe80::ff:fe00:10`.

- [ ] **Step 6: Validate and review the plan**

Run:

```bash
cd ~/homelab/terraform-lab
terraform fmt -recursive
terraform validate
terraform plan -out=tfplan
terraform show tfplan
```

Expected: the only DNS-VM change is AdGuard's network device MAC; no VM replacement, disk deletion, or Technitium mutation.

- [ ] **Step 7: Commit**

```bash
git add variables.tf vms.tf modules/vm/variables.tf modules/vm/main.tf terraform.tfvars
git commit -m "Pin AdGuard MAC for stable IPv6 DNS."
```

### Task 2: Permit link-local IPv6 DNS through UFW

**Files:**

- Modify: `ansible-lab/roles/guest_common/tasks/main.yml`
- Modify: `ansible-lab/inventory/host_vars/adguard-01.yml`
- Modify: `ansible-lab/docs/dns.md`

**Interfaces:**

- Consumes: optional `source` in each `guest_extra_ufw_rules` item
- Produces: idempotent UFW rules for TCP/UDP 53 from `fe80::/10`

- [ ] **Step 1: Make extra-rule source explicit and optional**

Replace the extra-rule command with:

```yaml
cmd: >-
  ufw allow from {{ item.source | default(lab_cidr) }}
  to any port {{ item.port }}
  proto {{ item.proto | default('tcp') }}
  comment {{ item.comment | default('lab') }}
```

- [ ] **Step 2: Add AdGuard IPv6 DNS rules**

Append:

```yaml
- { port: '53', proto: 'udp', source: 'fe80::/10', comment: 'dns-udp-v6-link-local' }
- { port: '53', proto: 'tcp', source: 'fe80::/10', comment: 'dns-tcp-v6-link-local' }
```

- [ ] **Step 3: Document the stable address**

Record `fe80::ff:fe00:10` as the preferred TP-Link IPv6 DNS/RDNSS server and explain that callers must supply an interface scope when testing directly:

```bash
dig @fe80::ff:fe00:10%en0 doubleclick.net +short
```

- [ ] **Step 4: Validate the role**

Run:

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/dns.yml --syntax-check -e @secrets.yml
yamllint inventory roles playbooks
```

Expected: both commands exit zero.

- [ ] **Step 5: Commit**

```bash
git add roles/guest_common/tasks/main.yml inventory/host_vars/adguard-01.yml docs/dns.md
git commit -m "Allow link-local IPv6 clients to use AdGuard DNS."
```

### Task 3: Apply and prove AdGuard IPv6 filtering

**Files:**

- Runtime changes only

**Interfaces:**

- Consumes: reviewed `terraform-lab/tfplan`, `ansible-lab/secrets.yml`
- Produces: live AdGuard address `fe80::ff:fe00:10` and UFW rules

- [ ] **Step 1: Apply the reviewed Terraform plan**

```bash
cd ~/homelab/terraform-lab
terraform apply tfplan
rm -f tfplan
```

Expected: AdGuard remains VMID 110 and returns to `running`.

- [ ] **Step 2: Wait for SSH and apply Ansible**

```bash
until ssh -o BatchMode=yes -o ConnectTimeout=5 nasr@192.168.68.10 true; do sleep 5; done
cd ~/homelab/ansible-lab
ansible-playbook playbooks/dns.yml -e @secrets.yml
ansible-playbook playbooks/dns.yml -e @secrets.yml
```

Expected: the second recap reports `changed=0 failed=0` for both hosts.

- [ ] **Step 3: Verify addresses, firewall, and service**

```bash
ssh nasr@192.168.68.10 \
  'ip -6 addr show dev eth0; sudo ufw status; sudo ss -lnutp | grep ":53 "'
```

Expected: `fe80::ff:fe00:10`, both link-local DNS rules, and AdGuard listening on port 53.

- [ ] **Step 4: Verify filtering over IPv4 and IPv6**

```bash
dig @192.168.68.10 doubleclick.net +short
dig @fe80::ff:fe00:10%en0 doubleclick.net +short
dig @fe80::ff:fe00:10%en0 pve01.lab.nasraldin.com +short
```

Expected: the first two return `0.0.0.0`; the last returns `192.168.68.13`.

### Task 4: Complete or bound the TP-Link router cutover

**Files:**

- Modify: `docs/operations/dns-dhcp-cutover.md`
- Modify: `docs/current-state.md`
- Modify: `docs/architecture/network-dns-ingress.md`

**Interfaces:**

- Consumes: authenticated TP-Link owner session
- Produces: IPv6 RDNSS with no ISP resolver fallback

- [ ] **Step 1: Attempt the preferred router setting**

In the TP-Link IPv6 LAN/DHCP DNS page, set Primary IPv6 DNS to:

```text
fe80::ff:fe00:10
```

Leave Secondary IPv6 DNS empty. Save and reconnect the Mac to Wi-Fi.

- [ ] **Step 2: Apply the firmware fallback when necessary**

If the UI rejects the link-local address, disable IPv6 DNS advertisement. If
that control does not exist independently, disable LAN IPv6 temporarily.

- [ ] **Step 3: Verify the client resolver list**

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
scutil --dns
dig pve01.lab.nasraldin.com +short
dig doubleclick.net +short
```

Expected: no `2a00:f28:2::2`, no `2a00:f28:2::20`, lab DNS returns `192.168.68.13`, and the advertising domain returns `0.0.0.0`.

- [ ] **Step 4: Update status accurately**

Mark the cutover complete only after Step 3 passes. If owner authentication is
unavailable, keep the status blocked and document the exact pending setting
rather than claiming completion.

- [ ] **Step 5: Commit**

```bash
git add docs/operations/dns-dhcp-cutover.md docs/current-state.md docs/architecture/network-dns-ingress.md
git commit -m "Document verified IPv6 DNS cutover state."
```
