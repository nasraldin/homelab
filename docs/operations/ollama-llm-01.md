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

## Reading memory (why Proxmox shows ~4%)

Proxmox CT **Memory** (e.g. **4.15% · 1020 MiB of 24 GiB**) is **guest
cgroup / system RAM only** — the same order of magnitude as `free -h` /
`/sys/fs/cgroup/memory.current` inside the CT. It does **not** include AMD
APU **GTT / VRAM** where Ollama keeps weights when `PROCESSOR` is GPU.

Verified live (models loaded, chat path working):

| What you look at | What it means |
| --- | --- |
| Proxmox CT memory % | Guest RSS / cgroup (often ~1–3 GiB with runners up) |
| `free -h` inside CT | Same guest RAM picture |
| `ollama ps` **SIZE** + **PROCESSOR** | Working set Ollama reports; expect **100% GPU** |
| `/sys/class/drm/card1/device/mem_info_gtt_used` | Real weight residency on APU GTT (multi‑GiB) |
| `rocm-smi --showmeminfo vram` | Small carve-out VRAM; large models mostly use **GTT** |

Example while `gemma4:12b` + `qwen3.5:9b` were loaded: Proxmox/cgroup ~**2.4 GiB
(~10%)**, but GTT ~**14 GiB** and `ollama ps` ~**8.1 GB + 5.6 GB**, both
**100% GPU**. Idle unload (default keep-alive **~5 min**) drops GTT and
guest RSS further — the graph going low after a pause is expected, not a
failed load.

**Do not** try to make the Proxmox RAM graph “look busy”; that would only
happen with CPU-heavy / non-GPU residency (worse). For “is the model
loaded?”, use `ollama ps` + GTT, not the CT memory panel.

Optional warmer residency between chats (does not change how Proxmox
graphs RAM):

```ini
Environment="OLLAMA_KEEP_ALIVE=30m"
```

## Status (2026-07-30)

**Live.** CT **125** at `192.168.68.26` with host `amdgpu`/ROCm; `ollama ps`
showed **100% GPU**. LiteLLM points at `http://192.168.68.26:11434/v1`.
**`ai-01` (VM 120) destroyed** after GPU verification — no standby guest.

## Re-verify GPU

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

## Related

- Legacy VFIO notes: [ollama-ai-01.md](ollama-ai-01.md)
- Placement: [service-placement.md](../architecture/service-placement.md)
- Host VFIO history: [gpu-passthrough.md](../architecture/gpu-passthrough.md)
