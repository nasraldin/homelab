# Homelab

A practical **Platform Engineering** curriculum: build a real homelab from bare
metal through Proxmox, automation, Kubernetes, and day-2 operations.

Use these docs as a study guide. Replace every [placeholder](conventions/placeholders.md)
with values from **your** network and password manager — never commit secrets.

---

## Start here

| Doc | Purpose |
| --- | ------- |
| **[Current state](current-state.md)** | Where the reference build is now |
| **[Build story](build-story.md)** | Narrative from planning → install → platform |
| [Placeholders](conventions/placeholders.md) | Safe examples vs your real IPs and tokens |
| [Next steps](installation/next-steps.md) | Ordered apply sequence after install |
| [Platform tooling](platform-tooling.md) | Terraform vs Ansible vs Argo CD |

---

## Roadmap

| Doc | Contents |
| --- | -------- |
| [Overview](roadmap/README.md) | Phase table |
| [Foundation sequence](roadmap/foundation-sequence.md) | Steps 1–15 before Kubernetes |
| [Phase details](roadmap/phases.md) | Phase 0–11 tasks |

---

## Installation journal

| Doc | Contents |
| --- | -------- |
| [Installation index](installation/README.md) | Install docs hub |
| [Journey](installation/journey.md) | Install timeline |
| [Issues tracker](installation/issues-tracker.md) | Problems and fixes |
| [Verified state](installation/verified-state.md) | Validation commands (with placeholders) |

---

## Architecture

| Doc | Contents |
| --- | -------- |
| [Hardware & storage](architecture/hardware-and-storage.md) | Example disk layout |
| [Proxmox storage layout](architecture/proxmox-storage-layout.md) | ZFS pools |
| [Service placement](architecture/service-placement.md) | VM vs k8s vs Docker |
| [Target topology](architecture/target-topology.md) | End-state diagram |
| [Network, DNS & ingress](architecture/network-dns-ingress.md) | DNS and edge access |
| [Automation layers](architecture/automation-layers.md) | Bootstrap vs Terraform vs Ansible |

---

## Kubernetes & platform

| Doc | Contents |
| --- | -------- |
| [Kubernetes hub](kubernetes/README.md) | kubeadm, Lima Docker |
| [kubeadm architecture](kubernetes/kubeadm-architecture.md) | Nodes, HAProxy, sizing |
| [GitOps bootstrap](kubernetes/gitops-bootstrap.md) | Argo CD, Longhorn, Helm |
| [Harbor registry](platform/harbor-registry.md) | Proxy cache, replication |
| [ITSM & n8n](platform/itsm-and-automation.md) | Tickets vs automation |

---

## Security & operations

| Doc | Contents |
| --- | -------- |
| [Supply chain & policies](security/supply-chain-and-policies.md) | Cosign, Kyverno |
| [Wazuh](security/wazuh.md) | SIEM placement |
| [Proxmox updates](operations/proxmox-updates.md) | Check vs upgrade |
| [Backups](operations/backups.md) | vzdump stages |
| [Backup platform](operations/backup-platform.md) | PBS, Velero |

---

## Community labs

| Lab | Docs |
| --- | ---- |
| Overview | [Community labs](community-labs.md) |
| Docker Lab | [Standalone Pages](https://nasraldin.github.io/docker-lab/) |
| Camunda Lab | [Standalone Pages](https://nasraldin.github.io/camunda-lab/) |

---

## Reference

| Doc | Contents |
| --- | -------- |
| [Guest OS strategy](guest-os/README.md) | Debian, Talos, CoreOS |
| [Decision log](decisions/log.md) | Architectural choices |
| [Status legend](conventions/status-legend.md) | Status symbols |

> Legacy plan stub: [homelab-plan.md](homelab-plan.md)
