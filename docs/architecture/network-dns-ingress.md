# Design Network, DNS, and Ingress for One Homelab Node

Today the lab is a single Proxmox node on a flat LAN — no VLANs yet. Remote
Proxmox UI and `infra01` SSH use Cloudflare Tunnel + Access. This page records
the DNS and ingress choices so Mac hosts files, public names, and in-cluster
routing stay consistent as guests land.

## What this page covers

- Current LAN bridge layout and deferred VLANs
- Filtering vs authoritative vs public DNS roles
- Kubernetes ingress controller and cert-manager path
- Internal (`*.lab.nasraldin.com`) vs public (`*.nasraldin.com`) naming

## Network (today)

- Flat LAN `192.168.68.0/22`, bridge `vmbr0`, gateway `192.168.68.1`
- **VLANs deferred** — enable when guest count warrants segmentation
- Remote Proxmox UI and `infra01` SSH: Cloudflare Tunnel + Access (no WAN ports)

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

When dig proofs are green, apply [dns-dhcp-cutover.md](../operations/dns-dhcp-cutover.md) on the TP-Link so DHCP clients use AdGuard.
