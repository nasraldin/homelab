# OpenClaw (lab)

Personal AI agent gateway in namespace **`ai-tools`**, wired to LiteLLM → Ollama on **llm-01**.

Official install path: [Kubernetes (Kustomize)](https://docs.openclaw.ai/install/kubernetes) — **not** the community Helm chart. Ansible install ([docs](https://docs.openclaw.ai/install/ansible)) is for host+Tailscale VMs; this lab uses the K8s manifests instead.

| Item | Value |
|------|--------|
| UI | http://openclaw.lab |
| WebSocket | same-origin `ws://openclaw.lab` (Control UI auto-detects) |
| Gateway LB | `192.168.68.113:18789` |
| Namespace | `ai-tools` |
| Token | `lab-home-k8s/ansible/secrets.yml` → `vault_openclaw_gateway_token` / Secret `openclaw-secrets` |
| Models | `litellm/gemma4:12b`, `litellm/gemma4:12b-think`, `litellm/qwen3.5:9b` |
| Image | `ghcr.io/openclaw/openclaw:2026.7.1-slim` |
| Deploy | GitOps Kustomize `workloads/ai/openclaw/` ← Argo `apps-openclaw` |

## Connect (plug-and-play)

Open **http://openclaw.lab** — no Control UI prompts for WebSocket URL, Gateway Token, or Password.

How it works ([dashboard auth](https://docs.openclaw.ai/web/dashboard)):

1. NPM on **docker-01** (`192.168.68.21`) redirects bare `/` → `/__oc_boot` **once** (skipped for `Upgrade: websocket` and when the `oc_boot` cookie is set — an unconditional `/`→boot 302 loops forever and breaks WS).
2. Boot page sets `oc_boot=1` and sends the browser to `/#token=<vault_openclaw_gateway_token>` (official URL-fragment bootstrap; fragment is never sent to the gateway).
3. Control UI stores the token for the tab/gateway, strips the hash, and connects to same-origin `ws://openclaw.lab`.

Password is unused (token auth only). After first load in a tab, sessionStorage keeps the token until the tab is closed. The `oc_boot` cookie is a session cookie so a new browser session re-runs the bootstrap.

**One-liner reopen** (same as `openclaw dashboard` fragment pattern):

```bash
# prints length only — does not echo the token
TOKEN=$(kubectl get secret openclaw-secrets -n ai-tools -o jsonpath='{.data.OPENCLAW_GATEWAY_TOKEN}' | base64 -d)
open "http://openclaw.lab/#token=${TOKEN}"
```

Or re-apply the NPM bootstrap after vault/token rotation (**docker-01** must be up; playbook targets `docker-01`):

```bash
cd lab-home-k8s/ansible
ansible-playbook playbooks/proxy-routes.yml -e @secrets.yml
```

Lab HTTP is a non-secure browser context (no WebCrypto device identity). Config enables lab break-glass flags:

- `gateway.controlUi.allowInsecureAuth: true`
- `gateway.controlUi.dangerouslyDisableDeviceAuth: true` (retired upstream; still honored for HTTP lab until HTTPS)
- `gateway.controlUi.allowedOrigins` includes `http://openclaw.lab`
- `gateway.trustedProxies` includes docker-01 (`192.168.68.21`) + cluster pod/node CIDRs (NPM path)

For production/remote access, prefer HTTPS (NPM TLS / Tailscale Serve) and turn the insecure Control UI flags off. Do **not** use `gateway.auth.mode: trusted-proxy` on this LB topology without `externalTrafficPolicy: Local` — Cilium SNAT makes client source IPs look like node IPs.

## Verify

```bash
kubectl get deploy,svc -n ai-tools -l app=openclaw
curl -sS http://192.168.68.113:18789/healthz   # {"ok":true,...}
curl -sSI http://openclaw.lab/ | head -5       # 302 → /__oc_boot
curl -sS http://openclaw.lab/__oc_boot | head -1  # boot HTML with location.replace(#token=…)
```

Browser: open http://openclaw.lab → Control UI connects without settings prompts.

## Apply status (2026-07-30)

**Live** on docker-01 NPM + k8s `ai-tools`. Boot redirect is cookie/WS-aware (fixes infinite `/`↔`/__oc_boot` loop).

```bash
curl -sSI http://openclaw.lab/ | head -5          # expect 302 Location: /__oc_boot (no oc_boot cookie)
curl -sS -D- -o /dev/null http://openclaw.lab/__oc_boot | grep -i set-cookie  # oc_boot=1
# After cookie: / must be 200 Control UI (not another 302), and WS must upgrade:
curl -sSI -b oc_boot=1 http://openclaw.lab/ | head -5   # expect 200
curl -sS -o /dev/null -w '%{http_code}\n' -b oc_boot=1 \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  http://openclaw.lab/   # expect 101
curl -sS http://192.168.68.113:18789/healthz       # expect {"ok":true,...}
# Re-apply routes if needed:
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook playbooks/proxy-routes.yml -e @secrets.yml
```

## GitOps

- App: `apps/openclaw/apps.yaml`
- Manifests: `workloads/ai/openclaw/` (official layout: Deployment + Service + PVC + ConfigMap + Secret)
- NPM route + `#token=` bootstrap: `lab-home-k8s/ansible/roles/proxy` (`vault_openclaw_gateway_token`)
