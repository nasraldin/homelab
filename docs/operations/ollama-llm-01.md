# Ollama on llm-01 (LXC)

Privileged Ubuntu 24.04 LXC **`llm-01`** · VMID **125** · LAN **`192.168.68.26`** · API `:11434`

Inference path: **clients → LiteLLM (.108:4000) → Ollama on llm-01**.

LibreChat / OpenClaw / n8n stay unchanged except LiteLLM’s `api_base`.

## Why LXC (not VFIO VM)

| | `ai-01` (old) | `llm-01` (current) |
| --- | --- | --- |
| Guest | QEMU VM + VFIO | Privileged LXC |
| Host GPU | `vfio-pci` (host loses `amdgpu`) | **`amdgpu` on host** |
| Devices | full PCI | `/dev/dri/renderD128`, `/dev/dri/card1`, `/dev/kfd` |
| RAM | 16 GiB + hugepages | 24 GiB CT |

## Host prep (required once)

**Do not live-rebind the iGPU from VFIO → amdgpu** — that can hard-hang `pve01`. Always reboot after disabling VFIO.

```bash
# On pve01 (or: ssh pve01 'bash -s' < scripts/host-igpu-for-lxc.sh)
cd ~/homelab/lab-home-k8s
ssh pve01 'bash -s' < scripts/host-igpu-for-lxc.sh
# If exit 3: reboot the node, then:
ssh pve01 'ls -la /dev/dri /dev/kfd; lspci -nnk -s c6:00.0'
# Expect: Kernel driver in use: amdgpu ; renderD128 + kfd present
```

Confirm **`/etc/modprobe.d/vfio-amd-igpu.conf`** is renamed to
`*.disabled-for-lxc` (no `options vfio-pci ids=1002:150e`, no `blacklist amdgpu`).

### BIOS tip (GTT / UMA)

On AMD APU boards, raise **UMA / iGPU frame buffer / GTT** in BIOS if large models
OOM or stay CPU-only despite `OLLAMA_IGPU_ENABLE=1`. Prefer several GiB+ reserved
for the iGPU when system RAM is plentiful.

## Terraform + Ansible

```bash
cd ~/homelab/lab-home-k8s/terraform
terraform apply   # creates CT 125 llm-01 with device_passthrough

cd ~/homelab/lab-home-k8s/ansible
ansible-playbook playbooks/ollama.yml
```

CT settings (see `terraform.tfvars`): 8 cores, 24 GiB RAM, 100 GiB disk,
`unprivileged = false`, `nesting = true`, devices mode `0666`.

## Ollama env

`/etc/systemd/system/ollama.service.d/override.conf`:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_IGPU_ENABLE=1"
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_CONTEXT_LENGTH=4096"
Environment="HSA_OVERRIDE_GFX_VERSION=11.5.0"
```

`HSA_OVERRIDE_GFX_VERSION=11.5.0` is for Strix Point / 890M (gfx1150). Clear it
in Ansible defaults once `rocminfo` reports a supported gfx without override.

ROCm userspace inside the CT: `amdgpu-install --usecase=rocm --no-dkms`
(host owns the kernel module).

## Status (2026-07-30)

**Live.** CT **125** at `192.168.68.26` with host `amdgpu`/ROCm; `ollama ps`
showed **100% GPU**. LiteLLM points at `http://192.168.68.26:11434/v1`.
**`ai-01` remains stopped** (standby) — do not delete yet.

## Re-verify GPU (before decommissioning ai-01)

```bash
ssh root@192.168.68.26
rocminfo | head -80
ollama run gemma4:12b 'say hi in 5 words'
ollama ps
# Expect GPU-heavy split (e.g. 0%/100% or 17%/83%) — NOT 100% CPU
curl -s http://192.168.68.26:11434/api/tags | jq .
```

## Consumers

| App | Change |
| --- | --- |
| **LiteLLM** | `api_base: http://192.168.68.26:11434/v1` (`lab-home-gitops/apps/litellm/apps.yaml`) |
| LibreChat / OpenClaw / n8n | unchanged (via LiteLLM) |
| LAN DNS `ollama.lab` / `ai.lab` | → `.26` (`ansible` `guest_ips.llm-01`) |

## ai-01 standby (do not delete yet)

VM **120** stays on disk, **`onboot=0`**, **no `hostpci`**. GPU gate on llm-01
already passed; keep ai-01 for several stable days, then decommission.

Rollback (emergency only): re-enable VFIO conf, reboot, reattach `hostpci` /
mapping `ai-igpu`, start ai-01, point LiteLLM back to `.24`.

## Related

- Previous notes: [ollama-ai-01.md](ollama-ai-01.md)
- Placement: [service-placement.md](../architecture/service-placement.md)
- Host VFIO history: [gpu-passthrough.md](../architecture/gpu-passthrough.md)
