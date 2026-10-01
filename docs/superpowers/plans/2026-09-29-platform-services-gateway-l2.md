# Cilium L2 LB + Envoy Gateway (LAN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Cilium LB IPAM + L2 Announcements on the existing Cilium release, install Envoy Gateway with an explicit CRD chart, and prove LAN `curl http://test.home.internal` via reserved VIP `192.168.68.40`.

**Architecture:** Extend `platform/cilium` with L2/LB settings and CRs; install Gateway API + EG CRDs via `gateway-crds-helm`, then `gateway-helm` with `crds.enabled=false`; configure data-plane Service through an `EnvoyProxy` CR (`loadBalancerClass: io.cilium/l2-announcer`, ETP Cluster, pinned `.40`); CI enforces Cilium L2 verify before Envoy deploy.

**Tech Stack:** Cilium Helm 1.18.14, Envoy Gateway Helm/CRDs v1.9.1, Gateway API v1.6.1 (bundled), GitLab CI, kubectl/helm on VIP kubeconfig `https://192.168.68.30:6443`.

**Spec:** `docs/design/2026-09-29-gateway-l2-design.md` (also `homelab/docs/superpowers/specs/2026-09-29-platform-services-gateway-l2-design.md`).

## Global Constraints

- No MetalLB, HAProxy, Kubernetes `Ingress`, public NodePorts, or router port-forward.
- Preserve Cilium Talos settings: `kubeProxyReplacement=true`, `k8sServiceHost=localhost`, `k8sServicePort=7445`, existing capabilities/cgroup/IPAM.
- `defaultLBServiceIPAM: none`; Services must set `loadBalancerClass: io.cilium/l2-announcer` to get pool IPs / L2.
- Reserve **`192.168.68.40`** for Envoy via Cilium annotation `lbipam.cilium.io/ips` (Cilium 1.18) **and** EnvoyProxy `loadBalancerIP` (version-aware dual set; prefer annotation if one path is ignored).
- EnvoyProxy **must** set `externalTrafficPolicy: Cluster` (EG defaults to Local — incompatible with Cilium L2).
- L2 node selector: not control-plane; `workload NotIn [stateful]`; interfaces `^ens[0-9]+$` (live device `ens18`).
- L2 lease timings: leave Helm defaults.
- `k8sClientRateLimit`: qps=`10`, burst=`20`.
- EG v1.9 matrix is K8s **1.33–1.36**; cluster is **1.37** — document risk; do not claim official support.
- Install CRDs with `oci://docker.io/envoyproxy/gateway-crds-helm:v1.9.1` first; main chart `crds.enabled=false`.
- Kubeconfig guard: only `https://192.168.68.30:6443`.
- Companion fix: `lab-home-pve01` network docs — replace `.100–.119` LB reservation with `.40–.49`; DHCP `.50`–`192.168.71.250`.

---

## File map

| Path                                                                                    | Responsibility                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `lab-home-pve01/docs/architecture/network.md`                                           | Correct LB + DHCP inventory                    |
| `platform/cilium/values.yaml`                                                           | L2 enable, rate limits, `defaultLBServiceIPAM` |
| `platform/cilium/lb-ip-pool.yaml`                                                       | `CiliumLoadBalancerIPPool` `.40–.49`           |
| `platform/cilium/l2-announcement-policy.yaml`                                           | L2 policy + selectors                          |
| `scripts/cilium-deploy.sh`                                                              | Also apply pool + L2 policy after Helm         |
| `scripts/cilium-l2-verify.sh`                                                           | Gate before Envoy                              |
| `versions.env`                                                                          | EG + CRD pins                                  |
| `platform/envoy-gateway/values.yaml`                                                    | Main chart; `crds.enabled=false`               |
| `platform/envoy-gateway/envoyproxy.yaml`                                                | Data-plane LB Service shape + `.40`            |
| `platform/envoy-gateway/gatewayclass.yaml`                                              | Shared class → EnvoyProxy                      |
| `platform/envoy-gateway/gateway.yaml`                                                   | Shared LAN Gateway HTTP:80                     |
| `platform/envoy-gateway/test/*`                                                         | Ephemeral `gateway-test` app + HTTPRoute       |
| `scripts/envoy-gateway-deploy.sh`                                                       | CRDs → Helm → apply CRs                        |
| `scripts/envoy-gateway-verify.sh`                                                       | Controller + Gateway + `.40`                   |
| `scripts/gateway-test-apply.sh` / `gateway-test-verify.sh` / `gateway-test-teardown.sh` | Smoke lifecycle                                |
| `docs/runbook-gateway-l2.md`                                                            | Operator runbook                               |
| `docs/dependency-cluster-infra.md`                                                      | Point at L2/LB prerequisites                   |
| `docs/namespaces.md`                                                                    | `envoy-gateway-system`, `gateway-test`         |
| `README.md`                                                                             | Milestone status                               |
| `.gitlab-ci.yml`                                                                        | Ordered render/deploy/verify jobs              |

---

### Task 1: Fix foundation LAN inventory docs

**Files:**

- Modify: `lab-home-pve01/docs/architecture/network.md`
- Modify (if still present): any inventory table that lists `.100–.119` as LB pool

**Interfaces:**

- Produces: Documented truth — LB `.40–.49`, DHCP `.50`–`192.168.71.250`
- Consumes: Approved design IP map

- [ ] **Step 1: Update network.md reserved table**

Replace the “Reserved for later” / LB row so it matches:

```markdown
| Range                    | Use                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `.14`–`.29`, `.38`–`.39` | Static guests / future infra (avoid DHCP)                                            |
| `.40`–`.49`              | **Kubernetes LoadBalancer (Cilium LB IPAM only)** — `.40` reserved for Envoy Gateway |
| `.50`–`192.168.71.250`   | TP-Link DHCP                                                                         |
```

Remove any claim that `.100–.119` is the Kubernetes LB pool.

- [ ] **Step 2: Sanity-check for stale `.100–.119` LB wording**

Run: `rg -n '100.?119|LoadBalancer pool' lab-home-pve01/docs -g '*.md'`  
Expected: no remaining “LB pool = .100–.119” guidance (or updated to point at `.40–.49`).

- [ ] **Step 3: Commit in `lab-home-pve01`**

```bash
cd /Users/nasr/homelab/lab-home-pve01
git checkout -b docs/lb-pool-40-49
git add docs/architecture/network.md
git commit -m "$(cat <<'EOF'
docs(network): reserve .40-.49 for Cilium LB IPAM

DHCP is .50-.71.250; the old .100-.119 LB reservation was wrong and
unsafe. Document .40 for Envoy Gateway and .41-.49 as spare LB IPs.
EOF
)"
```

---

### Task 2: Cilium Helm values for L2 + IPAM defaults

**Files:**

- Modify: `homelab-platform-services/platform/cilium/values.yaml`
- Modify: `homelab-platform-services/scripts/cilium-deploy.sh` (only if needed for comments; apply CRs in Task 3)

**Interfaces:**

- Produces: Helm values enabling L2, `defaultLBServiceIPAM=none`, client rate limits
- Consumes: Existing Talos Cilium values (must remain)

- [ ] **Step 1: Extend `platform/cilium/values.yaml`**

Append (do not remove existing keys):

```yaml
# L2 Announcements (beta upstream) — LAN ARP for LoadBalancer IPs.
# Requires kubeProxyReplacement=true (already set).
l2announcements:
  enabled: true
  # Keep default leaseDuration / leaseRenewDeadline / leaseRetryPeriod.

# Only Services that opt into Cilium (loadBalancerClass / matching pool
# selector) receive LB IPs. Prevents accidental pool consumption.
defaultLBServiceIPAM: none

# L2 leader election increases API usage; size for ≤10 LB Services.
# QPS ≈ services / leaseRenewDeadline ≈ 10/5 = 2; use headroom.
k8sClientRateLimit:
  qps: 10
  burst: 20
```

- [ ] **Step 2: Render locally and assert keys**

```bash
cd /Users/nasr/homelab/homelab-platform-services
export PATH="${PWD}/.ci-tools:$PATH"
./scripts/helm-render.sh
rg -n 'enable-l2-announcements|default-lb-service-ipam|k8s-client-qps|k8s-client-burst|kube-proxy-replacement|7445' render/cilium.yaml
```

Expected: L2 enabled, IPAM default `none`, qps/burst present, kube-proxy-replacement still true, KubePrism `7445` still present.

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/gateway-l2-envoy   # or continue branch for whole milestone
git add platform/cilium/values.yaml
git commit -m "feat(cilium): enable L2 announcements and defaultLBServiceIPAM=none"
```

---

### Task 3: Cilium LB IP pool + L2 announcement policy

**Files:**

- Create: `platform/cilium/lb-ip-pool.yaml`
- Create: `platform/cilium/l2-announcement-policy.yaml`
- Modify: `scripts/cilium-deploy.sh`

**Interfaces:**

- Produces: Pool `.40–.49` selecting Services with label `homelab.nasraldin.com/cilium-lb: "true"`; L2 policy announcing those LB IPs from non-stateful workers on `ens*`
- Consumes: Task 2 Helm L2 enabled

- [ ] **Step 1: Create `platform/cilium/lb-ip-pool.yaml`**

```yaml
apiVersion: cilium.io/v2
kind: CiliumLoadBalancerIPPool
metadata:
  name: homelab-lan-lb
spec:
  # Only Services that opt in (and use Cilium LB class) may consume this pool.
  serviceSelector:
    matchLabels:
      homelab.nasraldin.com/cilium-lb: 'true'
  blocks:
    - start: '192.168.68.40'
      stop: '192.168.68.49'
```

- [ ] **Step 2: Create `platform/cilium/l2-announcement-policy.yaml`**

```yaml
apiVersion: cilium.io/v2alpha1
kind: CiliumL2AnnouncementPolicy
metadata:
  name: homelab-lan-l2
spec:
  loadBalancerIPs: true
  externalIPs: false
  serviceSelector:
    matchLabels:
      homelab.nasraldin.com/l2-announce: 'true'
  nodeSelector:
    matchExpressions:
      - key: node-role.kubernetes.io/control-plane
        operator: DoesNotExist
      - key: workload
        operator: NotIn
        values:
          - stateful
  interfaces:
    - '^ens[0-9]+$'
```

- [ ] **Step 3: Update `scripts/cilium-deploy.sh` to apply CRs after Helm**

After the existing `helm upgrade --install ... --wait` block, append:

```sh
echo "== apply Cilium LB IPAM pool + L2 announcement policy =="
kubectl apply -f "${ROOT}/platform/cilium/lb-ip-pool.yaml"
kubectl apply -f "${ROOT}/platform/cilium/l2-announcement-policy.yaml"
```

- [ ] **Step 4: Deploy + smoke (cluster)**

```bash
export KUBECONFIG=/Users/nasr/.kube/config
kubectl config use-context homelab-talos
./scripts/kubeconfig-guard.sh
./scripts/cilium-deploy.sh
kubectl get ciliumloadbalancerippool homelab-lan-lb -o wide
kubectl get ciliuml2announcementpolicy homelab-lan-l2 -o yaml | head -60
kubectl -n kube-system get cm cilium-config -o yaml | rg 'enable-l2-announcements|default-lb-service-ipam|k8s-client-qps'
```

Expected: Helm succeeds without reboot storm; pool exists; L2 policy exists; ConfigMap shows L2 on and default IPAM none.

- [ ] **Step 5: Commit**

```bash
git add platform/cilium/lb-ip-pool.yaml platform/cilium/l2-announcement-policy.yaml scripts/cilium-deploy.sh
git commit -m "feat(cilium): add LB IP pool .40-.49 and L2 announcement policy"
```

---

### Task 4: Cilium L2 verify gate script + CI job

**Files:**

- Create: `scripts/cilium-l2-verify.sh`
- Modify: `.gitlab-ci.yml`
- Modify: `docs/runbook-cilium.md` (link to L2 verify)

**Interfaces:**

- Produces: Exit 0 only when L2/LB ready for Envoy; CI job `cilium:verify-l2` that Envoy deploy `needs`
- Consumes: Task 3 resources

- [ ] **Step 1: Write `scripts/cilium-l2-verify.sh`**

```sh
#!/bin/sh
# Verify Cilium L2 Announcements + LB IPAM are ready for Envoy Gateway.
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
"${ROOT}/scripts/kubeconfig-guard.sh"

echo "== Cilium agent DaemonSet =="
kubectl -n kube-system rollout status ds/cilium --timeout=180s

echo "== L2 + IPAM config =="
cm="$(kubectl -n kube-system get cm cilium-config -o yaml)"
echo "${cm}" | grep -q 'enable-l2-announcements: "true"'
echo "${cm}" | grep -Eq 'default-lb-service-ipam: "?none"?'
echo "OK: L2 enabled, defaultLBServiceIPAM=none"

echo "== LB IP pool =="
kubectl get ciliumloadbalancerippool homelab-lan-lb -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}{"\n"}' | grep -q True \
  || kubectl get ciliumloadbalancerippool homelab-lan-lb -o yaml
# Pool may expose Ready differently by version — also accept presence of blocks .40-.49:
kubectl get ciliumloadbalancerippool homelab-lan-lb -o yaml | grep -q '192.168.68.40'
kubectl get ciliumloadbalancerippool homelab-lan-lb -o yaml | grep -q '192.168.68.49'
echo "OK: pool covers .40-.49"

echo "== L2 policy =="
kubectl get ciliuml2announcementpolicy homelab-lan-l2 >/dev/null
# Fail if bad selector condition True
if kubectl get ciliuml2announcementpolicy homelab-lan-l2 -o jsonpath='{range .status.conditions[*]}{.type}={.status}{"\n"}{end}' 2>/dev/null | grep -qi 'bad.*=True'; then
  echo "ERROR: L2 policy has bad condition" >&2
  kubectl get ciliuml2announcementpolicy homelab-lan-l2 -o yaml >&2
  exit 1
fi
echo "OK: L2 policy present"

echo "== devices include ens18 on a worker =="
pod="$(kubectl -n kube-system get pod -l k8s-app=cilium -o jsonpath='{.items[0].metadata.name}')"
kubectl -n kube-system exec "${pod}" -- cilium-dbg status 2>/dev/null | grep -q ens18
echo "OK: ens18 in Cilium devices"

echo "== no MetalLB =="
if kubectl get ns metallb-system >/dev/null 2>&1; then
  echo "ERROR: metallb-system exists" >&2
  exit 1
fi
echo "OK: no MetalLB"

echo "cilium-l2-verify OK"
```

Make executable: `chmod +x scripts/cilium-l2-verify.sh`

- [ ] **Step 2: Run verify**

```bash
./scripts/cilium-l2-verify.sh
```

Expected: ends with `cilium-l2-verify OK`.

- [ ] **Step 3: Add GitLab job `cilium:verify-l2`**

In `.gitlab-ci.yml`, after `cilium:verify` (or beside it), add a manual verify job on `main` that runs `./scripts/cilium-l2-verify.sh` with `.helm_kube_tools`. Later Envoy deploy will `needs: [cilium:verify-l2]` or document that deploy script calls the gate inline — **prefer both**: deploy script calls verify at start; CI `needs` the verify job when present.

Minimal CI snippet:

```yaml
cilium:verify-l2:
  stage: verify
  image: alpine:3.21
  needs: [cilium:deploy]
  cache:
    key: '${TOOL_CACHE_PREFIX}'
    paths: [.ci-tools/]
  before_script:
    - *helm_kube_tools
  script:
    - ./scripts/cilium-l2-verify.sh
  when: manual
  allow_failure: false
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

- [ ] **Step 4: Commit**

```bash
git add scripts/cilium-l2-verify.sh .gitlab-ci.yml docs/runbook-cilium.md
git commit -m "feat(cilium): add L2/LB verify gate before Envoy"
```

---

### Task 5: Pin Envoy Gateway + CRD chart versions

**Files:**

- Modify: `versions.env`
- Create: `platform/envoy-gateway/README.md`
- Create: `platform/envoy-gateway/values.yaml`

**Interfaces:**

- Produces: Version pins + main-chart values with `crds.enabled=false`
- Consumes: None

- [ ] **Step 1: Append to `versions.env`**

```bash
# Envoy Gateway — pin patch deliberately; CRD chart MUST match main chart version.
# Official EG v1.9 Kubernetes matrix: 1.33–1.36. This cluster runs 1.37 (outside matrix).
ENVOY_GATEWAY_VERSION=v1.9.1
ENVOY_GATEWAY_CHART=oci://docker.io/envoyproxy/gateway-helm
ENVOY_GATEWAY_CRDS_CHART=oci://docker.io/envoyproxy/gateway-crds-helm
# Digests: fill after `helm pull` during implement (record in commit message / README).
```

- [ ] **Step 2: Create `platform/envoy-gateway/values.yaml`**

```yaml
# Main Envoy Gateway chart — CRDs installed separately via gateway-crds-helm.
crds:
  enabled: false

# Control-plane Service stays ClusterIP (data-plane LB is via EnvoyProxy CR).
```

- [ ] **Step 3: Create `platform/envoy-gateway/README.md`** documenting pins, CRD-first install, K8s 1.37 matrix risk, and `.40` reservation.

- [ ] **Step 4: Commit**

```bash
git add versions.env platform/envoy-gateway/values.yaml platform/envoy-gateway/README.md
git commit -m "feat(envoy-gateway): pin v1.9.1 charts with CRDs managed separately"
```

---

### Task 6: EnvoyProxy + GatewayClass + Gateway manifests

**Files:**

- Create: `platform/envoy-gateway/envoyproxy.yaml`
- Create: `platform/envoy-gateway/gatewayclass.yaml`
- Create: `platform/envoy-gateway/gateway.yaml`

**Interfaces:**

- Produces: Data-plane Service as LoadBalancer class Cilium L2, ETP Cluster, IP `.40`, labels for pool/L2 selectors
- Consumes: Task 3 pool/policy label contract (`homelab.nasraldin.com/cilium-lb`, `homelab.nasraldin.com/l2-announce`)

- [ ] **Step 1: Create `platform/envoy-gateway/envoyproxy.yaml`**

```yaml
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: EnvoyProxy
metadata:
  name: homelab-lan
  namespace: envoy-gateway-system
spec:
  provider:
    type: Kubernetes
    kubernetes:
      envoyService:
        type: LoadBalancer
        # Required: EG defaults externalTrafficPolicy to Local (breaks Cilium L2).
        externalTrafficPolicy: Cluster
        loadBalancerClass: io.cilium/l2-announcer
        # Version-aware IP pin for Cilium 1.18 LB IPAM:
        loadBalancerIP: '192.168.68.40'
        annotations:
          lbipam.cilium.io/ips: '192.168.68.40'
        labels:
          homelab.nasraldin.com/cilium-lb: 'true'
          homelab.nasraldin.com/l2-announce: 'true'
```

- [ ] **Step 2: Create `platform/envoy-gateway/gatewayclass.yaml`**

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: homelab-internal
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
  parametersRef:
    group: gateway.envoyproxy.io
    kind: EnvoyProxy
    name: homelab-lan
    namespace: envoy-gateway-system
```

- [ ] **Step 3: Create `platform/envoy-gateway/gateway.yaml`**

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: homelab-internal
  namespace: envoy-gateway-system
spec:
  gatewayClassName: homelab-internal
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: All
```

- [ ] **Step 4: Commit**

```bash
git add platform/envoy-gateway/envoyproxy.yaml platform/envoy-gateway/gatewayclass.yaml platform/envoy-gateway/gateway.yaml
git commit -m "feat(envoy-gateway): EnvoyProxy LB .40 + shared GatewayClass/Gateway"
```

---

### Task 7: Envoy deploy + verify scripts

**Files:**

- Create: `scripts/envoy-gateway-deploy.sh`
- Create: `scripts/envoy-gateway-render.sh`
- Create: `scripts/envoy-gateway-verify.sh`
- Modify: `.gitlab-ci.yml`

**Interfaces:**

- Produces: Ordered install CRDs → Helm → apply CRs; verify `.40` assigned
- Consumes: Tasks 4–6; calls `cilium-l2-verify.sh` at start of deploy

- [ ] **Step 1: Write `scripts/envoy-gateway-deploy.sh`**

```sh
#!/bin/sh
set -eu
ROOT="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
. "${ROOT}/versions.env"
"${ROOT}/scripts/kubeconfig-guard.sh"
"${ROOT}/scripts/cilium-l2-verify.sh"

echo "== Gateway API + Envoy Gateway CRDs (${ENVOY_GATEWAY_VERSION}) =="
helm upgrade --install eg-crds "${ENVOY_GATEWAY_CRDS_CHART}" \
  --version "${ENVOY_GATEWAY_VERSION}" \
  --namespace envoy-gateway-system \
  --create-namespace \
  --wait --timeout 5m

echo "== Envoy Gateway controller (crds.enabled=false) =="
helm upgrade --install eg "${ENVOY_GATEWAY_CHART}" \
  --version "${ENVOY_GATEWAY_VERSION}" \
  --namespace envoy-gateway-system \
  --values "${ROOT}/platform/envoy-gateway/values.yaml" \
  --wait --timeout 10m

echo "== EnvoyProxy + GatewayClass + Gateway =="
kubectl apply -f "${ROOT}/platform/envoy-gateway/envoyproxy.yaml"
kubectl apply -f "${ROOT}/platform/envoy-gateway/gatewayclass.yaml"
kubectl apply -f "${ROOT}/platform/envoy-gateway/gateway.yaml"

echo "envoy-gateway deploy complete"
```

- [ ] **Step 2: Write `scripts/envoy-gateway-verify.sh`**

Assert:

1. `deploy/envoy-gateway` (or chart release pods) Ready in `envoy-gateway-system`
2. `GatewayClass/homelab-internal` Accepted
3. `Gateway/homelab-internal` Programmed / addresses include `192.168.68.40` when ready
4. Data-plane Service: `type=LoadBalancer`, `loadBalancerClass=io.cilium/l2-announcer`, ETP `Cluster`, EXTERNAL-IP `192.168.68.40`
5. Annotation `lbipam.cilium.io/ips` contains `.40`
6. No `Ingress` resources cluster-wide (`kubectl get ingress -A` empty / none)
7. No MetalLB

Include a wait loop (up to ~3m) for EXTERNAL-IP assignment.

- [ ] **Step 3: Write `scripts/envoy-gateway-render.sh`** — `helm template` CRDs chart notes + main chart into `render/envoy-gateway.yaml` (for CI artifact review).

- [ ] **Step 4: Wire CI jobs**

- `envoy-gateway:render` (MR + main)
- `envoy-gateway:deploy` manual on main, `needs: [cilium:verify-l2]` (optional:true if first pipeline) **and** script still calls `cilium-l2-verify.sh`
- `envoy-gateway:verify` needs deploy

- [ ] **Step 5: Deploy and verify on cluster**

```bash
chmod +x scripts/envoy-gateway-*.sh
./scripts/envoy-gateway-deploy.sh
./scripts/envoy-gateway-verify.sh
kubectl -n envoy-gateway-system get svc -o wide
```

Expected: EXTERNAL-IP `192.168.68.40`.

- [ ] **Step 6: Commit**

```bash
git add scripts/envoy-gateway-*.sh .gitlab-ci.yml
git commit -m "feat(envoy-gateway): CRD-first Helm deploy and verify for VIP .40"
```

---

### Task 8: Temporary `gateway-test` app + HTTPRoute

**Files:**

- Create: `platform/envoy-gateway/test/namespace.yaml`
- Create: `platform/envoy-gateway/test/deployment.yaml`
- Create: `platform/envoy-gateway/test/service.yaml`
- Create: `platform/envoy-gateway/test/httproute.yaml`
- Create: `scripts/gateway-test-apply.sh`
- Create: `scripts/gateway-test-verify.sh`
- Create: `scripts/gateway-test-teardown.sh`

**Interfaces:**

- Produces: `HTTPRoute` host `test.home.internal` → shared Gateway
- Consumes: Task 7 Gateway Ready + `.40`

- [ ] **Step 1: Manifests**

`namespace.yaml` — `gateway-test`  
`deployment.yaml` — e.g. `hashicorp/http-echo` or `registry.k8s.io/e2e-test-images/agnhost:2.45` with `--http-port=8080`  
`service.yaml` — ClusterIP port 80 → 8080  
`httproute.yaml`:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: test-home-internal
  namespace: gateway-test
spec:
  parentRefs:
    - name: homelab-internal
      namespace: envoy-gateway-system
  hostnames:
    - test.home.internal
  rules:
    - backendRefs:
        - name: gateway-test
          port: 80
```

- [ ] **Step 2: Scripts**

- `gateway-test-apply.sh` — `kubectl apply -f platform/envoy-gateway/test/`
- `gateway-test-verify.sh` — wait HTTPRoute Accepted; `curl -fsS -H 'Host: test.home.internal' http://192.168.68.40/` succeeds; document `/etc/hosts` path for humans
- `gateway-test-teardown.sh` — delete ns `gateway-test` only (leave Gateway/Envoy/Cilium)

- [ ] **Step 3: LAN validation**

On a LAN machine (or Mac with hosts entry):

```bash
# temporary
echo '192.168.68.40 test.home.internal' | sudo tee -a /etc/hosts
curl -fsS http://test.home.internal/
```

Expected: HTTP 200 from echo/agnhost.

Also: `kubectl -n kube-system get lease | rg cilium-l2announce` shows a non-stateful worker as holder.

- [ ] **Step 4: Commit**

```bash
git add platform/envoy-gateway/test scripts/gateway-test-*.sh
git commit -m "feat(envoy-gateway): ephemeral gateway-test HTTPRoute for LAN smoke"
```

---

### Task 9: Docs + README + dependency notes + final verify

**Files:**

- Create: `docs/runbook-gateway-l2.md`
- Modify: `docs/dependency-cluster-infra.md`
- Modify: `docs/namespaces.md`
- Modify: `README.md`
- Modify: `docs/runbook-cilium.md` (L2 beta note + verify gate)

**Interfaces:**

- Produces: Operator-facing runbook matching success criteria
- Consumes: All prior tasks

- [ ] **Step 1: Write runbook** covering ordered Plays: Cilium deploy → cilium:verify-l2 → envoy deploy → envoy verify → gateway-test → teardown test; K8s 1.37/EG v1.9 risk; L2 beta; no insecure TLS / no MetalLB.

- [ ] **Step 2: Update README milestone table** — Gateway L2 + Envoy as current networking milestone.

- [ ] **Step 3: Re-run full gates**

```bash
./scripts/cilium-verify.sh          # existing connectivity still OK
./scripts/cilium-l2-verify.sh
./scripts/envoy-gateway-verify.sh
./scripts/gateway-test-verify.sh
kubectl get ingress -A
```

Expected: all OK; no Ingress; `.40` still Envoy.

- [ ] **Step 4: Optional teardown of test only**

```bash
./scripts/gateway-test-teardown.sh
```

- [ ] **Step 5: Final commit**

```bash
git add docs README.md
git commit -m "docs: Gateway L2 + Envoy runbook and milestone status"
```

- [ ] **Step 6: Open MR, wait pipeline, merge** when green (same GitLab flow as metrics-server).

---

## Self-review (plan vs spec)

| Spec requirement                                                    | Task    |
| ------------------------------------------------------------------- | ------- |
| Pool `.40–.49`, DHCP `.50+`, not VIP `.30`                          | 1, 3    |
| Fix foundation `.100–.119` docs                                     | 1       |
| L2 beta + kube-proxy replacement preserved                          | 2, 4    |
| `defaultLBServiceIPAM=none`                                         | 2       |
| Explicit `loadBalancerClass` + labels                               | 3, 6    |
| L2 nodes ≠ stateful; interfaces `ens*`                              | 3       |
| qps=10/burst=20; default leases                                     | 2       |
| EG CRD chart then main `crds.enabled=false`                         | 5, 7    |
| Pin `.40` version-aware (`lbipam.cilium.io/ips` + `loadBalancerIP`) | 6       |
| ETP Cluster (not Local)                                             | 6       |
| K8s 1.37 / EG v1.9 matrix risk documented                           | 5, 9    |
| CI order L2 verify before Envoy                                     | 4, 7    |
| `gateway-test` + curl                                               | 8       |
| No MetalLB/Ingress/public                                           | 4, 7, 9 |
| Keep shared platform objects; tear down test                        | 8, 9    |

No TBD placeholders remain for implementers; if Cilium pool Ready condition name differs slightly by CRD version, Task 4 already allows yaml/block fallback checks.
