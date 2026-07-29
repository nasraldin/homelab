# Ollama on ai-01 (legacy / standby)

**Superseded by [ollama-llm-01.md](ollama-llm-01.md)** (privileged LXC `llm-01` at
`192.168.68.26` with host `amdgpu` device passthrough).

`ai-01` (VM 120, `.24`) is kept **stopped** as rollback. llm-01 GPU/ROCm is
already verified (`ollama ps` showed 100% GPU); keep ai-01 for several stable
days before decommissioning. **Do not delete** yet.

## Historical notes (VFIO VM path)

### RAM vs GPU

The **16 GiB system RAM is used** — with `gemma4:12b` loaded you typically see
~10 GiB used on `ai-01` (model weights + KV cache). That is normal.

`ollama ps` showing `17%/83% CPU/GPU` means **compute split**, not “RAM unused”.

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
