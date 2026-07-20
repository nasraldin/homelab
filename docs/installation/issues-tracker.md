# Issues tracker — Phase 0 install

Problems encountered during fresh Proxmox setup. Use this when debugging a
**new node** or comparing drift on `pve01`.

**Status:** `resolved` | `workaround` | `open` | `wont-fix`

---

## Summary

| ID | Title | Status |
| -- | ----- | ------ |
| [INST-001](#inst-001-wrong-disk-selected-at-install) | Wrong disk / USB selected at install | resolved |
| [INST-002](#inst-002-rpool-spanned-both-nvme-disks) | rpool spanned both NVMe disks | resolved |
| [INST-003](#inst-003-boot-failure-after-removing-disk-from-mirror) | Boot failure after disk removal | resolved |
| [INST-004](#inst-004-cloudflare-wildcard-dns-for-lab-names) | Cloudflare wildcard resolves lab names | workaround |
| [INST-005](#inst-005-mac-ping-goes-to-cloudflare) | Mac ping goes to Cloudflare | resolved |
| [INST-006](#inst-006-curl-api-returns-empty--401) | curl API returns empty / 401 | resolved |
| [INST-007](#inst-007-ssh-no-route-to-host) | SSH "No route to host" | resolved |
| [INST-008](#inst-008-ghostty-terminal-on-ssh) | Ghostty `xterm-ghostty` on SSH | workaround |
| [INST-009](#inst-009-root-api-authentication-failure) | root API authentication failure | resolved |
| [INST-010](#inst-010-zsh-bangs-in-api-token-header) | zsh `!` in API token header | resolved |
| [INST-011](#inst-011-grep-deb-on-proxmox-9-sources) | `grep ^deb` on Proxmox 9 sources | resolved |
| [INST-012](#inst-012-zfs-autotrim-off) | ZFS autotrim off | open |
| [INST-013](#inst-013-community-post-pve-install-script) | Community post-pve-install script | resolved |

---

## INST-001: Wrong disk selected at install

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | ZFS advanced showed `hdsize` ~232 GB; not full 2 TB |
| **Root cause** | USB installer (~256 GB) selected instead of Samsung 990 PRO |
| **Fix** | Re-select target by **model name**; confirm size ~1.8–2 TB before Next |
| **Prevention** | [01-install](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/01-install.md) — never pick by `nvme0`/`nvme1` index alone |
| **Verify** | `zpool list rpool` ≈ 1.8T, not 232G |

---

## INST-002: rpool spanned both NVMe disks

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | `zpool status` showed two `nvme-*-part3` members; `rpool` ~3.99 TB |
| **Root cause** | Both SSDs present during install; wrong disk or multi-disk ZFS layout |
| **Fix** | Wipe, reinstall with **only Samsung** in machine; add Kingston after verify |
| **Prevention** | Physical: remove 4 TB during OS install, or verify single disk in summary |
| **Verify** | `zpool status` → one ONLINE member |

---

## INST-003: Boot failure after removing disk from mirror

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | System won't boot after pulling Kingston from degraded pool |
| **Root cause** | Old install expected both pool members |
| **Fix** | Clean USB reinstall on Samsung only (do not repair old pool) |
| **Prevention** | Confirm single-disk `rpool` before adding second disk |

---

## INST-004: Cloudflare wildcard DNS for lab names

| Field | Detail |
| ----- | ------ |
| **Status** | workaround |
| **Symptom** | `dig pve01.lab.example.com` → `203.0.113.x`, `203.0.113.y` |
| **Root cause** | `*.example.com` (or similar) on Cloudflare catches `pve01.lab` |
| **Fix** | Do **not** create public record; use split DNS — `/etc/hosts` now, AdGuard later |
| **Note** | `dig` ignores `/etc/hosts` — use `ping` or `getent ahostsv4` to test local override |
| **Long-term** | AdGuard + Technitium authoritative `*.lab.example.com` — [network-dns-ingress](../architecture/network-dns-ingress.md) |

---

## INST-005: Mac ping goes to Cloudflare

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | `ping pve01.lab.example.com` → `203.0.113.10` (not LAN) |
| **Root cause** | Mac had no `/etc/hosts` override; resolver used public DNS |
| **Fix** | Add to Mac `/etc/hosts`: `192.168.1.10 pve01.lab.example.com pve01` |
| **Verify** | `ping` → `192.168.1.10`; `dscacheutil -q host -a name pve01.lab.example.com` shows `ip_address: 192.168.1.10` |
| **Automated by** | `proxmox-bootstrap` Mac bootstrap (hosts entry if missing) |

---

## INST-006: curl API returns empty / 401

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | `curl -k https://pve01.lab.../api2/json/version` — no JSON body |
| **Root cause** | (a) DNS hit Cloudflare not Proxmox, or (b) **401 No ticket** is normal without auth |
| **Fix** | Fix Mac/node DNS first; interpret `401 No ticket` as success for connectivity |
| **Verify** | `curl -vk` shows `Connected to (192.168.1.10)` and `HTTP/1.1 401 No ticket` |

---

## INST-007: SSH "No route to host"

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | `ssh-copy-id` / `ssh` → `No route to host` |
| **Root cause** | Transient — node booting, wrong IP, or Mac not on same LAN |
| **Fix** | Confirm `ping 192.168.1.10`; wait for install/reboot to finish |
| **Verify** | `ssh root@192.168.1.10` works |

---

## INST-008: Ghostty terminal on SSH

| Field | Detail |
| ----- | ------ |
| **Status** | workaround |
| **Symptom** | `nano`: `Error opening terminal: xterm-ghostty` |
| **Root cause** | Proxmox has no terminfo for Ghostty's `TERM` |
| **Fix** | `TERM=xterm-256color ssh ...` or in `~/.ssh/config`: `SetEnv TERM=xterm-256color` |
| **Alternative** | `apt install ncurses-term` on node (not recommended for minimal host) |

---

## INST-009: root API authentication failure

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | `{"message":"authentication failure"}` on `/access/ticket` |
| **Root cause** | Wrong password in curl (log: `unix_chkpwd: password check failed`) |
| **Fix** | Use correct root password; prefer **token auth** for Terraform, not root |
| **Verify** | Ticket JSON with `username":"root@pam"` |

---

## INST-010: zsh `!` in API token header

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | `zsh: event not found: terraform=...` |
| **Root cause** | zsh history expansion on `!` in double-quoted `-H` string |
| **Fix** | Single quotes: `-H 'Authorization: PVEAPIToken=terraform@pve!provider=SECRET'` |
| **Prevention** | Document in [05-terraform-api](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/05-terraform-api.md); bootstrap uses env for tokens |

---

## INST-011: `grep ^deb` on Proxmox 9 sources

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | `grep -r ^deb /etc/apt/sources.list*` returns nothing |
| **Root cause** | PVE 9 / Debian Trixie uses deb822 `.sources` files, not `deb` lines |
| **Fix** | `ls /etc/apt/sources.list.d/` and `cat *.sources`; check `Enabled: false` on enterprise |
| **Verify** | `apt policy` lists `pve-no-subscription` |

---

## INST-012: ZFS autotrim off

| Field | Detail |
| ----- | ------ |
| **Status** | open |
| **Symptom** | `zpool get autotrim rpool` → `off` |
| **Root cause** | Installer default |
| **Fix** | `zpool set autotrim=on rpool` — applied by `proxmox-bootstrap` when run |
| **Verify** | `zpool get autotrim rpool` → `on` |

---

## INST-013: Community post-pve-install script

| Field | Detail |
| ----- | ------ |
| **Status** | resolved |
| **Symptom** | Used third-party `post-pve-install.sh` from GitHub |
| **Root cause** | Quick repo fix after install |
| **Fix** | Acceptable once; replace with `proxmox-bootstrap` for idempotent ownership |
| **Risk** | Blind `curl \| bash`, non-idempotent, not auditable — see [11-community-comparison](https://github.com/nasraldin/proxmox-bootstrap/blob/main/docs/11-community-comparison.md) |

---

## Adding new issues

When something breaks on a fresh install, add a row:

```markdown
## INST-0XX: Short title

| Field | Detail |
| ----- | ------ |
| **Status** | open / resolved / workaround |
| **Symptom** | What you saw |
| **Root cause** | Why |
| **Fix** | What worked |
| **Verify** | Command to confirm |
```
