# OPNsense VLAN pilot

Date: 2026-07-21
Status: approved/in progress; canonical design recorded; infrastructure not
deployed

## Goal

Validate OPNsense routing, default-deny segmentation, and enforced DNS across a
spare physical management link and tagged Proxmox test networks before
changing the live edge. The pilot must be removable without changing the
existing LAN, DNS servers, or remote-access path.

The operational procedure is
[OPNsense VLAN pilot](../../operations/opnsense-vlan-pilot.md).

## Safety boundary

The following live services are unchanged and form the rollback path:

- TP-Link remains the edge router and default gateway for
  `192.168.68.0/22`.
- `pve01` remains `192.168.68.13/22`.
- AdGuard remains `192.168.68.10`; Technitium remains `192.168.68.11`.
- Cloudflare Tunnel remains the remote path to the Proxmox UI and `infra01`.
- Existing LAN clients do not use OPNsense as their gateway.
- No existing VM is moved and no DNS or DHCP setting is changed.

The OPNsense WAN is a guest on the existing LAN through `vmbr0`. Its LAN side
uses VLAN-aware bridge `vmbr1`, bound to the spare physical `nic1`, with no
Proxmox host IP or gateway. The admin Mac connects directly to `nic1` and
carries VLAN 10 Management untagged/native. Two disposable VMs attach to
`vmbr1` with Proxmox tags 20 and 30.

Both OPNsense virtual NICs have the Proxmox firewall flag disabled for the
duration of the pilot; OPNsense alone owns policy inside the test boundary.
This does not disable the existing Proxmox datacenter or node firewall.
`vmbr0`, its physical port, host address, and all live guests remain unchanged.

## Approved topology

The OPNsense pilot VM baseline is 2 vCPU, 4 GiB RAM, and a 16 GiB disk on
`data01`. A larger disk is allowed only when the selected provider or storage
enforces a larger minimum and that constraint is recorded before creation.

```text
Internet
   |
TP-Link edge (unchanged, 192.168.68.1)
   |
vmbr0 / live LAN 192.168.68.0/22
   |-- AdGuard 192.168.68.10
   |-- Technitium 192.168.68.11
   |-- pve01 192.168.68.13 + Cloudflare Tunnel
   `-- OPNsense WAN (pilot only; DHCP reservation or recorded temporary address)
          |
          `-- OPNsense LAN trunk on vmbr1 (VLAN-aware; no host IP/gateway)
                |-- nic1 -- direct cable -- admin Mac
                |             untagged/native VLAN 10 Management
                |             Mac 192.168.10.2/24, no default gateway
                |-- pilot-infra VM, Proxmox tag 20
                |             VLAN 20 Infrastructure 192.168.20.0/24
                `-- pilot-k8s VM, Proxmox tag 30
                              VLAN 30 Kubernetes 192.168.30.0/24
```

“VLAN 10 Management” is the canonical name even though it is carried
untagged/native during this no-switch pilot. VLAN 20 and VLAN 30 are tagged on
the OPNsense LAN parent. Proxmox applies tag 20 or 30 to the corresponding test
VM NIC. The admin Mac is the untagged management client over its direct
Ethernet cable to `nic1`.

| Network                  | CIDR              | OPNsense gateway | Pilot client                                 |
| ------------------------ | ----------------- | ---------------- | -------------------------------------------- |
| Existing LAN (unchanged) | `192.168.68.0/22` | `192.168.68.1`   | OPNsense WAN and rollback access             |
| VLAN 10 Management       | `192.168.10.0/24` | `192.168.10.1`   | Admin Mac `192.168.10.2`, untagged on `nic1` |
| VLAN 20 Infrastructure   | `192.168.20.0/24` | `192.168.20.1`   | `pilot-infra` tagged VM                      |
| VLAN 30 Kubernetes       | `192.168.30.0/24` | `192.168.30.1`   | `pilot-k8s` tagged VM                        |

The admin Mac starts at `192.168.10.2/24` with no Ethernet default gateway and
keeps Wi-Fi connected as the rollback path. VLAN 20 and VLAN 30 test VMs may
use static addresses or bounded OPNsense DHCP scopes. Any DHCP scope must
advertise the interface gateway and AdGuard `192.168.68.10` as the only DNS
server. It must not advertise OPNsense, Technitium, an ISP resolver, or a
public resolver as client DNS.

Later Mac DHCP or Internet testing is permitted only with a recorded route
guard: Wi-Fi must remain the active default route before and after the test.
Use target-specific routes through `192.168.10.1` for pilot validation rather
than silently replacing the rollback route. If DHCP changes the Mac default
route, stop and restore the static no-gateway Ethernet configuration before
continuing.

## Policy

Rules are evaluated on the interface where traffic enters OPNsense. Keep the
automatically required DHCP rules if DHCP is enabled, then apply these
principles:

1. Permit TCP and UDP port 53 from each pilot network to AdGuard
   `192.168.68.10`.
2. Reject and log TCP and UDP port 53 from each pilot network to every other
   destination. The explicit rejection makes DNS bypass tests fail quickly.
3. Permit only the minimum non-DNS egress needed for pilot updates and
   verification.
4. Permit OPNsense administration only from VLAN 10 Management.
5. Add no general allow rule between VLAN 10, VLAN 20, and VLAN 30.
6. End each interface policy with a logged deny. Inter-VLAN traffic is denied
   unless a later, documented test exception is placed above it.

The DNS policy enforces classic DNS on TCP/UDP 53. Blocking DNS-over-TLS,
DNS-over-HTTPS, VPNs, and other tunnels is a separate design problem and is
not claimed by this pilot.

OPNsense must not expose its web UI or SSH on WAN. The pilot WAN rule set adds
no inbound allow from the existing LAN. Administration is performed from the
admin Mac on VLAN 10 or from the OPNsense console.

## Required proof

The pilot is successful only when evidence records all of the following:

- Existing LAN clients still use TP-Link and can reach `pve01`, AdGuard,
  Technitium, and the Internet exactly as before.
- The Cloudflare Tunnel path still reaches the Proxmox UI and `infra01`.
- The admin Mac uses `192.168.10.2/24` on direct Ethernet with no Ethernet
  default gateway, can reach `192.168.10.1`, and retains Wi-Fi as its default
  route.
- Each tagged test VM receives or uses the correct `/24` address and `.1`
  gateway.
- Each test client resolves public and lab names through
  `192.168.68.10`.
- Direct UDP and TCP queries to at least two external resolvers fail from every
  pilot network, while the same names resolve through AdGuard.
- Attempts between VLAN 10, VLAN 20, and VLAN 30 fail unless they are an
  explicitly documented temporary test exception.
- OPNsense administration succeeds from VLAN 10 and fails from VLAN 20,
  VLAN 30, and WAN.
- Firewall logs show the expected DNS-bypass and segmentation denies.
- The same proofs pass after an orderly OPNsense reboot, including the Mac
  Wi-Fi default-route guard.

Passing tests establish pilot behavior only. They do not mean OPNsense is the
live edge or that existing services have migrated.

## Rollback boundary

Rollback is to power off OPNsense and the two tagged test VMs, disconnect the
Mac from `nic1`, and restore the Mac Ethernet service to its recorded preflight
state. Wi-Fi and the unchanged `vmbr0` live path remain available throughout.
Because no live client uses OPNsense and no TP-Link setting changes, these
actions remove the pilot data path. If cleanup is approved, remove only the
pilot VM, the two test VMs, and pilot `vmbr1`/`nic1` configuration after
exporting the OPNsense configuration and test evidence.

Rollback must not:

- alter `vmbr0`, the TP-Link gateway, or live DHCP;
- assign a Proxmox host IP or gateway to `vmbr1`;
- renumber or move `pve01`, AdGuard, Technitium, or `infra01`;
- disable the Proxmox host firewall or Cloudflare Tunnel; or
- delete existing DNS records, tunnel routes, or guest definitions.

## Explicitly out of scope

This phase includes no DNS migration, TP-Link edge cutover, physical-switch
VLAN configuration, NetBird, IPv6 design, Vault, Kubernetes deployment, or
production workloads. The approved execution order remains:

1. OPNsense VLAN Pilot
2. DNS migration (AdGuard + Technitium)
3. NetBird remote access
4. Vault

Each later step requires its own design, implementation approval, tests, and
rollback plan.
