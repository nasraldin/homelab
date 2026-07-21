# Design Network, DNS, and Ingress for One Homelab Node

The live lab remains a single Proxmox node on a flat LAN. The bounded OPNsense
VLAN pilot is approved/in progress and documented, but its infrastructure is
not deployed. Remote Proxmox UI and `infra01` SSH continue to use Cloudflare
Tunnel + Access. This page separates the live state from the pilot so planned
segmentation is not mistaken for a completed cutover.

## What this page covers

- Current LAN bridge layout and bounded VLAN pilot
- Filtering vs authoritative vs public DNS roles
- Kubernetes ingress controller and cert-manager path
- Internal (`*.lab.nasraldin.com`) vs public (`*.nasraldin.com`) naming

## Network (today)

- Flat LAN `192.168.68.0/22`, bridge `vmbr0`, gateway `192.168.68.1`
- TP-Link remains the edge router and DHCP gateway
- `pve01` remains `192.168.68.13`; AdGuard remains `192.168.68.10`;
  Technitium remains `192.168.68.11`
- Remote Proxmox UI and `infra01` SSH: Cloudflare Tunnel + Access (no WAN ports)

## OPNsense VLAN pilot (approved, not deployed)

The approved pilot attaches OPNsense WAN to unchanged `vmbr0`. Its LAN NIC
attaches to VLAN-aware `vmbr1`, which is bound to spare physical `nic1` and has
no Proxmox host IP or gateway. The admin Mac connects directly to `nic1` for
untagged/native management; two disposable VMs test tags 20 and 30:

| Pilot segment          | CIDR              | Gateway        | Carriage                 |
| ---------------------- | ----------------- | -------------- | ------------------------ |
| VLAN 10 Management     | `192.168.10.0/24` | `192.168.10.1` | untagged/native in pilot |
| VLAN 20 Infrastructure | `192.168.20.0/24` | `192.168.20.1` | tagged 20                |
| VLAN 30 Kubernetes     | `192.168.30.0/24` | `192.168.30.1` | tagged 30                |

“VLAN 10 Management” remains its canonical name even though the no-switch
pilot carries it untagged/native to the Mac at `192.168.10.2/24`. The Mac
starts with no Ethernet default gateway and keeps Wi-Fi as the rollback path.
Later DHCP or Internet testing must prove Wi-Fi remains the default route or
stop and restore the static no-gateway configuration.

Both OPNsense virtual NICs must have their Proxmox firewall flags disabled
during the pilot; the existing Proxmox datacenter and node firewall stay
enabled. `vmbr0` and every live LAN address remain unchanged.

OPNsense uses default-deny segmentation. Pilot clients may send TCP/UDP 53
only to AdGuard `192.168.68.10`; direct external TCP/UDP 53 is rejected and
tested from every segment. DNS-over-HTTPS and other tunneling controls are not
claimed by this phase.

Design and rollback boundary:
[OPNsense VLAN pilot](../superpowers/specs/2026-07-21-opnsense-vlan-pilot-design.md).
Procedure: [pilot runbook](../operations/opnsense-vlan-pilot.md).

The pilot does not migrate DNS, replace the TP-Link edge, introduce NetBird or
IPv6, deploy Vault, or host Kubernetes/production workloads. Powering off the
pilot VM and the two test VMs, then disconnecting the Mac from `nic1`, removes
its data path while Wi-Fi, the existing LAN, and Cloudflare Tunnel remain the
rollback path.

## DNS (decided)

| Layer                  | Tool               | Role                                            | Status |
| ---------------------- | ------------------ | ----------------------------------------------- | ------ |
| Filtering              | **AdGuard Home**   | LAN resolver — ads, trackers, forward lab zone  | ✅     |
| Authoritative internal | **Technitium DNS** | `lab.nasraldin.com` zone only                   | ✅     |
| Public                 | **Cloudflare**     | Public names + Tunnel                           | ✅     |
| In-cluster             | **ExternalDNS**    | K8s → DNS records                               | ⏳     |
| Router DHCP DNS        | **TP-Link → .10**  | IPv4 set; AdGuard IPv6 ready; router RDNSS next | ⏳     |

**Not Pi-hole** — AdGuard chosen for UI and modern DNS privacy features.

**Topology:** Clients → AdGuard (`192.168.68.10`) → forward `lab.nasraldin.com` to Technitium (`192.168.68.11`); everything else → Cloudflare `1.1.1.1`.

| Host           | IP              | Notes                                            |
| -------------- | --------------- | ------------------------------------------------ |
| adguard-01     | `192.168.68.10` | UI `:3000`; IPv6 DNS `fe80::ff:fe00:10`          |
| technitium-01  | `192.168.68.11` | Debian 13 VM, UI `:5380`                         |
| infra01        | `192.168.68.12` | Operator VM; Access SSH at `infra.nasraldin.com` |
| pve01 (seed A) | `192.168.68.13` | In Technitium zone; Tunnel connector             |

**Interim:** `/etc/hosts` on Mac + node for break-glass until [DHCP cutover](../operations/dns-dhcp-cutover.md) is verified, then remove lab duplicates DNS owns.

Example internal names: `gitlab.lab.nasraldin.com`, `grafana.lab.nasraldin.com`, `argocd.lab.nasraldin.com`.

## Ingress (Kubernetes)

| Choice                       | Status          |
| ---------------------------- | --------------- |
| **NGINX Ingress Controller** | ⏳ planned      |
| ~~Traefik~~                  | ❌ not using    |
| **Gateway API**              | 🔮 after NGINX  |
| **cert-manager**             | ⏳ with Argo CD |

## Naming

| Scope    | Pattern               | Example                    |
| -------- | --------------------- | -------------------------- |
| Internal | `*.lab.nasraldin.com` | `pve01.lab.nasraldin.com`  |
| Public   | `*.nasraldin.com`     | (Cloudflare / Tunnel apps) |

## Cutover

Do not use the OPNsense pilot as authority to change the live edge. After the
pilot is separately verified, the next approved phase is DNS migration
(AdGuard + Technitium), followed by NetBird remote access and then Vault. The
existing [TP-Link DNS runbook](../operations/dns-dhcp-cutover.md) remains a
reference for the unchanged live edge until the DNS-migration phase approves
its replacement or update.
