# Run the bounded OPNsense VLAN pilot

Use this runbook only after reviewing the
[approved design](../superpowers/specs/2026-07-21-opnsense-vlan-pilot-design.md).
It creates a bounded proof environment on spare `nic1`; it does not cut over
the TP-Link edge, migrate DNS, or place production workloads behind OPNsense.

**Current status:** approved/in progress; canonical runbook recorded;
infrastructure not deployed.

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
9. Under **Interfaces → Other Types → VLAN**, create:
   - tag 20 on the LAN parent, description `VLAN 20 Infrastructure`;
   - tag 30 on the LAN parent, description `VLAN 30 Kubernetes`.
10. Assign and enable the new interfaces:
    - VLAN 20 Infrastructure: `192.168.20.1/24`;
    - VLAN 30 Kubernetes: `192.168.30.1/24`.
11. Rename the LAN description to `VLAN 10 Management`.

## 4. Configure addressing and NAT

Keep the Mac static initially. The two tagged VMs may use static addresses or
bounded DHCP scopes. Do not overlap the existing `192.168.68.0/22`.

| Client        | Network                | Example address     | Gateway        | DNS                    |
| ------------- | ---------------------- | ------------------- | -------------- | ---------------------- |
| Admin Mac     | VLAN 10 Management     | `192.168.10.2/24`   | none initially | none; explicit queries |
| `pilot-infra` | VLAN 20 Infrastructure | `192.168.20.100/24` | `192.168.20.1` | `192.168.68.10`        |
| `pilot-k8s`   | VLAN 30 Kubernetes     | `192.168.30.100/24` | `192.168.30.1` | `192.168.68.10`        |

If DHCP is enabled, advertise only the interface `.1` gateway and AdGuard
`192.168.68.10` as DNS. Do not advertise OPNsense, Technitium, an ISP resolver,
or a public resolver.

Keep automatic outbound NAT enabled for all three `/24` pilot networks. This
lets AdGuard see requests from the OPNsense WAN address on its existing
`192.168.68.0/22` trust boundary; it does not migrate or reconfigure AdGuard.
Verify that automatic rules cover all three networks before continuing.

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

Create these aliases to make review and logs unambiguous:

- `APPROVED_DNS`: host `192.168.68.10`;
- `PILOT_NETS`: networks `192.168.10.0/24`, `192.168.20.0/24`,
  `192.168.30.0/24`;
- `PRIVATE_NETS`: the three pilot networks plus `192.168.68.0/22` and the
  RFC1918 ranges.

On each pilot interface, remove the default broad LAN allow rule and apply
rules in this order:

1. allow required DHCP client traffic if that interface runs DHCP;
2. allow TCP/UDP 53 from that interface network to `APPROVED_DNS`;
3. reject and log TCP/UDP 53 from that interface network to any destination;
4. on VLAN 10 Management only, allow HTTPS to that interface's OPNsense
   address (and SSH only if explicitly enabled for the pilot);
5. reject and log traffic from that interface network to `PILOT_NETS`;
6. reject and log traffic to `192.168.68.0/22` except the approved DNS rule
   already matched above;
7. allow non-DNS traffic from that interface network to destinations not in
   `PRIVATE_NETS` for update and Internet verification;
8. end with a logged reject/deny.

Do not add floating pass rules or a broad inter-interface allow. Keep WAN
default deny with no inbound management rule. Apply changes from the console
or VLAN 10 so a policy error cannot strand the operator.

Export the OPNsense configuration after the rules are reviewed. Store it
encrypted outside Git and record its checksum.

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

1. Re-export and checksum the reviewed OPNsense configuration.
2. Reboot OPNsense normally from its UI or console.
3. Confirm WAN, VLAN 10 Management, VLAN 20 Infrastructure, and VLAN 30
   Kubernetes return with the same assignments.
4. Repeat the complete matrix:
   - Mac `192.168.10.2/24`, no Ethernet default gateway, Wi-Fi still default;
   - VLAN 20 and VLAN 30 VM address, tag, and `.1` gateway;
   - approved DNS and rejected UDP/TCP DNS bypass from all three networks;
   - segmentation in every direction and VLAN 10-only management;
   - Internet egress from both tagged VMs;
   - unchanged existing-LAN and Cloudflare Tunnel checks.
5. Mark the pilot verified only if both pre-reboot and post-reboot matrices
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
