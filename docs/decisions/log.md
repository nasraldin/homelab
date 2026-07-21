# Log Every Architecture Decision with a Clear Rationale

Append-only log of architecture choices and the rationale that locked them. Skim this when a later phase tempts a rewrite; the [build story](../build-story.md) and [current state](../current-state.md) summarize the same calls in narrative and checklist form.

Add a row when you make a new architectural choice — don’t rewrite history.

## What this page covers

- Install and storage decisions (USB, ZFS, disks, backups)
- Naming, DNS interim, and public UI via Tunnel
- Automation ownership (bootstrap, Terraform token, update checks)
- Platform stack picks (kubeadm, NGINX, AdGuard/Technitium, GitOps, signing)

| Date    | Decision                                          | Rationale                                                         |
| ------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| 2026-07 | USB install, not PXE                              | Single node; fastest path; ansible-lab for unattended later       |
| 2026-07 | ZFS on Samsung only for `rpool`                   | Separate failure domain; Kingston = `data01` via Terraform        |
| 2026-07 | FQDN `pve01.lab.nasraldin.com`                    | Numbered nodes; internal subdomain under owned domain             |
| 2026-07 | `/etc/hosts` for lab DNS interim                  | Cloudflare wildcard breaks `*.lab`; AdGuard later                 |
| 2026-07 | Public UI at `homelab.nasraldin.com`              | Tunnel + Access; not `pve01.lab` on Cloudflare                    |
| 2026-07 | `terraform@pve!provider` token                    | API automation; not root password                                 |
| 2026-07 | `proxmox-bootstrap` over curl scripts             | Idempotent, owned, auditable                                      |
| 2026-07 | Backups on `local-backup` (990 PRO), not `data01` | Separate failure domain; migrate to aux disk later                |
| 2026-07 | vzdump now, PBS on Dell later                     | Stage 1–2 vzdump; Stage 3 PBS (not 3rd NVMe in X1)                |
| 2026-07 | Doc audit: build-story + current-state            | Single narrative; setup 🔄 status; dedupe index                   |
| 2026-07 | Daily update **check** only (systemd timer)       | User request; production pattern                                  |
| 2026-07 | Shell + systemd over n8n for update check         | Host-native; n8n optional fan-out later                           |
| 2026-07 | Never unattended hypervisor upgrade               | Reboot/guest risk                                                 |
| 2026-07 | AdGuard + Technitium (not Pi-hole alone)          | Filtering vs authoritative DNS                                    |
| 2026-07 | NGINX Ingress (not Traefik)                       | Enterprise familiarity                                            |
| 2026-07 | kubeadm on Debian (not k3s) for primary cluster   | CKA depth, production similarity; staged HA with HAProxy          |
| 2026-07 | Lima (`vz`) for Mac Docker (not Desktop)          | Native perf; Debian arm64; k8s on Proxmox only                    |
| 2026-07 | HAProxy for API VIP; MetalLB optional             | Enterprise LB pattern; Cilium + NGINX in-cluster                  |
| 2026-07 | Fedora CoreOS for OpenShift-style learning        | Separate from Debian general VMs                                  |
| 2026-07 | Talos for immutable k8s (later)                   | Not day-one; after kubeadm + Argo CD                              |
| 2026-07 | Mac as control plane                              | `infra-01` optional later                                         |
| 2026-07 | Kyverno over Gatekeeper for k8s admission         | Kubernetes-native; built-in Cosign verify; Rego optional later    |
| 2026-07 | Cosign keyed signing in CI (not keyless v1)       | Simpler; pre-k8s Vault bootstrap, then Phase 9 ESO integration    |
| 2026-07 | AMD GPU PT: `iommu=pt` only (no `amd_iommu=on`)   | Official Proxmox; AMD IOMMU default-on; 890M AI VMs later         |
| 2026-07 | Cmdline via `/etc/kernel/cmdline` + boot-tool     | ZFS+UEFI uses proxmox-boot-tool; GRUB alone would not apply       |
| 2026-07 | Guest agent via cloud-init/Ansible only           | No Proxmox VMID host script; TF enables agent, guest installs pkg |
| 2026-07 | GPU attach per VM via Terraform when needed       | Host IOMMU first; VFIO + hostpci for one AI VM at a time          |
