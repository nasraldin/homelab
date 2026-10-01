# Platform Services v1 (Cilium) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable kube-proxy on Talos (CNI already `none`, KubePrism verified), then install pinned Cilium via GitLab CI + official OCI Helm chart so all 7 nodes become Ready with working networking and no kube-proxy.

**Architecture:** Two-repo hard gate. (1) `homelab-cluster-infra` patches Talos machine config and applies to all nodes. (2) `homelab-platform-services` deploys Cilium into `kube-system` with Talos kube-proxy-free values using `validate → render/diff → manual deploy → manual verify`. Cilium deploy must not run until the cluster-infra prerequisite is applied and verified.

**Tech Stack:** Talos 1.14.1, Kubernetes 1.37.0, Helm 3, Cilium OCI chart `oci://quay.io/cilium/charts/cilium`, GitLab CI, kubectl, cilium CLI (verify only).

**Spec:** `docs/superpowers/specs/2026-09-28-platform-services-cilium-v1-design.md`

## Global Constraints

- API VIP only: `https://192.168.68.30:6443` (reject kubeconfig pointing at `.80`)
- Cilium namespace: `kube-system` only
- Chart: `oci://quay.io/cilium/charts/cilium` — pin version + OCI digest in `versions.env`
- No Argo CD, Flux, Helmfile, Hubble UI, Gateway, Cloudflare, CSI, Harbor, or other platform services in v1
- Never install platform apps into `default`
- Nodes may remain `NotReady` until after Cilium deploy — expected
- Do not migrate away from a live kube-proxy inside the Cilium pipeline; configure Talos first

## File map

### `homelab-cluster-infra` (prerequisite)

| Path                                 | Responsibility                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `talos/patches/no-kube-proxy.yaml`   | Disable kube-proxy (Talos 1.14 `KubeProxyConfig` + classic equivalent if needed) |
| `talos/patches/kubeprism.yaml`       | Explicit `KubePrismConfig` port 7445 (belt-and-suspenders)                       |
| `talos/talconfig.yaml`               | Reference new patches on all nodes; keep `cniConfig.name: none`                  |
| `scripts/verify-talos-cni-prereq.sh` | Assert no kube-proxy, KubePrism :7445, etcd OK                                   |
| `docs/runbook.md`, `docs/ci.md`      | Document prereq + VIP kubeconfig                                                 |
| `.gitlab-ci.yml`                     | Optional: wire verify script into `cluster:verify` or new manual job             |

### `homelab-platform-services` (Cilium v1)

| Path                               | Responsibility                             |
| ---------------------------------- | ------------------------------------------ |
| `versions.env`                     | `CILIUM_VERSION`, `CILIUM_CHART_DIGEST`    |
| `platform/cilium/values.yaml`      | Talos-aligned Helm values                  |
| `platform/cilium/README.md`        | Chart pin + values notes                   |
| `docs/namespaces.md`               | Reserved namespace map (create none in v1) |
| `docs/dependency-cluster-infra.md` | Hard gate documentation                    |
| `docs/runbook-cilium.md`           | Deploy/verify operator runbook             |
| `scripts/kubeconfig-guard.sh`      | Fail if API host ≠ `192.168.68.30`         |
| `scripts/helm-render.sh`           | `helm template` OCI chart → artifact       |
| `scripts/cilium-deploy.sh`         | Precheck + `helm upgrade --install`        |
| `scripts/cilium-verify.sh`         | All 12 success criteria                    |
| `.gitlab-ci.yml`                   | validate / render / deploy / verify        |
| `README.md`                        | Repo purpose + pipeline                    |
| `.gitignore`, `.markdownlint.yaml` | Hygiene                                    |

---

### Task 1: cluster-infra — disable kube-proxy + explicit KubePrism patches

**Files:**

- Create: `homelab-cluster-infra/talos/patches/no-kube-proxy.yaml`
- Create: `homelab-cluster-infra/talos/patches/kubeprism.yaml`
- Modify: `homelab-cluster-infra/talos/talconfig.yaml` (add patches to every node)

**Interfaces:**

- Produces: machine configs that include CNI none (existing) + kube-proxy disabled + KubePrism :7445
- Consumes: existing `cniConfig.name: none` in talconfig

- [ ] **Step 1: Create kube-proxy disable patch (Talos 1.14 documents + classic intent)**

Write `talos/patches/no-kube-proxy.yaml`:

```yaml
# Disable kube-proxy — Cilium kubeProxyReplacement will own service datapath.
# Talos ≥1.14: KubeProxyConfig document. Classic field retained for talhelper
# merges that still emit cluster.proxy.
apiVersion: v1alpha1
kind: KubeProxyConfig
enabled: false
---
cluster:
  network:
    cni:
      name: none
  proxy:
    disabled: true
```

- [ ] **Step 2: Create explicit KubePrism patch**

Write `talos/patches/kubeprism.yaml`:

```yaml
apiVersion: v1alpha1
kind: KubePrismConfig
port: 7445
```

- [ ] **Step 3: Attach patches to all 7 nodes in `talconfig.yaml`**

On every node’s `patches:` list (after `networking.yaml`), add:

```yaml
- '@./patches/no-kube-proxy.yaml'
- '@./patches/kubeprism.yaml'
```

Keep existing `cniConfig.name: none` at cluster level.

- [ ] **Step 4: Regenerate configs locally and inspect for proxy disabled**

```bash
cd ~/homelab/homelab-cluster-infra
export SOPS_AGE_KEY_FILE=~/homelab/vault/secrets/homelab-cluster-infra/sops-age.key
./scripts/ci-install-talos-tools.sh   # or use PATH tools
./scripts/talos-genconfig.sh
rg -n "proxy|KubeProxy|KubePrism|cni" talos/clusterconfig/homelab-talos-cp01.yaml | head -40
```

Expected: `proxy` disabled / `KubeProxyConfig` enabled false; CNI none; KubePrism port 7445 present.

- [ ] **Step 5: Commit on a branch**

```bash
git checkout -b feat/talos-no-kube-proxy-kubeprism
git add talos/patches/no-kube-proxy.yaml talos/patches/kubeprism.yaml talos/talconfig.yaml
git commit -m "$(cat <<'EOF'
feat(talos): disable kube-proxy and pin KubePrism for Cilium

Prerequisite for homelab-platform-services Cilium kubeProxyReplacement via localhost:7445.
EOF
)"
```

---

### Task 2: cluster-infra — prereq verify script + docs

**Files:**

- Create: `homelab-cluster-infra/scripts/verify-talos-cni-prereq.sh`
- Modify: `homelab-cluster-infra/docs/runbook.md`
- Modify: `homelab-cluster-infra/docs/ci.md`
- Modify: `homelab-cluster-infra/.gitlab-ci.yml` (add manual verify job or extend cluster:verify notes)

**Interfaces:**

- Consumes: `KUBECONFIG`, `TALOSCONFIG`, node list from `scripts/lib/topology.sh`
- Produces: exit 0 only if no kube-proxy, KubePrism OK, etcd OK

- [ ] **Step 1: Write `scripts/verify-talos-cni-prereq.sh`**

```bash
#!/bin/sh
# Verify Talos is ready for Cilium: no kube-proxy, KubePrism :7445, etcd healthy.
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
. "${ROOT}/scripts/lib/topology.sh"

KUBECONFIG="${KUBECONFIG:?set KUBECONFIG to VIP https://192.168.68.30:6443}"
server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
case "${server}" in
  *192.168.68.30*) ;;
  *) echo "ERROR: kubeconfig server must be https://192.168.68.30:6443 (got ${server})" >&2; exit 1 ;;
esac

echo "== kube-proxy must be absent =="
if kubectl -n kube-system get ds kube-proxy >/dev/null 2>&1; then
  echo "ERROR: kube-proxy DaemonSet still exists" >&2
  exit 1
fi
kp="$(kubectl -n kube-system get pods -l k8s-app=kube-proxy --no-headers 2>/dev/null | wc -l | tr -d ' ')"
if [ "${kp}" != "0" ]; then
  echo "ERROR: kube-proxy pods still running" >&2
  exit 1
fi
echo "OK: no kube-proxy"

echo "== etcd =="
talosctl -n "${BOOTSTRAP_NODE_IP:-192.168.68.31}" service etcd | grep -qi Running
echo "OK: etcd Running"

echo "== KubePrism localhost:7445 on each node (via talosctl) =="
# Requires TALOSCONFIG; checks machine config documents include KubePrismConfig port 7445
for ip in 192.168.68.31 192.168.68.32 192.168.68.33 192.168.68.34 192.168.68.35 192.168.68.36 192.168.68.37; do
  talosctl -n "${ip}" get kubeprismconfigs -o yaml 2>/dev/null | grep -q '7445' \
    || talosctl -n "${ip}" get mc -o yaml | grep -A2 'KubePrismConfig' | grep -q '7445'
  echo "OK: ${ip} KubePrism 7445"
done

echo "prereq OK (nodes may still be NotReady until Cilium)"
```

Make executable; adjust `get kubeprismconfigs` resource name if Talos CLI differs (`talosctl get kubeprismconfigs` vs config dump) during implementation — probe with `talosctl get` help on cp01.

- [ ] **Step 2: Document in runbook/ci**

Add section **“Cilium prerequisite”**: apply-config after no-kube-proxy patch; run `verify-talos-cni-prereq.sh`; NotReady expected; regenerate kubeconfig with:

```bash
talosctl kubeconfig -n 192.168.68.31 --endpoints 192.168.68.31 -f talos/kubeconfig
# ensure server is https://192.168.68.30:6443
```

- [ ] **Step 3: Optional CI job `talos:verify-cni-prereq`**

Manual job after apply-config that runs the script (needs kubeconfig CI var + talosconfig artifact). If kubeconfig is not yet in Infisical for cluster-infra, document laptop verification for this PR and add CI job in a follow-up — **prefer including CI var `KUBECONFIG` / file var from Infisical** if already available from bootstrap artifacts.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-talos-cni-prereq.sh docs/runbook.md docs/ci.md .gitlab-ci.yml
git commit -m "$(cat <<'EOF'
feat(talos): add CNI/kube-proxy prerequisite verify script

Gate Cilium install on no kube-proxy, KubePrism :7445, and VIP kubeconfig.
EOF
)"
```

---

### Task 3: cluster-infra — merge, apply, verify live cluster

**Files:** none new (operations)

**Interfaces:**

- Consumes: Task 1–2 branch
- Produces: live cluster with proxy disabled; green light for platform-services

- [ ] **Step 1: Push branch and open MR / merge to main**

```bash
git push -u origin HEAD
# create MR via gh/glab or GitLab UI; merge after pipeline validate green
```

- [ ] **Step 2: Play `talos:apply-config` on main pipeline (trusted)**

Wait until all 7 nodes report trusted API on `.31–.37`.

- [ ] **Step 3: Refresh local kubeconfig to VIP `.30`**

```bash
export TALOSCONFIG=~/homelab/homelab-cluster-infra/talos/clusterconfig/talosconfig
talosctl kubeconfig ~/homelab/homelab-cluster-infra/talos/kubeconfig \
  -n 192.168.68.31 --endpoints 192.168.68.31 --force
# Edit/ensure clusters[].cluster.server: https://192.168.68.30:6443
kubectl --kubeconfig ~/homelab/homelab-cluster-infra/talos/kubeconfig get --raw=/livez
```

Expected: livez OK (or readyz partial while NotReady).

- [ ] **Step 4: Run prereq verify**

```bash
export KUBECONFIG=~/homelab/homelab-cluster-infra/talos/kubeconfig
export TALOSCONFIG=~/homelab/homelab-cluster-infra/talos/clusterconfig/talosconfig
~/homelab/homelab-cluster-infra/scripts/verify-talos-cni-prereq.sh
```

Expected: `prereq OK`

- [ ] **Step 5: Confirm no kube-proxy; nodes may be NotReady**

```bash
kubectl get nodes
kubectl -n kube-system get ds,pods | grep -i proxy || echo "no proxy resources"
```

Expected: 7 NotReady (or Ready only after Cilium — here NotReady); no kube-proxy.

- [ ] **Step 6: Record gate**

In MR notes / chat: “cluster-infra Cilium prereq applied YYYY-MM-DD; safe to Play platform-services deploy.”

---

### Task 4: platform-services — scaffold repo skeleton

**Files:**

- Create under `/Users/nasr/homelab/homelab-platform-services/` (clone GitLab `homelab/homelab-platform-services` if missing)

```bash
git clone http://192.168.68.12/homelab/homelab-platform-services.git ~/homelab/homelab-platform-services
# or https://gitlab.nasraldin.com/homelab/homelab-platform-services.git
```

- Create: `README.md`, `.gitignore`, `.markdownlint.yaml`, `versions.env`, `docs/*`, `platform/cilium/*`, `scripts/*`, `.gitlab-ci.yml`

**Interfaces:**

- Produces: empty pipeline-ready tree; no cluster mutation yet

- [ ] **Step 1: Clone / init and `.gitignore`**

```gitignore
.ci-tools/
.tools/
*.kubeconfig
kubeconfig
.env
.DS_Store
render/
charts/
```

- [ ] **Step 2: Write `versions.env`**

Resolve digest during this step:

```bash
helm pull oci://quay.io/cilium/charts/cilium --version 1.18.3 --destination /tmp/cilium-chart
# Inspect digest from helm output or:
helm show chart oci://quay.io/cilium/charts/cilium --version 1.18.3
```

Use the newest **1.18.x** (or docs-compatible) that supports Kubernetes 1.37. Write:

```bash
# Cilium — pin deliberately; bump with changelog note
CILIUM_VERSION=1.18.3
CILIUM_CHART=oci://quay.io/cilium/charts/cilium
# sha256 digest of the OCI chart artifact (fill from helm pull / crane)
CILIUM_CHART_DIGEST=sha256:REPLACE_AFTER_HELM_PULL
```

If 1.18.3 is unavailable, use the latest 1.18.x that `helm pull` accepts and update both version and digest.

- [ ] **Step 3: Write `platform/cilium/values.yaml`**

```yaml
# Talos 1.14 — without kube-proxy (KubePrism :7445)
# https://www.talos.dev/v1.14/kubernetes-guides/network/deploying-cilium/
ipam:
  mode: kubernetes
kubeProxyReplacement: true
k8sServiceHost: localhost
k8sServicePort: 7445
securityContext:
  capabilities:
    ciliumAgent:
      - CHOWN
      - KILL
      - NET_ADMIN
      - NET_RAW
      - IPC_LOCK
      - SYS_ADMIN
      - SYS_RESOURCE
      - DAC_OVERRIDE
      - FOWNER
      - SETGID
      - SETUID
    cleanCiliumState:
      - NET_ADMIN
      - SYS_ADMIN
      - SYS_RESOURCE
cgroup:
  autoMount:
    enabled: false
  hostRoot: /sys/fs/cgroup
hubble:
  enabled: false
# Enable only if host DNS / routing verify fails (not default):
# bpf:
#   hostLegacyRouting: true
```

- [ ] **Step 4: Write docs**

`docs/namespaces.md` — reserved table from spec (do not create).  
`docs/dependency-cluster-infra.md` — hard gate + checklist pointing at `verify-talos-cni-prereq.sh`.  
`docs/runbook-cilium.md` — Play order validate → render → deploy → verify.  
`platform/cilium/README.md` — chart URL, version, values purpose.  
`README.md` — three-repo ownership; v1 = Cilium only.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: scaffold homelab-platform-services for Cilium v1

Skeleton, pinned chart env, Talos values, and namespace/dependency docs. No deploy yet.
EOF
)"
```

---

### Task 5: platform-services — scripts (guard, render, deploy, verify)

**Files:**

- Create: `scripts/kubeconfig-guard.sh`
- Create: `scripts/helm-render.sh`
- Create: `scripts/cilium-deploy.sh`
- Create: `scripts/cilium-verify.sh`

**Interfaces:**

- Consumes: `KUBECONFIG`, `versions.env`, `platform/cilium/values.yaml`
- Produces: rendered YAML under `render/cilium.yaml`; cluster release `cilium` in `kube-system`

- [ ] **Step 1: `scripts/kubeconfig-guard.sh`**

```bash
#!/bin/sh
set -eu
: "${KUBECONFIG:?KUBECONFIG required}"
server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
case "${server}" in
  https://192.168.68.30:6443|https://192.168.68.30:6443/) ;;
  *)
    echo "ERROR: refusing kubeconfig server '${server}' — must be https://192.168.68.30:6443" >&2
    exit 1
    ;;
esac
echo "kubeconfig OK: ${server}"
```

- [ ] **Step 2: `scripts/helm-render.sh`**

```bash
#!/bin/sh
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
. "${ROOT}/versions.env"
mkdir -p "${ROOT}/render"
CHART="${CILIUM_CHART}"
if [ -n "${CILIUM_CHART_DIGEST:-}" ] && [ "${CILIUM_CHART_DIGEST}" != "sha256:REPLACE_AFTER_HELM_PULL" ]; then
  CHART="${CILIUM_CHART}@${CILIUM_CHART_DIGEST}"
fi
helm template cilium "${CHART}" \
  --version "${CILIUM_VERSION}" \
  --namespace kube-system \
  --values "${ROOT}/platform/cilium/values.yaml" \
  > "${ROOT}/render/cilium.yaml"
echo "wrote render/cilium.yaml"
```

(When using digest-only reference, drop `--version` if Helm requires one form — prefer `helm pull` then `helm template ./chart` from a digested pull for reproducibility.)

- [ ] **Step 3: `scripts/cilium-deploy.sh`**

```bash
#!/bin/sh
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
. "${ROOT}/versions.env"
"${ROOT}/scripts/kubeconfig-guard.sh"

echo "== precheck: no kube-proxy =="
if kubectl -n kube-system get ds kube-proxy >/dev/null 2>&1; then
  echo "ERROR: kube-proxy still present — finish cluster-infra prereq first" >&2
  exit 1
fi

CHART="${CILIUM_CHART}"
if [ -n "${CILIUM_CHART_DIGEST:-}" ] && [ "${CILIUM_CHART_DIGEST}" != "sha256:REPLACE_AFTER_HELM_PULL" ]; then
  CHART="${CILIUM_CHART}@${CILIUM_CHART_DIGEST}"
fi

helm upgrade --install cilium "${CHART}" \
  --version "${CILIUM_VERSION}" \
  --namespace kube-system \
  --values "${ROOT}/platform/cilium/values.yaml" \
  --wait --timeout 15m

echo "Cilium release installed"
```

- [ ] **Step 4: `scripts/cilium-verify.sh`**

Implement checks matching all 12 success criteria:

1. Helm release deployed
2. `kubectl -n kube-system get ds cilium` — desired == ready == 7
3. `kubectl -n kube-system get deploy cilium-operator` — available
4. `kubectl get nodes --no-headers | awk '$2!="Ready"{bad++} END{exit bad+0}'` and count 7
5. CoreDNS ready in `kube-system`  
   6–8. Create ephemeral ns `cilium-test-$$`, run two netshoot pods on different workers (`podAntiAffinity` / `topologySpread`), wget ClusterIP + `nslookup kubernetes.default`
6. No kube-proxy
7. `cilium status --wait` (install cilium CLI in CI)
8. `cilium connectivity test --test-namespace cilium-test-connectivity` with PodSecurity privileged label on that ns; delete ns after
9. Assert no unexpected Helm releases / namespaces from out-of-scope list

Exit non-zero on any failure; print `cilium-verify OK` on success.

- [ ] **Step 5: shellcheck + commit**

```bash
shellcheck -x scripts/*.sh
git add scripts versions.env platform
git commit -m "$(cat <<'EOF'
feat(cilium): add render/deploy/verify scripts with VIP kubeconfig guard

Precheck refuses deploy if kube-proxy remains; verify covers Ready/DNS/connectivity.
EOF
)"
```

---

### Task 6: platform-services — GitLab CI pipeline

**Files:**

- Create: `.gitlab-ci.yml`
- Modify: Infisical/vault mapping (separate small change in `vault` if needed) for `KUBECONFIG` file var on project `homelab/homelab-platform-services`

**Interfaces:**

- Consumes: CI var `KUBECONFIG` (file) pointing at VIP `.30`
- Produces: manual deploy/verify jobs

- [ ] **Step 1: Write `.gitlab-ci.yml`**

```yaml
include:
  - project: homelab/pipeline-templates
    ref: main
    file:
      - templates/lint/yaml.yml
      - templates/lint/shell.yml
      - templates/lint/markdown.yml
      - templates/security/gitleaks.yml

stages: [validate, render, deploy, verify]

variables:
  KUBECONFIG: '${CI_PROJECT_DIR}/.kube/config'

workflow:
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

.helm_kube_tools: &helm_kube_tools |
  set -euo pipefail
  apk add --no-cache bash curl tar gzip >/dev/null
  ARCH=amd64
  case "$(uname -m)" in aarch64|arm64) ARCH=arm64 ;; esac
  curl -fsSL --connect-timeout 15 --max-time 120 \
    "https://get.helm.sh/helm-v3.18.4-linux-${ARCH}.tar.gz" \
    | tar -xz -C /tmp && mv /tmp/linux-${ARCH}/helm /usr/local/bin/helm
  KVER=v1.37.0
  curl -fsSL --connect-timeout 15 --max-time 180 \
    "https://dl.k8s.io/release/${KVER}/bin/linux/${ARCH}/kubectl" \
    -o /usr/local/bin/kubectl && chmod +x /usr/local/bin/kubectl
  chmod +x scripts/*.sh
  mkdir -p .kube
  # GitLab File variable KUBECONFIG_FILE or masked var — adapt to Infisical wiring:
  if [ -n "${KUBECONFIG_FILE:-}" ] && [ -f "${KUBECONFIG_FILE}" ]; then
    cp "${KUBECONFIG_FILE}" .kube/config
  elif [ -n "${KUBECONFIG_CONTENT:-}" ]; then
    printf '%s\n' "${KUBECONFIG_CONTENT}" > .kube/config
  else
    echo "missing KUBECONFIG_FILE or KUBECONFIG_CONTENT" >&2
    exit 1
  fi
  export KUBECONFIG="${CI_PROJECT_DIR}/.kube/config"
  ./scripts/kubeconfig-guard.sh

lint:yaml:
  extends: .lint_yaml
  stage: validate

lint:shell:
  extends: .lint_shell
  stage: validate

lint:markdown:
  extends: .lint_markdown
  stage: validate

security:gitleaks:
  extends: .security_gitleaks
  stage: validate

cilium:render:
  stage: render
  image: alpine:3.21
  before_script:
    - *helm_kube_tools
  script:
    - ./scripts/helm-render.sh
  artifacts:
    paths: [render/cilium.yaml]
    expire_in: 1 week
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

cilium:deploy:
  stage: deploy
  image: alpine:3.21
  resource_group: platform-cilium
  before_script:
    - *helm_kube_tools
  script:
    - |
      echo "HARD GATE: cluster-infra must have kube-proxy disabled + KubePrism before Play"
      ./scripts/cilium-deploy.sh
  when: manual
  allow_failure: false
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

cilium:verify:
  stage: verify
  image: alpine:3.21
  needs: [cilium:deploy]
  before_script:
    - *helm_kube_tools
    - |
      # install cilium CLI
      CILIUM_CLI_VERSION=v0.18.5
      curl -fsSL --connect-timeout 15 --max-time 180 \
        "https://github.com/cilium/cilium-cli/releases/download/${CILIUM_CLI_VERSION}/cilium-linux-amd64.tar.gz" \
        | tar -xz -C /usr/local/bin cilium
  script:
    - ./scripts/cilium-verify.sh
  when: manual
  allow_failure: false
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Cache Helm/kubectl binaries with the same `.ci-tools/` pattern as cluster-infra if downloads are slow.

- [ ] **Step 2: Wire Infisical → GitLab project vars**

In `vault` (or GitLab UI): add file var `KUBECONFIG_FILE` / content for VIP `.30` kubeconfig to project `homelab/homelab-platform-services`. Do not commit secrets.

- [ ] **Step 3: Push and confirm validate+render green**

```bash
git add .gitlab-ci.yml
git commit -m "$(cat <<'EOF'
ci: add Cilium validate/render/manual deploy/verify pipeline

Deploy stays manual behind cluster-infra kube-proxy/KubePrism hard gate.
EOF
)"
git push -u origin main
```

Expected: validate + render succeed; deploy/verify waiting on Play.

---

### Task 7: platform-services — Play deploy + verify (milestone complete)

**Files:** none (operations)

- [ ] **Step 1: Confirm Task 3 gate recorded** (prereq OK)

- [ ] **Step 2: Play `cilium:deploy`**

Watch Helm wait; Cilium agent pods on 7 nodes.

- [ ] **Step 3: Play `cilium:verify`**

Expected final line: `cilium-verify OK`  
`kubectl get nodes` → 7/7 Ready  
No kube-proxy  
Connectivity test ns cleaned up

- [ ] **Step 4: Update design status / README milestone**

Mark design spec status **Implemented** for v1; note Cilium version/digest actually deployed.

- [ ] **Step 5: Commit doc status if needed**

```bash
git commit -m "docs: record Cilium v1 milestone complete"
```

---

## Spec coverage checklist

| Spec requirement                              | Task       |
| --------------------------------------------- | ---------- |
| cluster-infra CNI none + proxy disabled       | 1          |
| KubePrism :7445 verify                        | 1–3        |
| Apply to 7 nodes; NotReady OK                 | 3          |
| Hard gate before Cilium deploy                | 3, 5–6     |
| OCI chart + version + digest                  | 4–5        |
| values Talos kube-proxy-free                  | 4          |
| namespace kube-system                         | 4–5        |
| Reserved namespaces docs only                 | 4          |
| CI validate → render → manual deploy → verify | 6          |
| VIP kubeconfig guard                          | 5–6        |
| Success criteria 1–12                         | 5, 7       |
| No extra platform services                    | Global + 4 |

## Placeholder scan

None intentional remaining except `CILIUM_CHART_DIGEST=sha256:REPLACE_AFTER_HELM_PULL` which Task 4 Step 2 replaces with a real digest before merge.
