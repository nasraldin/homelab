# Log Every Architecture Decision with a Clear Rationale

Append-only log of architecture choices and the rationale that locked them. Skim this when a later phase tempts a rewrite; the [build story](../build-story.md) and [current state](../current-state.md) summarize the same calls in narrative and checklist form.

Add a row when you make a new architectural choice — don’t rewrite history.

## What this page covers

- Install and storage decisions (USB, ZFS, disks, backups)
- Naming, DNS interim, and public UI via Tunnel
- Automation ownership (bootstrap, Terraform token, update checks)
- Platform stack picks (kubeadm, NGINX, AdGuard/Technitium, GitOps, signing)

| Date    | Decision                                                       | Rationale                                                                                                      |
| ------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 2026-07 | USB install, not PXE                                           | Single node; fastest path; ansible-lab for unattended later                                                    |
| 2026-07 | ZFS on Samsung only for `rpool`                                | Separate failure domain; Kingston = `data01` via Terraform                                                     |
| 2026-07 | FQDN `pve01.lab.nasraldin.com`                                 | Numbered nodes; internal subdomain under owned domain                                                          |
| 2026-07 | `/etc/hosts` for lab DNS interim                               | Cloudflare wildcard breaks `*.lab`; AdGuard later                                                              |
| 2026-07 | Public UI at `homelab.nasraldin.com`                           | Tunnel + Access; not `pve01.lab` on Cloudflare                                                                 |
| 2026-07 | `terraform@pve!provider` token                                 | API automation; not root password                                                                              |
| 2026-07 | `proxmox-bootstrap` over curl scripts                          | Idempotent, owned, auditable                                                                                   |
| 2026-07 | Backups on `local-backup` (990 PRO), not `data01`              | Separate failure domain; migrate to aux disk later                                                             |
| 2026-07 | vzdump now, PBS on Dell later                                  | Stage 1–2 vzdump; Stage 3 PBS (not 3rd NVMe in X1)                                                             |
| 2026-07 | Doc audit: build-story + current-state                         | Single narrative; setup 🔄 status; dedupe index                                                                |
| 2026-07 | Daily update **check** only (systemd timer)                    | User request; production pattern                                                                               |
| 2026-07 | Shell + systemd over n8n for update check                      | Host-native; n8n optional fan-out later                                                                        |
| 2026-07 | Never unattended hypervisor upgrade                            | Reboot/guest risk                                                                                              |
| 2026-07 | AdGuard + Technitium (not Pi-hole alone)                       | Filtering vs authoritative DNS                                                                                 |
| 2026-07 | NGINX Ingress (not Traefik)                                    | Enterprise familiarity                                                                                         |
| 2026-07 | kubeadm on Debian (not k3s) for primary cluster                | CKA depth, production similarity; staged HA with HAProxy                                                       |
| 2026-07 | Lima (`vz`) for Mac Docker (not Desktop)                       | Native perf; Debian arm64; k8s on Proxmox only                                                                 |
| 2026-07 | HAProxy for API VIP; MetalLB optional                          | Enterprise LB pattern; Cilium + NGINX in-cluster                                                               |
| 2026-07 | Fedora CoreOS for OpenShift-style learning                     | Separate from Debian general VMs                                                                               |
| 2026-07 | Talos for immutable k8s (later)                                | Not day-one; after kubeadm + Argo CD                                                                           |
| 2026-07 | Mac as control plane                                           | `infra-01` optional later                                                                                      |
| 2026-07 | Kyverno over Gatekeeper for k8s admission                      | Kubernetes-native; built-in Cosign verify; Rego optional later                                                 |
| 2026-07 | Cosign keyed signing in CI (not keyless v1)                    | Simpler; pre-k8s Vault bootstrap, then Phase 9 ESO integration                                                 |
| 2026-07 | AMD GPU PT: `iommu=pt` only (no `amd_iommu=on`)                | Official Proxmox; AMD IOMMU default-on; 890M AI VMs later                                                      |
| 2026-07 | Cmdline via `/etc/kernel/cmdline` + boot-tool                  | ZFS+UEFI uses proxmox-boot-tool; GRUB alone would not apply                                                    |
| 2026-07 | Central Postgres on `database-01` + PgCat                      | No per-app embedded PG; Keycloak/Infisical/Sonar share data plane                                              |
| 2026-07 | Infisical on `docker-01` (retire `infisical-01`)               | One app Compose host; DB external                                                                              |
| 2026-07 | Sonar on dedicated VM + Tunnel like GitLab                     | Max ES performance; no NPM/Access on that path                                                                 |
| 2026-07 | Elastic dedicated VM; Loki stays primary logs (Option A)       | Correctly sized ES; ops logs stay light on monitoring-01                                                       |
| 2026-07 | Single fleeting `runner-01` (drop `runner-02`)                 | Manager + ephemeral workers; not concurrent=40 on fat VM                                                       |
| 2026-07 | Homelab PVE oversubscription OK                                | Single node; guests idle/burst asynchronously                                                                  |
| 2026-07 | NPM on docker-01; Caddy on podman-01                           | UI edge vs config-as-code practice                                                                             |
| 2026-07 | Guest agent via cloud-init/Ansible only                        | No Proxmox VMID host script; TF enables agent, guest installs pkg                                              |
| 2026-07 | GPU attach per VM via Terraform when needed                    | Host IOMMU first; VFIO + hostpci for one AI VM at a time                                                       |
| 2026-07 | Archive OPNsense VLAN pilot; keep flat LAN                     | Stage too early for second firewall; Mac Wi-Fi only; DNS enough                                                |
| 2026-07 | Mac DNS pin when Deco lacks IPv6 DNS UI                        | Firmware cannot set RDNSS; pin Wi-Fi DNS to AdGuard `.10`                                                      |
| 2026-07 | GitLab before kubeadm; HTTPS git via Tunnel                    | CI owns Terraform for later VMs; no Access so PAT clone works                                                  |
| 2026-07 | Omnibus + separate Docker runner VM                            | Recoverability outside k8s; Docker executor for clean CI jobs                                                  |
| 2026-07 | Vault OSS Raft on `vault-01` (not optional)                    | Layer-1 secrets plane; AppRole now; JWT/K8s auth later; no Infisical                                           |
| 2026-07 | Vault + Transit seal (`vault-seal`); not Infisical/OpenBao     | Env-first Infisical ≠ seal/Transit; comparison: [vault-vs-infisical.md](../architecture/vault-vs-infisical.md) |
| 2026-07 | Secret ownership: platform→Vault; app envs→Infisical later     | Inventory: [secret-ownership-map.md](../architecture/secret-ownership-map.md)                                  |
| 2026-07 | Infisical TF+Ansible scaffold (`infisical-01` VMID 115 `.20`)  | App plane after Vault pair (113–114); Vault stays infra; [infisical.md](../operations/infisical.md)            |
| 2026-07 | VMID insert: Infisical 114; bump aistor→gitlab→runners→seal    | superseded — vault-seal is 114 after vault-01                                                                  |
| 2026-07 | Vault pair contiguous: `vault-01` 113 + `vault-seal` 114       | Seal sits next to Vault in ID map; Infisical 115+; [guest-vmid-map.md](../operations/guest-vmid-map.md)        |
| 2026-07 | GitLab TF/Ansible CI: `-target` + LIMIT, not filtered for_each | Scripts + `.gitlab-ci.yml` scaffold; [gitlab-infra-pipeline.md](../operations/gitlab-infra-pipeline.md)        |
| 2026-07 | AIStor Free on `aistor-01` (not MinIO CE)                      | Shared LAN S3; CE archived; buckets via TF; GitLab + Vault snaps                                               |
| 2026-07 | runner-02 fleeting autoscaler deferred                         | Keep static fat VM for core stage; document docker-autoscaler next                                             |
| 2026-07 | VMID Layer-1 order 110–119                                     | DNS/infra → vault-01 → vault-seal → Infisical → AIStor → GitLab → runners; IPs keep historical octets          |
| 2026-07 | VM defaults: q35 + OVMF + VirtIO SCSI Single                   | PVE 9 baseline; SeaBIOS/virtio0 retired for new Debian cloud guests                                            |
| 2026-07 | DHCP Secondary DNS = 1.1.1.1 (Primary AdGuard)                 | LAN stays online when AdGuard is replaced/down; filtering when healthy                                         |
| 2026-07 | Proxmox startup order: DNS before apps                         | AdGuard order=1, Technitium=2; on_boot already true for all core VMs                                           |
| 2026-07 | Mac remote desktop: SSH servers; RDP/RustDesk GUI              | No WAN :3389; Windows App for Windows/GNOME; RustDesk for cross-platform                                       |
