# Run the bounded OPNsense VLAN pilot

Use this runbook only after reviewing the
[approved design](../superpowers/specs/2026-07-21-opnsense-vlan-pilot-design.md).
It creates a bounded proof environment on spare `nic1`; it does not cut over
the TP-Link edge, migrate DNS, or place production workloads behind OPNsense.

**Current status:** implemented and technically verified on 2026-07-22. The
Ansible-managed policy, reboot, DNS-enforcement, regression, encrypted-backup,
and rollback-boundary checks pass.
The pilot is not marked fully complete until the direct Mac-to-`nic1` carrier
and no-Ethernet-default-route check is repeated at closeout.

## Verified implementation record

- OPNsense 26.7 is VMID `120`; `pilot-infra` is VMID `121` on VLAN 20 and
  `pilot-k8s` is VMID `122` on VLAN 30.
- `terraform-lab` owns VMID `120` and its NICs, `proxmox-bootstrap` owns
  `vmbr1`, and `ansible-lab` owns configuration inside OPNsense after the
  documented minimal bootstrap.
- `vmbr1` is VLAN-aware on physical `nic1`, has no Proxmox host address or
  route, and passes the idempotent pilot bridge check.
- OPNsense WAN uses TP-Link DHCP at `192.168.68.56/22`; private-WAN blocking
  is disabled, WAN management remains closed, and the WAN DHCP client
  supersedes resolver configuration with `1.1.1.1`.
- LAN/VLAN gateways are `192.168.10.1`, `192.168.20.1`, and
  `192.168.30.1`. Kea serves `.100-.199` on VLAN 20 and VLAN 30 with AdGuard
  `192.168.68.10` as client DNS. Dnsmasq DHCP is disabled.
- Both disposable clients received `.100`, resolve public and lab names
  through AdGuard, reach approved HTTPS and ICMP destinations, and cannot
  reach the other pilot VLAN, Proxmox, or unrelated current-LAN hosts.
  Direct UDP and TCP port 53 to public resolvers fails.
- The full client matrix passed before and after an orderly OPNsense reboot.
  Proxmox bridge drift, host firewall, AdGuard, Technitium, and both
  Cloudflare Tunnel endpoints remained green. Terraform subsequently reported
  no changes.
- OPNsense starts automatically after installation. Both disposable guests
  have working QEMU guest agents.
- The root credential is stored in macOS Keychain service
  `homelab-opnsense-root`. Ansible exported and independently verified the
  post-convergence encrypted configuration backup. Its encryption password is
  stored in Keychain service `homelab-opnsense-pilot-backup`; the path and
  SHA-256 are recorded outside Git, and no plaintext XML remains.
- The Ansible playbook passed lint, syntax, policy tests, check mode, live
  convergence, and a second run with `changed=0`.
- Physical closeout remains pending: the latest Mac route check sent
  `192.168.10.1` over Wi-Fi and direct HTTPS timed out. Configure the direct
  Ethernet service as `192.168.10.2/24` with no router, then repeat the Mac
  checks in sections 6 and 7 before changing this pilot from technically
  verified to complete.

## Change record

Before starting, create a dated evidence directory outside Git and record:

- operator, start time, OPNsense version, ISO URL, and SHA-256;
- Proxmox VMID, MAC addresses, `vmbr1`/`nic1` names, admin Mac Ethernet
  service/interface, and both test-client VMIDs;
- OPNsense WAN address and TP-Link gateway;
- screenshots or exports of both OPNsense virtual NIC settings;
- preflight, firewall, DNS, segmentation, reboot, and rollback results; and
- the path and checksum of the encrypted OPNsense configuration backup.

Do not put configuration exports, packet captures, credentials, or other
sensitive evidence in this repository.

## Stop conditions

Stop and roll back if any existing LAN client loses its TP-Link gateway, if
`pve01`/AdGuard/Technitium changes address, if the Cloudflare Tunnel path
fails, if either OPNsense NIC has the Proxmox firewall flag enabled, or if the
planned change would touch a physical switch or the TP-Link configuration.

Do not continue with DNS migration, edge cutover, NetBird, IPv6, Vault,
Kubernetes, or production workloads. Those are later phases.

## 1. Preflight and rollback proof

1. Use a local Proxmox console session as the primary control path. Keep a
   second session open and verify the existing Cloudflare Tunnel path.
2. Record the current Proxmox network configuration and VM inventory without
   changing them. Confirm `vmbr0` owns the live LAN and that spare `nic1` is
   not a `vmbr0` port, bond member, host-management interface, or live guest
   dependency.
3. Confirm the unchanged live state from an existing LAN client:

   ```bash
   route -n get default | grep gateway
   ping -c 3 192.168.68.1
   ping -c 3 192.168.68.13
   dig @192.168.68.10 pve01.lab.nasraldin.com +short
   dig @192.168.68.11 pve01.lab.nasraldin.com +short
   ```

   Expected: the default gateway is `192.168.68.1`, both DNS queries return
   `192.168.68.13`, and all pings succeed.

4. Verify the Proxmox UI and `infra01` through their existing Cloudflare
   Tunnel routes. Record pass/fail without altering tunnel configuration.
5. On the admin Mac, record the Wi-Fi service/interface and prove its current
   default route:

   ```bash
   networksetup -listallhardwareports
   route -n get default
   ```

   Keep Wi-Fi connected throughout the pilot. Record the unused Ethernet
   service/interface that will connect directly to `nic1`.

6. Confirm there is enough `data01` capacity for the OPNsense VM and two
   disposable tagged clients.
7. Download the OPNsense installer from the official project, verify its
   published checksum, and record both. Do not proceed on a mismatch.
8. Write the rollback action in the change record: power off OPNsense and the
   two test VMs, disconnect the Mac from `nic1`, restore its recorded Ethernet
   configuration, and verify Wi-Fi is still the default route. Confirm that no
   live client has OPNsense as gateway.

## 2. Create the pilot Proxmox topology

Use the Proxmox UI or a separately reviewed infrastructure change. The names
below describe the required state; do not repurpose `vmbr0`.

1. Create VLAN-aware Linux bridge `vmbr1` with:
   - bridge port `nic1`;
   - no Proxmox host IP or gateway; and
   - VLAN awareness enabled.
2. Create the OPNsense VM on `data01` with adequate pilot resources (minimum
   2 vCPU, 4 GiB RAM, and **16 GiB disk**), installer ISO, console access, and two
   VirtIO NICs:
   - NIC 1 / WAN on `vmbr0`, with **Firewall unchecked**;
   - NIC 2 / LAN on `vmbr1`, untagged with VLAN trunks 20 and 30,
     with **Firewall unchecked**.
     Use a larger disk only if the selected provider/storage enforces a larger
     minimum; record that constraint and resulting size before creation.
3. Inspect the final VM hardware view and record proof that the Proxmox
   firewall flag is disabled on **both** OPNsense NICs. Do not disable the
   datacenter or node firewall.
4. Create two minimal disposable test clients on `vmbr1`:
   - `pilot-infra` with Proxmox VLAN tag 20;
   - `pilot-k8s` with Proxmox VLAN tag 30.
5. Connect the admin Mac's recorded Ethernet adapter directly to physical
   `nic1`. Do not insert a switch or configure a switch VLAN.
6. Keep all existing VMs on their current bridges and addresses. Recheck that
   `vmbr0` is byte-for-byte unchanged from preflight.

## 3. Install and assign OPNsense

1. Boot the installer from the Proxmox console and install to the VM disk.
2. Remove the ISO and reboot. Record the detected VirtIO interface names.
3. Assign the `vmbr0` NIC as WAN and the `vmbr1` NIC as LAN. Do not
   create VLANs in the console assignment wizard.
4. Configure WAN using a recorded DHCP lease/reservation on
   `192.168.68.0/22`. Do not set the TP-Link to forward traffic to OPNsense.
5. Because the pilot WAN is private RFC1918 space, clear **Block private
   networks** on WAN. Keep unsolicited WAN traffic denied and do not enable
   WAN web UI or SSH access.
6. Set LAN to `192.168.10.1/24`. This untagged/native network is always named
   **VLAN 10 Management** in labels and evidence.
7. Configure the Mac Ethernet service manually as `192.168.10.2/24`, with
   Router and DNS blank. Confirm that `route -n get default` still reports the
   recorded Wi-Fi path, then browse to `https://192.168.10.1`.
8. Replace the default administrator password with a unique stored credential,
   set the timezone, and install current stable updates. Reboot if the update
   requires it.
9. Stop making policy changes in the UI and follow
   [`ansible-lab/docs/opnsense.md`](https://github.com/nasraldin/ansible-lab/blob/main/docs/opnsense.md).
   The first Ansible run creates and assigns VLAN 20 and VLAN 30, then stops
   until their static addresses are set.
10. Set the two API-unsupported address fields only:
    - VLAN 20 Infrastructure: enabled, Static IPv4 `192.168.20.1/24`, no
      gateway, IPv6 None;
    - VLAN 30 Kubernetes: enabled, Static IPv4 `192.168.30.1/24`, no gateway,
      IPv6 None.
11. Rerun Ansible to converge DHCP, aliases, firewall policy, service
    ownership, and NAT. A second successful run must report `changed=0`.

## 4. Converge addressing and NAT with Ansible

Keep the Mac static initially. Ansible configures the tagged clients' bounded
Kea DHCP scopes and automatic source NAT. Do not add or edit those objects in
the UI, and do not overlap the existing `192.168.68.0/22`.

| Client        | Network                | Example address     | Gateway        | DNS                    |
| ------------- | ---------------------- | ------------------- | -------------- | ---------------------- |
| Admin Mac     | VLAN 10 Management     | `192.168.10.2/24`   | none initially | none; explicit queries |
| `pilot-infra` | VLAN 20 Infrastructure | `192.168.20.100/24` | `192.168.20.1` | `192.168.68.10`        |
| `pilot-k8s`   | VLAN 30 Kubernetes     | `192.168.30.100/24` | `192.168.30.1` | `192.168.68.10`        |

The managed scopes advertise only the interface `.1` gateway and AdGuard
`192.168.68.10` as DNS. They do not advertise OPNsense, Technitium, an ISP
resolver, or a public resolver.

Ansible keeps automatic outbound NAT enabled for the pilot networks. This
lets AdGuard see requests from the OPNsense WAN address on its existing
`192.168.68.0/22` trust boundary; it does not migrate or reconfigure AdGuard.
The playbook verifies source-NAT mode before continuing.

### Guard the Mac rollback route

The primary validation keeps the Mac Ethernet service static with no default
gateway. Add only temporary target-specific routes through OPNsense:

```bash
sudo route -n add -host 192.168.68.10 192.168.10.1
sudo route -n add -host 1.1.1.1 192.168.10.1
sudo route -n add -host 8.8.8.8 192.168.10.1
sudo route -n add -net 192.168.20.0/24 192.168.10.1
sudo route -n add -net 192.168.30.0/24 192.168.10.1
```

Before DNS or segmentation tests, run `route -n get` for each target and prove
the pilot target uses the Mac Ethernet interface while `route -n get default`
still uses Wi-Fi.

If VLAN 10 DHCP is tested later:

1. Record the current default route and set macOS network service order with
   Wi-Fi above the pilot Ethernet service.
2. Change only the pilot Ethernet service to DHCP.
3. Immediately check its lease and `route -n get default`.
4. If the default route is no longer Wi-Fi, disconnect Ethernet, restore
   `192.168.10.2/24` with Router/DNS blank, and stop the DHCP test.
5. Use the tagged VMs for Internet acceptance by default. Do not infer Mac
   pilot egress from ordinary browser traffic that may have used Wi-Fi.
6. Return the Mac Ethernet service to the static no-gateway configuration
   after the DHCP test.

## 5. Build aliases and firewall policy

Ansible owns the aliases and ordered rules below. Change
`roles/opnsense_pilot/defaults/main.yml` and rerun the playbook; do not create
parallel UI-only rules.

The managed aliases are:

- `ADGUARD`: host `192.168.68.10`;
- `CURRENT_LAN`: network `192.168.68.0/22`;
- `WEB_PORTS`: ports `80` and `443`.

VLAN 20 and VLAN 30 explicitly allow OPNsense NTP, DNS to `ADGUARD`, web
egress to `WEB_PORTS`, and ICMP. They reject direct DNS to any other
destination, the other pilot VLAN, and `CURRENT_LAN` except the earlier
AdGuard exception. VLAN 10 remains the management-only administration path.

The role disables the default broad LAN allow and legacy pilot rules, then
applies managed rules in this order:

1. on VLAN 10 Management, allow access to VLAN 20 and VLAN 30, then default-deny;
2. on each tagged VLAN, allow OPNsense NTP;
3. allow TCP/UDP 53 from that interface network to `ADGUARD`;
4. reject and log TCP/UDP 53 from that interface network to any other destination;
5. deny the other pilot VLAN and `CURRENT_LAN` except the AdGuard exception;
6. allow HTTPS/HTTP egress to `WEB_PORTS` and ICMP diagnostics;
7. end with a logged default deny.

Do not add floating pass rules or a broad inter-interface allow. Keep WAN
default deny with no inbound management rule. Run Ansible from the direct Mac
management path so a policy error cannot strand the operator.

After review, use the playbook's `backup` tag to validate, encrypt, immediately
decrypt-check, and clean up the XML export. Store only the encrypted artifact
outside Git and record its checksum.

## 6. Verify before reboot

Run every test from the admin Mac and both tagged pilot VMs, and save command,
timestamp, result, and relevant firewall log entry.

### Addressing and approved DNS

On the Mac:

```bash
ifconfig <pilot-ethernet-interface>
route -n get default
route -n get 192.168.10.1
route -n get 192.168.68.10
dig @192.168.68.10 pve01.lab.nasraldin.com +short
dig @192.168.68.10 example.com +short
```

Expected: Ethernet is `192.168.10.2/24`; the default route remains Wi-Fi;
pilot targets use Ethernet through `192.168.10.1`; the lab query returns
`192.168.68.13`; and the public query returns an address.

On each tagged Linux VM:

```bash
ip address
ip route
dig @192.168.68.10 pve01.lab.nasraldin.com +short
dig @192.168.68.10 example.com +short
```

Expected: the VM has the correct tagged `/24` and `.1` gateway, and both DNS
queries succeed through AdGuard.

### Prove direct DNS bypass fails

Test at least two unrelated external resolvers so a single unreachable
provider cannot create a false pass:

```bash
dig @1.1.1.1 example.com +time=2 +tries=1
dig @8.8.8.8 example.com +time=2 +tries=1
dig @1.1.1.1 example.com +tcp +time=2 +tries=1
dig @8.8.8.8 example.com +tcp +time=2 +tries=1
```

All four direct queries must fail on every pilot network, for both UDP and
TCP. On the Mac, first prove `route -n get 1.1.1.1` and
`route -n get 8.8.8.8` use the Ethernet pilot route, not Wi-Fi. OPNsense live
logs must show the matching port 53 rejects. A successful direct answer is a
failed pilot; fix policy and repeat the full matrix.

Then prove DNS still works only through the approved path:

```bash
dig @192.168.68.10 example.com +time=2 +tries=1
dig @192.168.68.10 example.com +tcp +time=2 +tries=1
```

This proves enforcement of TCP/UDP 53 only. Do not claim that this test blocks
DNS-over-HTTPS, DNS-over-TLS, VPNs, or other tunnels.

### Prove default-deny segmentation

From each client, attempt ICMP and a TCP connection to both other clients. The
Mac must first have the temporary VLAN 20 and VLAN 30 routes shown above. For
example:

```bash
ping -c 3 192.168.20.100
ping -c 3 192.168.30.100
nc -vz -w 3 192.168.20.100 22
nc -vz -w 3 192.168.30.100 22
```

Adjust destinations for the source network and use Mac
`192.168.10.2` as the VLAN 10 target from both VMs. Every cross-VLAN attempt
must fail and produce a logged deny. Temporarily running a listener for a
stronger TCP test is allowed only on the tagged VMs; remove it after the test.

### Prove management isolation

- The directly connected Mac on VLAN 10 Management can open
  `https://192.168.10.1`.
- VLAN 20 and VLAN 30 cannot reach any OPNsense web UI or SSH address.
- A live-LAN client cannot reach the OPNsense WAN web UI or SSH.

### Prove the rollback path stayed unchanged

Repeat the preflight checks from an existing LAN client. Reverify the
Cloudflare Tunnel routes. Existing clients must still use TP-Link
`192.168.68.1`; do not test by changing their gateway.

## 7. Reboot and repeat

1. Export and checksum the reviewed OPNsense configuration with the Ansible
   `backup` tag.
2. Run `ansible-playbook` again and require `changed=0`.
3. Run `ansible-lab/scripts/validate-opnsense-pilot.sh`.
4. Reboot OPNsense normally with `ssh pve01 'qm reboot 120'`.
5. Run `validate-opnsense-pilot.sh --wait`; its readiness check uses the VLAN
   20 guest agent and does not add a Proxmox address to `vmbr1`.
6. Confirm WAN, VLAN 10 Management, VLAN 20 Infrastructure, and VLAN 30
   Kubernetes return with the same assignments.
7. Repeat the complete matrix:
   - Mac `192.168.10.2/24`, no Ethernet default gateway, Wi-Fi still default;
   - VLAN 20 and VLAN 30 VM address, tag, and `.1` gateway;
   - approved DNS and rejected UDP/TCP DNS bypass from all three networks;
   - segmentation in every direction and VLAN 10-only management;
   - Internet egress from both tagged VMs;
   - unchanged existing-LAN and Cloudflare Tunnel checks.
8. Mark the pilot verified only if both pre-reboot and post-reboot matrices
   pass. “Verified” still means bounded pilot, not deployed edge.

## 8. Roll back

Rollback is preferred over live troubleshooting if a stop condition is hit.

1. Power off the two tagged test VMs.
2. Power off the OPNsense VM.
3. Remove the temporary Mac pilot routes (ignore only a documented
   “not in table” response for a route that was never added):

   ```bash
   sudo route -n delete -host 192.168.68.10 192.168.10.1
   sudo route -n delete -host 1.1.1.1 192.168.10.1
   sudo route -n delete -host 8.8.8.8 192.168.10.1
   sudo route -n delete -net 192.168.20.0/24 192.168.10.1
   sudo route -n delete -net 192.168.30.0/24 192.168.10.1
   ```

4. Disconnect the Mac Ethernet cable from `nic1`, restore the recorded
   preflight Ethernet configuration, and verify Wi-Fi is still its default
   route.
5. From the Mac over Wi-Fi, verify TP-Link remains the default gateway and
   repeat the `pve01`, AdGuard, Technitium, Internet, and Cloudflare Tunnel
   checks from preflight.
6. Preserve the encrypted OPNsense export and evidence. Record the reason,
   time, and verification result.
7. Leave the powered-off pilot definitions for diagnosis unless cleanup is
   separately approved. If cleanup is approved, delete only the two test VMs,
   OPNsense VM, installer ISO if no longer needed, and `vmbr1`; restore `nic1`
   to its recorded unused preflight state.

Never remove or edit `vmbr0`, live VM NICs, TP-Link DHCP/edge settings,
AdGuard, Technitium, `pve01`, the Proxmox host firewall, or Cloudflare Tunnel
as part of pilot rollback.

## Exit and next phase

Close the change with one of three outcomes: verified bounded pilot, rolled
back safely, or blocked with evidence. Do not call it deployed.

The approved sequence is OPNsense VLAN Pilot → DNS migration (AdGuard +
Technitium) → NetBird remote access → Vault. Start none of those later changes
from this runbook.
