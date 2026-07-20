# Design Network, DNS, and Ingress for One Homelab Node

Today the lab is a single Proxmox node on a flat LAN — no VLANs yet, remote UI only through Cloudflare Tunnel. This page records the DNS and ingress choices so Mac hosts files, public names, and in-cluster routing stay consistent as guests land.

## What this page covers

- Current LAN bridge layout and deferred VLANs
- Filtering vs authoritative vs public DNS roles
- Kubernetes ingress controller and cert-manager path
- Internal (`*.lab.example.com`) vs public (`*.example.com`) naming

## Network (today)

- Flat LAN `192.168.1.0/24`, bridge `vmbr0`
- **VLANs deferred** — enable when guest count warrants segmentation
- Remote Proxmox UI: Cloudflare Tunnel + Access (no WAN ports on PVE)

## DNS (decided)

| Layer                  | Tool               | Role                                     | Status |
| ---------------------- | ------------------ | ---------------------------------------- | ------ |
| Filtering              | **AdGuard Home**   | Ads, trackers, per-client rules, DoH/DoT | ⏳     |
| Authoritative internal | **Technitium DNS** | `*.lab.example.com` zones, split DNS     | ⏳     |
| Public                 | **Cloudflare**     | `*.example.com`, Tunnel                  | ✅     |
| In-cluster             | **ExternalDNS**    | K8s → DNS records                        | ⏳     |

**Not Pi-hole** — AdGuard chosen for UI and modern DNS privacy features.

**Interim:** `/etc/hosts` on Mac + node for `pve01.lab.example.com`.

Example internal names (future): `gitlab.lab`, `grafana.lab`, `argocd.lab`.

## Ingress (Kubernetes)

| Choice                       | Status          |
| ---------------------------- | --------------- |
| **NGINX Ingress Controller** | ⏳ planned      |
| ~~Traefik~~                  | ❌ not using    |
| **Gateway API**              | 🔮 after NGINX  |
| **cert-manager**             | ⏳ with Argo CD |

## Naming

| Scope    | Pattern             | Example                 |
| -------- | ------------------- | ----------------------- |
| Internal | `*.lab.example.com` | `pve01.lab.example.com` |
| Public   | `*.example.com`     | `grafana.example.com`   |
