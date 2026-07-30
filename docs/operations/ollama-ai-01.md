# Ollama on ai-01 (legacy — destroyed)

**Superseded by [ollama-llm-01.md](ollama-llm-01.md)** (privileged LXC `llm-01` at
`192.168.68.26` with host `amdgpu` device passthrough).

`ai-01` (VM **120**, `.24`) was the old VFIO path. It was **destroyed 2026-07-30**
after `llm-01` GPU/ROCm verification (`ollama ps` 100% GPU). Do not recreate
unless deliberately rolling back to VFIO (see [gpu-passthrough.md](../architecture/gpu-passthrough.md)).

## Historical notes (VFIO VM path)

### RAM vs GPU

The **16 GiB system RAM** held model weights + KV on the VM. `ollama ps`
`CPU%/GPU%` is **compute split**, not “RAM unused”.

On `llm-01`, Proxmox CT memory % is **guest cgroup only** — use `ollama ps` +
GTT (`mem_info_gtt_used`) for model residency ([ollama-llm-01.md](ollama-llm-01.md)).

### GPU enable (still true on llm-01)

Ollama **drops the AMD iGPU unless** `OLLAMA_IGPU_ENABLE=1` is set.

```ini
# /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_IGPU_ENABLE=1"
Environment="OLLAMA_CONTEXT_LENGTH=4096"
Environment="OLLAMA_FLASH_ATTENTION=1"
```

### Thinking / speed

Default LiteLLM model `gemma4:12b` has **thinking disabled** (faster).
LibreChat also exposes **`gemma4:12b-think`** for reasoning.
