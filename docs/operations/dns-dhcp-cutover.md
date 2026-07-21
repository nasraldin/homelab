# Point TP-Link DHCP DNS at AdGuard

After AdGuard + Technitium pass dig proofs, change the router so **all Wi‑Fi/LAN DHCP clients** (phones, laptops, TVs, IoT) use AdGuard for ad-blocking and `*.lab.nasraldin.com`. No per-device setup.

You click Save on the router; this lab does **not** automate TP-Link login/API.

## Preconditions

Before touching the router:

1. VMs up: `adguard-01` `192.168.68.10`, `technitium-01` `192.168.68.11`
2. Proofs from a Mac (or any LAN host):

```bash
dig @192.168.68.11 pve01.lab.nasraldin.com +short   # → 192.168.68.13
dig @192.168.68.10 pve01.lab.nasraldin.com +short   # → 192.168.68.13
dig @192.168.68.10 example.com +short               # public names resolve
```

3. UIs reachable on LAN only: `http://192.168.68.10:3000` · `http://192.168.68.11:5380`
4. **Write down** the current TP-Link DHCP DNS values (rollback).

## TP-Link steps (Deco / Archer menus vary)

Exact labels differ by firmware; look for **DHCP Server** or **LAN DNS**.

1. Log into the TP-Link admin UI (Deco app / Archer web UI).
2. Open **Advanced** → **Network** → **DHCP Server** (or **LAN** → **DHCP**).
3. Set **Primary DNS** = `192.168.68.10` (adguard-01).
4. Set **Secondary DNS** = **empty** (preferred).  
   Last resort only: a public resolver (e.g. `1.1.1.1`).  
   **Never** put Technitium `192.168.68.11` here — it is authoritative for the lab zone only, not a general recursive resolver for clients.
5. Save.

## After save

1. Renew leases: reconnect Wi‑Fi, or `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` on Mac, or renew DHCP on each device.
2. Verify from a **DHCP** Mac and a phone:
   - `scutil --dns | grep nameserver` lists AdGuard and no ISP/public resolver
   - `dig pve01.lab.nasraldin.com +short` → `192.168.68.13` (no `@` — uses system DNS)
   - Internet works (e.g. open a news site)
   - AdGuard **Query log** shows the client and blocked ads
3. Devices with **static DNS** — point them at `192.168.68.10` or switch back to DHCP.
4. Optional: DHCP reservations for `.10` / `.11` by MAC on the router so addresses stay fixed.

## IPv6 bypass check

Changing IPv4 DHCP does not override DNS servers advertised through IPv6 router
advertisements. If `scutil --dns` still lists ISP IPv6 resolvers, clients can
bypass AdGuard and `dig pve01.lab.nasraldin.com` may return the public wildcard.
The cutover is not complete.

Use one router-supported option:

1. Configure TP-Link IPv6 DNS to a stable IPv6 address on `adguard-01`, after
   explicitly making that address stable and allowing TCP/UDP 53 in the guest.
2. Disable the router's IPv6 DNS advertisement if the firmware exposes that
   setting.
3. Disable IPv6 on the LAN only as a temporary fallback.

Do not advertise a public IPv6 resolver as Secondary DNS. Renew the client lease
and repeat the no-`@` query before declaring the cutover complete.

## Rollback

Restore the previous Primary/Secondary DNS on the TP-Link DHCP page and renew leases. AdGuard/Technitium VMs stay up for manual `dig @192.168.68.10 …`.

## After cutover is stable

Remove interim `/etc/hosts` lab duplicates on Mac/node that DNS now owns (keep only entries you still need for break-glass). See [network-dns-ingress.md](../architecture/network-dns-ingress.md).

## Related

- Ansible guest config: [ansible-lab docs/dns.md](https://github.com/nasraldin/ansible-lab/blob/main/docs/dns.md)
- Architecture: [network-dns-ingress.md](../architecture/network-dns-ingress.md)
