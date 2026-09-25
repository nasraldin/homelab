# Design Network, DNS, and Ingress for One Homelab Node

The live lab is a single Proxmox node on a flat LAN behind TP-Link. DNS is
AdGuard (filtering) + Technitium (authoritative `lab.nasraldin.com`). Remote
Proxmox UI and `infra01` SSH use Cloudflare Tunnel + Access. An OPNsense VLAN
pilot was proven then archived (2026-07-23) to keep this stage simple.

## What this page covers

- Current LAN bridge layout (flat `vmbr0`)
- Filtering vs authoritative vs public DNS roles
- Kubernetes ingress controller and cert-manager path
- Internal (`*.lab.nasraldin.com`) vs public (`*.nasraldin.com`) naming

## Network (today)

- Flat LAN `192.168.68.0/22`, bridge `vmbr0`, gateway `192.168.68.1`
- TP-Link remains the edge router and DHCP gateway
- `pve01` is `192.168.68.10`; AdGuard is **`.14`** on lab-home-k8s (CT `adguard-01`)
  or **`.13`** on terraform-lab (VM `adguard-01`); Technitium **`.11`** (`dns-01` /
  `technitium-01`)
- Remote Proxmox UI and `infra01` SSH: Cloudflare Tunnel + Access (no WAN ports)
- Mac admin path: Wi-Fi on the live LAN (no Ethernet requirement)

## Archived OPNsense VLAN pilot

A bounded OPNsense + `vmbr1`/`nic1` pilot validated VLAN segmentation and
DNS-enforcement in July 2026, then was removed from the live node and from
`main` so the lab stays flat. Recovery snapshot:
`archive/opnsense-vlan-pilot` in `homelab`, `terraform-lab`, `ansible-lab`, and
`proxmox-bootstrap`. Reintroduce only when you need real VLAN / firewall
practice (typically with Kubernetes).

## DNS (decided)

| Layer                  | Tool                                      | Role                                                                                                                                      | Status |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Filtering              | **AdGuard Home**                          | LAN resolver — ads, trackers, forward lab zone                                                                                            | ✅     |
| Authoritative internal | **Technitium DNS**                        | `lab.nasraldin.com` zone only                                                                                                             | ✅     |
| Public                 | **Cloudflare**                            | Public names + Tunnel                                                                                                                     | ✅     |
| In-cluster             | **ExternalDNS**                           | K8s → DNS records                                                                                                                         | ⏳     |
| Router DHCP DNS        | **TP-Link → AdGuard + Secondary 1.1.1.1** | Primary = AdGuard (`.14` lab-home / `.13` terraform-lab); **never** pve `.10` — [lan-dns-resilience](../operations/lan-dns-resilience.md) | ✅     |

**Not Pi-hole** — AdGuard chosen for UI and modern DNS privacy features.

**Topology:** Clients → AdGuard (`192.168.68.14`) → forward `lab` / `lab.nasraldin.com` to Technitium (`192.168.68.11`); everything else → Cloudflare `1.1.1.1`. DHCP Secondary `1.1.1.1` keeps the LAN online when AdGuard is unreachable. No jumpbox — SSH directly to guests.

| Host          | IP / VMID                            | Notes                                                  |
| ------------- | ------------------------------------ | ------------------------------------------------------ |
| adguard-01    | `.14` lab-home / `.13` terraform-lab | UI `:3000`; DHCP Primary; never collide with pve `.10` |
| technitium-01 | `.11`                                | UI `:5380`; authoritative only                         |
| pve01         | `.10`                                | Hypervisor; Technitium zone + Tunnel connector         |

**Interim:** `/etc/hosts` on Mac + node for break-glass until [DHCP cutover](../operations/dns-dhcp-cutover.md) is verified, then remove lab duplicates DNS owns.

Example internal names: `gitlab.lab.nasraldin.com`, `grafana.lab.nasraldin.com`, `argocd.lab.nasraldin.com`.

**Ops:** Autostart, outage modes, and replace runbooks —
[lan-dns-resilience.md](../operations/lan-dns-resilience.md).

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

IPv4 DHCP must use **Primary** AdGuard `.10` and **Secondary** `1.1.1.1` —
[dns-dhcp-cutover.md](../operations/dns-dhcp-cutover.md) ·
[lan-dns-resilience.md](../operations/lan-dns-resilience.md). Finish IPv6 RDNSS
when Deco exposes it so clients cannot bypass AdGuard on IPv6. Do not replace
the TP-Link edge until a later deliberate design; OPNsense remains archived.
