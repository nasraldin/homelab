# Point TP-Link DHCP DNS at AdGuard

Configure the edge router so **all Wi‑Fi and LAN DHCP clients** use AdGuard for
filtering and `*.lab.nasraldin.com`, with a **public Secondary DNS** so the LAN
stays usable when AdGuard is briefly unavailable.

This lab does **not** automate the TP-Link UI. You change DHCP DNS once in the
router admin console.

**Resilience design (required reading):** [lan-dns-resilience.md](lan-dns-resilience.md)

## What this page covers

- Preconditions and dig proofs before touching the router
- Exact DHCP Primary / Secondary policy
- Post-cutover verification and IPv6 Deco limitations
- Rollback

## Preconditions

1. Guests up and configured: `adguard-01` (`192.168.68.10`), `dns-01`
   (`192.168.68.11`, Technitium) — after Terraform, run
   `ansible-playbook playbooks/dns.yml` (lab-home-k8s) or ansible-lab equivalent.
   Older docs may say `technitium-01`; same IP `.11`.
2. Proofs from any LAN host:

```bash
dig @192.168.68.11 pve01.lab.nasraldin.com +short   # → 192.168.68.13
dig @192.168.68.10 pve01.lab.nasraldin.com +short   # → 192.168.68.13
dig @192.168.68.10 example.com +short               # public names resolve
```

3. UIs (LAN only): `http://192.168.68.10:3000` · `http://192.168.68.11:5380`
4. Record current TP-Link DHCP DNS values for rollback.
5. Optional IPv6 link-local proof (when testing AdGuard IPv6):

```bash
dig @fe80::ff:fe00:10%en0 doubleclick.net +short       # → 0.0.0.0
dig @fe80::ff:fe00:10%en0 pve01.lab.nasraldin.com +short # → 192.168.68.13
```

## TP-Link DHCP DNS (locked policy)

Exact menu labels vary (Deco app / Archer web). Look for **DHCP Server** or
**LAN DNS**.

| Field             | Value             | Why                                           |
| ----------------- | ----------------- | --------------------------------------------- |
| **Primary DNS**   | `192.168.68.10`   | AdGuard — filtering + lab zone forward        |
| **Secondary DNS** | `1.1.1.1`         | Public fallback when AdGuard is down          |
| Technitium `.11`  | **Never** in DHCP | Authoritative only — not a recursive resolver |

Steps:

1. Open TP-Link admin → **Advanced** → **Network** → **DHCP Server** (or **LAN** → **DHCP**).
2. Set Primary and Secondary as in the table above.
3. Save.

Without Secondary DNS, destroying or replacing `adguard-01` takes down name
resolution for **every** DHCP client. See [lan-dns-resilience.md](lan-dns-resilience.md).

## After save

1. Renew leases (reconnect Wi‑Fi, or flush Mac DNS cache, or renew DHCP per device).
2. Verify from a DHCP client:
   - Internet works (public site loads).
   - `dig pve01.lab.nasraldin.com +short` → `192.168.68.13` (system DNS).
   - AdGuard **Query log** shows the client when AdGuard is healthy.
3. Optional: DHCP reservations for `.10` / `.11` by MAC so addresses stay fixed.

`scutil --dns` on the Mac may list both AdGuard and `1.1.1.1` when using DHCP —
that is expected with Secondary set. Prefer AdGuard when it answers; Secondary
is for outages only.

## IPv6 bypass (Deco limitation)

IPv4 DHCP DNS does not override DNS learned via IPv6 router advertisements. If
`scutil --dns` still lists ISP IPv6 resolvers, clients can bypass AdGuard.

AdGuard is prepared for IPv6 DNS:

- Terraform pins MAC `02:00:00:00:00:10`
- Stable link-local: `fe80::ff:fe00:10`
- UFW allows TCP/UDP 53 from `fe80::/10`

### Router options (when the UI exposes them)

1. Primary IPv6 DNS / RDNSS → `fe80::ff:fe00:10`
2. Or disable IPv6 DNS advertisement on the LAN
3. Or temporarily disable IPv6 on the LAN

Do not advertise a public IPv6 resolver as the only IPv6 DNS if you want
filtering on IPv6 clients.

### Accepted workaround (Deco has no IPv6 DNS UI) — 2026-07-23

Pin the **admin Mac** to AdGuard so system queries ignore ISP IPv6 resolvers:

```bash
networksetup -setdnsservers Wi-Fi 192.168.68.10
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

scutil --dns | grep nameserver
dig pve01.lab.nasraldin.com +short      # → 192.168.68.13
dig doubleclick.net +short              # → 0.0.0.0
```

Before replacing DNS VMs, switch the Mac to public DNS first:

```bash
~/homelab/ansible-lab/scripts/dns-failover-public.sh
# equivalent: sudo networksetup -setdnsservers "Wi-Fi" 1.1.1.1 1.0.0.1
```

Return to AdGuard (or DHCP) after `dns.yml`:

```bash
~/homelab/ansible-lab/scripts/dns-restore-adguard.sh
# or: networksetup -setdnsservers Wi-Fi Empty   # inherit DHCP again
```

Full Mac command reference (`scutil`, DHCP vs manual, flush cache):
[mac-dns.md](mac-dns.md).

**Boundary:** phones / IoT on Deco DHCP may still learn ISP IPv6 resolvers until
firmware exposes RDNSS controls or the edge is replaced.

## Rollback

Restore previous Primary/Secondary DNS on the TP-Link DHCP page and renew
leases. AdGuard/Technitium VMs can remain up for manual `dig @192.168.68.10 …`.

## After cutover is stable

Remove interim `/etc/hosts` lab duplicates that DNS now owns (keep break-glass
entries only). See [network-dns-ingress.md](../architecture/network-dns-ingress.md).

## Related

- [lan-dns-resilience.md](lan-dns-resilience.md) — outage modes, autostart, replace runbook
- [ansible-lab docs/dns.md](https://github.com/nasraldin/ansible-lab/blob/main/docs/dns.md)
- [network-dns-ingress.md](../architecture/network-dns-ingress.md)
- [guest-vmid-map.md](guest-vmid-map.md)
