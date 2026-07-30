# Mac DNS quick reference (control plane)

How to see **why** the Mac uses `192.168.68.14`, how to fail over to public DNS
when AdGuard Home is down, and how to return to lab DNS. This is the admin
Mac path — not phone/TV DHCP (those follow the router).

**Lab facts**

| Address               | What it is in _this_ lab                                |
| --------------------- | ------------------------------------------------------- |
| `192.168.68.1`        | TP-Link gateway / DHCP                                  |
| `192.168.68.14`       | **AdGuard Home** (`adguard-01`) — DHCP Primary          |
| `192.168.68.11`       | Technitium (authoritative only — do not set as Mac DNS) |
| `192.168.68.12`       | Jumpbox `ssh-01` (not DNS)                              |
| `1.1.1.1` / `1.0.0.1` | Cloudflare public resolvers (failover)                  |

Scripts (same actions): `ansible-lab/scripts/dns-failover-public.sh` ·
`dns-restore-adguard.sh`. Design: [lan-dns-resilience.md](lan-dns-resilience.md).

## If `scutil --dns` shows AdGuard

Example:

```text
nameserver[0] : 192.168.68.14
```

(macOS may list the same server more than once across resolvers.) The Mac is
using AdGuard Home as its recursive DNS. That is normal when healthy.

## 1. Where does that DNS come from?

```bash
networksetup -listallnetworkservices
# Use the active service — usually "Wi-Fi"
networksetup -getdnsservers "Wi-Fi"
```

| Output                                       | Meaning                                            |
| -------------------------------------------- | -------------------------------------------------- |
| `192.168.68.14` (or a list of IPs)           | **Manual** override on that interface              |
| `There aren't any DNS Servers set on Wi-Fi.` | DNS comes from **DHCP** (router Primary/Secondary) |

Also useful:

```bash
networksetup -getinfo "Wi-Fi"
ipconfig getpacket en0 | grep domain_name_server
# DHCP often advertises 192.168.68.14 (and ideally 1.1.1.1 as secondary)
```

Hardware / which interface is live:

```bash
networksetup -listallhardwareports
ifconfig | grep "status: active" -B2
```

## 2. Quick change (failover / restore)

**Public DNS (when AdGuard is down or being replaced):**

```bash
sudo networksetup -setdnsservers "Wi-Fi" 1.1.1.1 1.0.0.1
# or: ~/homelab/ansible-lab/scripts/dns-failover-public.sh
```

**Google (optional alternative):**

```bash
sudo networksetup -setdnsservers "Wi-Fi" 8.8.8.8 8.8.4.4
```

**Back to AdGuard Home (pinned):**

```bash
sudo networksetup -setdnsservers "Wi-Fi" 192.168.68.14
# or: ~/homelab/ansible-lab/scripts/dns-restore-adguard.sh
```

**Back to DHCP** (inherit router Primary + Secondary):

```bash
sudo networksetup -setdnsservers "Wi-Fi" Empty
```

Prefer **Empty** (DHCP) day-to-day once the router has Secondary `1.1.1.1`.
Pin to `.10` only when you need to ignore ISP IPv6 resolvers (Deco limitation)
— see [dns-dhcp-cutover.md](dns-dhcp-cutover.md).

## 3. Flush cache after changes

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
scutil --dns | grep nameserver
dig pve01.lab.nasraldin.com +short    # → 192.168.68.13 when lab DNS works
dig example.com +short                # public name
```

## 4. AdGuard _for Mac_ vs AdGuard Home

| Product                   | Role here                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| **AdGuard Home** on `.10` | Lab LAN resolver (this design)                                                             |
| **AdGuard for Mac** (app) | Optional — if installed, **DNS Protection** can intercept DNS regardless of `networksetup` |

If the app is installed: disable **Settings → DNS Protection** temporarily, then
re-check `scutil --dns`. Do not confuse the Mac app with the `adguard-01` VM.

## 5. Decision tree

```text
scutil shows 192.168.68.14
        │
        ├─ getdnsservers lists .10     → manual pin (failover script undoes it)
        ├─ getdnsservers = Empty       → DHCP from TP-Link (Primary AdGuard)
        └─ still .10 after Empty + flush
                 └─ check AdGuard for Mac DNS Protection, or IPv6 path
```

## Collect for debugging

```bash
networksetup -getdnsservers "Wi-Fi"
scutil --dns
networksetup -listallhardwareports
ifconfig | grep "status: active" -B2
ipconfig getpacket en0 | grep domain_name_server
```

Confirm: AdGuard Home VM at `.10` (not the router), and whether AdGuard for Mac
is installed.

## 6. `/etc/resolver/lab` (critical for `*.lab`)

macOS can keep a **scoped** resolver for domain `lab` in `/etc/resolver/lab`.
After the 2026-07-30 restructure that file must point at AdGuard (`.10`), not the
old infra DNS (`.14`). If it still says `.14`, `dig @192.168.68.14 chat.lab`
works but `curl http://chat.lab` hangs on “Resolving timed out”.

```bash
# Fix + flush (asks for sudo):
~/homelab/ansible-lab/scripts/mac-resolver-lab.sh

# Or manually:
sudo tee /etc/resolver/lab >/dev/null <<'EOF'
nameserver 192.168.68.14
EOF
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

Verify: `scutil --dns` shows `domain : lab` → `192.168.68.14`, then
`curl -sS -o /dev/null -w '%{http_code}\n' http://chat.lab` → `200`.
