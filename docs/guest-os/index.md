# Choose the Right Guest OS for Each Homelab Role

Pick the guest OS by role, not by habit. Most VMs stay on Debian; kubeadm nodes follow that. Talos, Fedora CoreOS, and Fedora Server exist for specific learning paths (immutable k8s, OpenShift-style Ignition, RHEL/`dnf`) — not as a blanket replacement.

Do not put CoreOS or Talos everywhere “because immutable sounds modern.” Match the OS to the job and the skill you are practicing.

## What this page covers

- Target mix of Debian, Talos, CoreOS, and Fedora Server
- When to use each OS (and when not to)
- **QEMU Guest Agent** — how we install it (not a Proxmox VMID script)
- Provisioning notes for CoreOS and Talos
- Link to kubeadm / k8s docs for node choice

## Summary mix (target)

| OS                      | Share            | Primary use                                                         |
| ----------------------- | ---------------- | ------------------------------------------------------------------- |
| **Debian Server 12/13** | ~70%             | k8s nodes, GitLab, Vault, general VMs                               |
| **kubeadm on Debian**   | Primary k8s      | CKA + production-style cluster ([k8s docs](../kubernetes/index.md)) |
| **Talos Linux**         | Optional cluster | Immutable Kubernetes nodes (production-style)                       |
| **Fedora CoreOS**       | 1–2 VMs          | Immutable container hosts, Ignition, OpenShift path                 |
| **Fedora Server**       | As needed        | RHEL ecosystem / `dnf` practice                                     |

Do **not** replace Debian/kubeadm with CoreOS everywhere — each OS has a role.

---

## QEMU Guest Agent

Install **`qemu-guest-agent` inside the guest** so Proxmox gets IP address,
graceful shutdown/reboot, and better console integration. Enable the agent on
the VM hardware (`agent: 1` / “QEMU Guest Agent”) in Terraform as well.

### Do this (lab standard)

| When                                | Tool                               | What                                                                       |
| ----------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| New cloud-image VM                  | **cloud-init** via `terraform-lab` | Install + enable `qemu-guest-agent` on first boot; set Proxmox `agent = 1` |
| Existing / non–cloud-init Debian VM | **`ansible-lab`** guest role       | Ensure package installed, `qemu-guest-agent` service enabled and running   |
| Proxmox **host** packages           | `proxmox-bootstrap`                | Host tools only — **not** guest VMs                                        |

```text
Terraform creates VM (agent enabled)
        │
        ▼
cloud-init or Ansible installs qemu-guest-agent in the guest
        │
        ▼
Proxmox UI shows guest IP / clean shutdown works
```

### Do **not** do this

| Anti-pattern                                                  | Why                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Manual `apt install` on each new VM and forget Git            | Drift; next rebuild has no agent                                                             |
| Host script `./install-guest-agent.sh --vmid 101`             | `qm guest exec` needs the agent **already**; VMID alone cannot install into the guest        |
| Put guest package install in `proxmox-bootstrap`              | Bootstrap owns the **hypervisor**, not guest OS ([platform-tooling](../platform-tooling.md)) |
| Install agent only in the guest but leave Proxmox `agent` off | Package runs but Proxmox will not talk to it                                                 |

Break-glass (once, then fold into Ansible/cloud-init): SSH into the guest by IP
and `apt install -y qemu-guest-agent && systemctl enable --now qemu-guest-agent` —
never as the documented happy path.

### Verify

```bash
# On Proxmox — agent responding (after guest is up)
ssh pve01 'qm agent VMID ping'          # replace VMID
ssh pve01 'qm guest cmd VMID network-get-interfaces'

# Inside guest
systemctl is-active qemu-guest-agent
```

---

## Debian Server

**Use for:** most VMs — anything you manage with `apt`, SSH, Ansible.

| Good for                            | Not ideal for                     |
| ----------------------------------- | --------------------------------- |
| kubeadm cluster nodes               | Immutable k8s nodes (use Talos)   |
| AdGuard, Technitium (Debian 13 VMs) | Learning CoreOS/Ignition patterns |

**In this lab:** DNS guests use **Debian 13 (Trixie)** cloud images via `terraform-lab`. Prefer Debian 12/13 for k8s nodes ([kubeadm architecture](../kubernetes/kubeadm-architecture.md)).

---

## Fedora Server

**Use for:** RHEL administration practice — `dnf`, SELinux, systemd patterns closer to enterprise Linux.

| Good for                           | Avoid for                                |
| ---------------------------------- | ---------------------------------------- |
| RHEL skill building                | Primary k8s platform (use kubeadm/Talos) |
| Services you want on RPM ecosystem | Proxmox host (PVE is Debian)             |

---

## Fedora CoreOS

**Immutable OS** for container workloads — upstream of RHEL CoreOS → OpenShift.

### Good use cases

1. **Container host** — Podman workloads defined in Ignition (no manual `dnf install`)
2. **OpenShift-style learning** — Ignition, MachineConfig concepts, immutable nodes
3. **GitOps-managed VM** — config in Git → Ignition → VM reprovision
4. **Edge / appliance** — minimal OS, automatic updates, low drift

### When NOT to use CoreOS

| Avoid for                           | Use instead             |
| ----------------------------------- | ----------------------- |
| GitLab server                       | Debian Server VM        |
| Database server                     | Debian Server VM        |
| Monitoring stack VM                 | Kubernetes (Argo CD)    |
| Daily `apt install` experimentation | Debian or Fedora Server |
| General Linux learning              | Debian Server           |

### Provisioning note

CoreOS ships **qcow2/raw** images (not a traditional ISO) — import via Proxmox + Ignition/`butane` config (Terraform/cloud-init pattern TBD).

**Status:** ⏳ not deployed — document when first VM is added to `terraform.tfvars`.

---

## Talos Linux

**Purpose-built immutable Kubernetes** — no SSH, no package manager, API-driven.

|                    | Fedora CoreOS                     | Talos Linux           |
| ------------------ | --------------------------------- | --------------------- |
| Main role          | Container / OpenShift-style hosts | Kubernetes nodes only |
| SSH                | Usually yes                       | No                    |
| General containers | Excellent                         | No                    |
| K8s                | Possible                          | Designed for it       |
| OpenShift learning | Excellent                         | No                    |

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
- [gpu-passthrough.md](../architecture/gpu-passthrough.md) — IOMMU + attach GPU to a VM
- [platform-tooling.md](../platform-tooling.md) — who owns guest packages
- [phases.md §6](../roadmap/phases.md#phase-6--kubernetes)
- [decisions/log.md](../decisions/log.md)
