# Choose the Right Guest OS for Each Homelab Role

Pick the guest OS by role, not by habit. Most VMs stay on Debian; kubeadm nodes follow that. Talos, Fedora CoreOS, and Fedora Server exist for specific learning paths (immutable k8s, OpenShift-style Ignition, RHEL/`dnf`) — not as a blanket replacement.

Do not put CoreOS or Talos everywhere “because immutable sounds modern.” Match the OS to the job and the skill you are practicing.

## What this page covers

- Target mix of Debian, Talos, CoreOS, and Fedora Server
- When to use each OS (and when not to)
- Provisioning notes for CoreOS and Talos
- Link to kubeadm / k8s docs for node choice

## Summary mix (target)

| OS | Share | Primary use |
| -- | ----- | ----------- |
| **Debian Server 12/13** | ~70% | k8s nodes, GitLab, Vault, general VMs |
| **kubeadm on Debian** | Primary k8s | CKA + production-style cluster ([k8s docs](../kubernetes/README.md)) |
| **Talos Linux** | Optional cluster | Immutable Kubernetes nodes (production-style) |
| **Fedora CoreOS** | 1–2 VMs | Immutable container hosts, Ignition, OpenShift path |
| **Fedora Server** | As needed | RHEL ecosystem / `dnf` practice |

Do **not** replace Debian/kubeadm with CoreOS everywhere — each OS has a role.

---

## Debian Server

**Use for:** most VMs — anything you manage with `apt`, SSH, Ansible.

| Good for | Not ideal for |
| -------- | ------------- |
| kubeadm cluster nodes | Immutable k8s nodes (use Talos) |
| AdGuard, Technitium (LXC or VM) | Learning CoreOS/Ignition patterns |

**In this lab:** add **Debian 12** cloud image to `terraform-lab` for k8s nodes ([kubeadm architecture](../kubernetes/kubeadm-architecture.md)).

---

## Fedora Server

**Use for:** RHEL administration practice — `dnf`, SELinux, systemd patterns closer to enterprise Linux.

| Good for | Avoid for |
| -------- | --------- |
| RHEL skill building | Primary k8s platform (use kubeadm/Talos) |
| Services you want on RPM ecosystem | Proxmox host (PVE is Debian) |

---

## Fedora CoreOS

**Immutable OS** for container workloads — upstream of RHEL CoreOS → OpenShift.

### Good use cases

1. **Container host** — Podman workloads defined in Ignition (no manual `dnf install`)
2. **OpenShift-style learning** — Ignition, MachineConfig concepts, immutable nodes
3. **GitOps-managed VM** — config in Git → Ignition → VM reprovision
4. **Edge / appliance** — minimal OS, automatic updates, low drift

### When NOT to use CoreOS

| Avoid for | Use instead |
| --------- | ----------- |
| GitLab server | Debian Server VM |
| Database server | Debian Server VM |
| Monitoring stack VM | Kubernetes (Argo CD) |
| Daily `apt install` experimentation | Debian or Fedora Server |
| General Linux learning | Debian Server |

### Provisioning note

CoreOS ships **qcow2/raw** images (not a traditional ISO) — import via Proxmox + Ignition/`butane` config (Terraform/cloud-init pattern TBD).

**Status:** ⏳ not deployed — document when first VM is added to `terraform.tfvars`.

---

## Talos Linux

**Purpose-built immutable Kubernetes** — no SSH, no package manager, API-driven.

| | Fedora CoreOS | Talos Linux |
| - | ------------- | ----------- |
| Main role | Container / OpenShift-style hosts | Kubernetes nodes only |
| SSH | Usually yes | No |
| General containers | Excellent | No |
| K8s | Possible | Designed for it |
| OpenShift learning | Excellent | No |

### This lab’s order

1. **Now:** **kubeadm** on Debian VMs — CKA and production-style ops ([kubeadm architecture](../kubernetes/kubeadm-architecture.md))
2. **Later:** optional **Talos** cluster for immutable k8s
3. **Alongside:** one **Fedora CoreOS** VM for container/Ignition/OpenShift learning

**Do not** run Talos and kubeadm for the same purpose on day one — kubeadm first, Talos when you want immutable-k8s depth.

---

## Proxmox host

**Proxmox VE only** — Debian-based hypervisor. Guest OS choices above apply to **VMs**, not `pve01`.

---

## Related

- [target-topology.md](../architecture/target-topology.md)
- [phases.md §6](../roadmap/phases.md#phase-6--kubernetes)
- [decisions/log.md](../decisions/log.md)
