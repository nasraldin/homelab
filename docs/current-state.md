# Where things stand today

Status board for the live lab. Build narrative: [build-story.md](build-story.md).
Work order: [foundation sequence](roadmap/foundation-sequence.md).

## In one paragraph

**Dev Homelab** on `pve01` is the **`lab-home-k8s`** topology (kubeadm + GitOps),
not the older terraform-lab multi-VM map. **2026-07-30 cutover is live**: DNS
LXCs `.10`/`.11`, Infisical `.25`, jumpbox `.14`, docker-01 apps, **Ollama on
`llm-01`** (CT 125 `.26`, ROCm/GPU verified); **`ai-01`** stays stopped as
standby. Purpose namespaces are live in-cluster — see
[`lab-home-gitops/docs/namespace-taxonomy.md`](../lab-home-gitops/docs/namespace-taxonomy.md).

| | |
| --- | --- |
| **Node** | `pve01` · `192.168.68.13/22` · Proxmox VE |
| **Inventory** | [lab-home-inventory.md](operations/lab-home-inventory.md) |
| **Public GitLab** | `https://gitlab.nasraldin.com` (LAN `.15`) |
| **DNS (target)** | DHCP Primary → AdGuard `.10`; Technitium on `dns-01` `.11` |
| **Restructure** | [lab-restructure-2026-07-30.md](operations/lab-restructure-2026-07-30.md) |

## What this page covers

- Hardware / storage
- What is done vs staged vs on hold
- Next tasks
- Locked decisions

---

## Hardware (installed)

| Slot | Disk | Role | Status |
| ---- | ---- | ---- | ------ |
| 1 | Samsung 990 PRO 2 TB | `rpool` — Proxmox OS | Done |
| 2 | Kingston FURY Renegade 4 TB | `data01` — guest disks | Done |
| 3 | OEM 2 TB | `aux01` — backups / ISO | On hold — not installed |

Details: [hardware and storage](architecture/hardware-and-storage.md).

---

## What is done / staged

| Area | State |
| ---- | ----- |
| Proxmox foundation | Done (`rpool`, `data01`, bootstrap, Tunnel patterns) |
| lab-home-k8s guests | **Restructure live** 2026-07-30 (DNS/Infisical/docker/jumpbox/llm-01) |
| DNS LXCs `.10`/`.11` | **Live** (AdGuard + Technitium); TP-Link DHCP → `.10` still TBD |
| Infisical `.25` | **Live** on `infisical-01`; InfisicalSecret `hostAPI` → `.25:8090`; UA seed still TBD |
| docker-01 as app host | **Live** — NPM, Stalwart, AIStor, Dockhand, Portainer |
| Ollama on `llm-01` | **Live** (CT 125 `.26`, ROCm/`ollama ps` GPU); `ai-01` standby |
| GitOps namespaces | **Live** purpose NS; old NS pruned |
| Platform fixes | MariaDB CRDs, LibreChat Recreate, Kyverno cleanup image, runner hostAliases/KEDA — in GitOps |
| Infisical universal-auth seed | **Still TBD** for full InfisicalSecret sync |

Alternate **terraform-lab** inventory remains documented under
[guest-vmid-map.md](operations/guest-vmid-map.md) but is **not** the live home map.

---

## On hold

| Task | Why |
| ---- | --- |
| Storage `aux01` | OEM NVMe not in chassis |
| Live restructure cutover | Waiting on `pve01` / LAN reachability |
| OPNsense / VLANs | Flat LAN for now (`archive/opnsense-vlan-pilot`) |

---

## What comes next

1. Recover `pve01` → execute [lab-restructure-2026-07-30](operations/lab-restructure-2026-07-30.md) checklist
2. Verify `llm-01` GPU → retire `ai-01` when stable
3. Finish Infisical universal-auth + seed
4. Confirm Argo apps Healthy in taxonomy namespaces; delete empty old NS

---

## Locked decisions

| Topic | Choice |
| ----- | ------ |
| Hypervisor | Proxmox VE 9.x on ZFS |
| Guest disks | Only on `data01` |
| Kubernetes | kubeadm on Debian VMs (`lab-home-k8s`) |
| GitOps | Argo CD + `lab-home-gitops` |
| GitLab | Dedicated VM — not in k8s |
| Ollama | LXC `llm-01` + host `amdgpu` (not VFIO primary) |
| App secrets | Infisical LXC; Vault optional/parallel for infra crypto |
| Namespaces | Purpose-grouped — not one NS per app |

## Related

- [service-placement.md](architecture/service-placement.md)
- [lab-home-k8s/README.md](../lab-home-k8s/README.md)
