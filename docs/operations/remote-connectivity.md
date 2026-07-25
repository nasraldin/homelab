# Remote connectivity from the Mac (SSH, RDP, desktop tools)

How the **Mac control plane** reaches Linux and Windows guests, Proxmox, and
(optionally) the lab from away-from-home. Prefer **LAN or an outbound mesh /
Tunnel** — never expose RDP or SSH on the WAN.

**Away from home and need a shell into the lab?** Start with
[infra01-remote-access.md](infra01-remote-access.md) (`ssh infra01` via
Cloudflare Access). **New laptop that has never been on home Wi‑Fi:** use the
[New local machine (outside the lab)](infra01-remote-access.md#new-local-machine-outside-the-lab)
section there. Do not open WAN `:22` or assume `192.168.68.x` is reachable
from the internet.

| Already in this lab    | Doc                                                                          |
| ---------------------- | ---------------------------------------------------------------------------- |
| Proxmox UI + Access    | Cloudflare Tunnel (`homelab.nasraldin.com`)                                  |
| Operator SSH (off-LAN) | [infra01-remote-access.md](infra01-remote-access.md) (`infra.nasraldin.com`) |
| Guest console          | OpsHub / Proxmox noVNC (break-glass)                                         |
| Mesh VPN (optional)    | NetBird — ⏳ not required for day-to-day LAN                                 |

## Lab policy (locked)

| Rule                                                 | Why                                                 |
| ---------------------------------------------------- | --------------------------------------------------- |
| No router port-forward for `:22` / `:3389`           | Attack surface; Tunnel/mesh instead                 |
| SSH for headless Linux (GitLab, Vault, DNS, runners) | Idempotent, scriptable, Ansible                     |
| RDP / desktop tools only for **GUI** guests          | Windows VMs, Ubuntu Desktop labs                    |
| Proxmox console = break-glass                        | Prefer guest SSH/RDP once the OS is up              |
| Self-host or private path for “unattended” desktop   | Avoid vendor-only relays for secrets-adjacent hosts |

## Choose by workload

| Target                        | From Mac (on LAN)              | From away                                |
| ----------------------------- | ------------------------------ | ---------------------------------------- |
| Proxmox UI                    | Browser → Tunnel hostname      | Same (Access)                            |
| `infra01` / Debian servers    | SSH                            | SSH via Tunnel Access                    |
| Windows VM                    | **Windows App** (RDP)          | RDP only over NetBird/VPN (when enabled) |
| Ubuntu **Desktop** GUI        | RDP (GNOME) or NoMachine       | Same, over mesh — not public `:3389`     |
| Mixed Linux + Windows + phone | **RustDesk** (self-host later) | RustDesk relay or mesh                   |
| “Just see the VM boot”        | Proxmox noVNC / OpsHub         | Tunnel → Proxmox                         |

### Tool comparison (Mac as client)

| Software                                   | Windows guest        | Linux GUI        | macOS peer       | Self-host / private | Notes                                  |
| ------------------------------------------ | -------------------- | ---------------- | ---------------- | ------------------- | -------------------------------------- |
| **SSH**                                    | via OpenSSH optional | ✅ primary       | ✅               | N/A                 | Default for servers                    |
| **Windows App** (Microsoft Remote Desktop) | ✅ best RDP          | GNOME RDP / xrdp | Client only      | Use LAN or mesh     | Free; native RDP quality               |
| **RustDesk**                               | ✅                   | ✅               | ✅               | ✅ relay/server     | Best single cross-platform FOSS tool   |
| **NoMachine**                              | ✅                   | ✅ excellent     | ✅               | Local / NX          | Strong Linux desktop performance       |
| AnyDesk                                    | ✅                   | ✅               | ✅               | Limited free        | Easy; licensing for heavy use          |
| RealVNC / VNC                              | ✅                   | ✅               | ✅               | Partial             | Fine for compatibility; usually slower |
| Remmina                                    | ✅                   | ✅               | ❌ no native Mac | —                   | Use on a Linux operator, not the Mac   |

**Recommendation for this homelab**

1. **Servers (Debian cloud images):** SSH only — Ansible already owns them.
2. **Windows VMs on Proxmox:** Windows App (RDP) on the Mac.
3. **Ubuntu Desktop / GNOME labs:** enable GNOME Remote Desktop, connect with Windows App; use **NoMachine** if you need smoother video.
4. **One tool for mixed OS + unattended:** **RustDesk**, with a self-hosted relay when you care about privacy (pair with NetBird later for underlay).

Tailscale is **not** the lab default (NetBird is the optional mesh). The pattern is the same: mesh first, then RDP/SSH on private addresses.

---

## Path A — Windows App → Ubuntu GNOME (Proxmox VM)

Use when the guest runs **Ubuntu Desktop** with GNOME Remote Desktop (not headless
Debian server images).

### 1. Enable Remote Desktop on Ubuntu

On the Ubuntu VM (local console or existing SSH with a desktop session):

1. **Settings** → **System** → **Remote Desktop**.
2. Enable **Desktop Sharing** (current session) and/or **Remote Login** (login
   screen), depending on Ubuntu version.
3. Set username / password for RDP.
4. Note port: usually **3389**. If both modes are enabled, Desktop Sharing may
   use **3390** — confirm in the UI.

### 2. Guest IP (bridged `vmbr0`)

```bash
hostname -I
# example lab: 192.168.68.xx
```

Mac must reach the guest on the LAN:

```bash
ping -c 2 192.168.68.xx
```

Proxmox networking: guest NIC on **`vmbr0`** (same as other lab VMs). NAT-only
adapters are harder from the Mac without extra routing.

### 3. Firewall on the guest

```bash
sudo ufw allow 3389/tcp comment 'RDP'
# if Desktop Sharing uses 3390:
sudo ufw allow 3390/tcp comment 'GNOME Desktop Sharing'
sudo ufw reload
```

Do **not** forward these ports on the TP-Link WAN.

### 4. Connect from macOS

1. Open **Windows App** (formerly Microsoft Remote Desktop).
2. **+** → **Add PC**.
3. **PC name:** guest LAN IP (e.g. `192.168.68.120`).
4. User account / password: the Remote Desktop credentials from step 1.
5. Connect.

### 5. Common issues

| Symptom                                    | Check                                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection refused                         | Remote Desktop disabled; wrong IP; UFW; guest not on `vmbr0`                                                                                                                                                   |
| Auth error **0x207** (Windows App ↔ GNOME) | Export `.rdp`, set `use redirection server name:i:1`, re-import ([Ask Ubuntu thread](https://askubuntu.com/questions/1567029/gnome-remote-desktop-with-ubuntu-26-04-and-macosx-tahoe-26-5-and-windows-app-11)) |
| Works on LAN, fails away                   | Expected without NetBird/VPN — use mesh or stay on LAN                                                                                                                                                         |

---

## Path B — Windows App → Windows VM

1. Enable Remote Desktop in Windows (System → Remote Desktop).
2. Allow TCP **3389** in Windows Firewall (private profile).
3. Connect from Windows App to the guest’s `192.168.68.x` address.
4. Away-from-home: only after NetBird (or similar) puts Mac and guest on one
   overlay — still no WAN port forward.

---

## Path C — RustDesk (cross-platform)

**Fit:** one client for Linux GUI, Windows, and mobile; optional self-hosted
`hbbs`/`hbbr` on a lab VM later (not required day-one).

1. Install RustDesk on the Mac and on each GUI guest.
2. For privacy-sensitive hosts, point clients at a **self-hosted** ID/relay
   (document address in Vault when you deploy it).
3. Prefer LAN or NetBird underlay; treat public relay as convenience, not for
   Vault/GitLab operator sessions.

---

## Path D — NoMachine (Linux desktop performance)

Install NoMachine server on the Ubuntu Desktop VM and the Mac client. Use when
GNOME RDP feels laggy (video, IDEs). Same network rules: LAN or mesh only.

---

## Away-from-home matrix

| Need                                | Use                                                                 |
| ----------------------------------- | ------------------------------------------------------------------- |
| Proxmox / OpsHub                    | Cloudflare Tunnel + Access                                          |
| Shell on `infra01`                  | [infra01-remote-access.md](infra01-remote-access.md)                |
| RDP to a Windows/Ubuntu GUI guest   | NetBird (⏳) then Windows App to overlay IP — or wait until home    |
| Unattended desktop without mesh yet | Defer, or self-host RustDesk carefully — do not open `:3389` on WAN |

## Related

- [infra01-remote-access.md](infra01-remote-access.md)
- [mac-dns.md](mac-dns.md) — Mac resolver when AdGuard is down
- [vm-best-practices.md](../architecture/vm-best-practices.md) — guest hardware
- [automation-layers.md](../architecture/automation-layers.md) — Tunnel vs VPN
- [service-placement.md](../architecture/service-placement.md) — what stays a VM
