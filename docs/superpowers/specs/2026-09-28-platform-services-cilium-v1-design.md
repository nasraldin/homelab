# Design: Platform Services v1 — Cilium CNI (Talos)

**Date:** 2026-09-28  
**Status:** Implemented (2026-09-28) — Cilium 1.18.14  
**Repos:** `homelab/homelab-cluster-infra`, `homelab/homelab-platform-services`

## Goal

Install **Cilium only** on the greenfield Talos cluster so all seven nodes become `Ready` with healthy pod/service/DNS networking and **no kube-proxy**, using GitLab CI + the official OCI Helm chart.

## Explicit dependency chain

```text
homelab-cluster-infra
  Talos machine config:
    CNI = none
    kube-proxy = disabled
    KubePrism = enabled (localhost:7445)
           ↓  (merge + apply to all 7 nodes + verify)
homelab-platform-services
  Cilium (kube-system):
    kubeProxyReplacement = true
    k8sServiceHost = localhost
    k8sServicePort = 7445
           ↓
7/7 nodes Ready + connectivity tests pass
```

**Hard gate:** Do **not** run the Cilium deploy job until the prerequisite PR in `homelab-cluster-infra` is merged, applied to all nodes, and verified. Do **not** migrate away from a running kube-proxy inside the Cilium pipeline — configure Talos first (greenfield).

---

## Part 1 — Prerequisite: `homelab-cluster-infra`

### Required machine configuration

Today `talos/talconfig.yaml` already sets `cniConfig.name: none`. It does **not** yet disable kube-proxy. Patches do not mention KubePrism (Talos **1.14 enables KubePrism by default on port 7445** — still must be verified on every node).

#### CNI + kube-proxy (intent)

User-required semantics:

```yaml
cluster:
  network:
    cni:
      name: none
  proxy:
    disabled: true
```

#### Talos v1.14 document form (preferred in patches)

Per [Deploy Cilium CNI](https://www.talos.dev/v1.14/kubernetes-guides/network/deploying-cilium/) for Talos ≥ 1.14, prefer multi-doc machine config:

```yaml
apiVersion: v1alpha1
kind: KubeFlannelCNIConfig
$patch: delete
---
apiVersion: v1alpha1
kind: KubeProxyConfig
enabled: false
```

Keep `talconfig.yaml` `cniConfig.name: none` as the talhelper source of truth for CNI. Add an explicit shared patch (e.g. `talos/patches/cni-none-no-kube-proxy.yaml`) that disables kube-proxy via `KubeProxyConfig` (and legacy `cluster.proxy.disabled: true` only if talhelper/Talos still requires the classic field for this cluster). Document which form is applied after `talhelper genconfig` inspection.

#### KubePrism

- Expect default: enabled, port **7445**, listen on **localhost**.
- If any node lacks it, add `KubePrismConfig` with `port: 7445`.
- Verify from each node (or via `talosctl`) that the local Kubernetes API proxy answers on `127.0.0.1:7445`.

### Apply + verify (cluster-infra pipeline / runbook)

1. Merge PR → Play **apply-config** (trusted) to all 7 nodes.
2. Confirm:
   - No `kube-proxy` DaemonSet/pods in `kube-system`
   - KubePrism reachable on every node at `localhost:7445`
   - etcd / control plane healthy
   - Nodes may remain **`NotReady`** — expected until Cilium
3. Ensure CI/operators use kubeconfig with API server **`https://192.168.68.30:6443`** (never the stale local `.80` endpoint).

### Out of scope for this PR

Cilium install, Harbor, Gateway, CSI, etc.

---

## Part 2 — `homelab-platform-services` v1 (Cilium only)

### Delivery

| Decision    | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Deploy path | GitLab CI only                                                    |
| Chart       | Official OCI: `oci://quay.io/cilium/charts/cilium`                |
| Pinning     | Explicit **version** + preferred **OCI digest** in `versions.env` |
| GitOps      | No Argo CD / Flux / Helmfile                                      |
| Stages      | `validate → render/diff → deploy (manual) → verify (manual)`      |
| Namespace   | **`kube-system`** (upstream / Cilium CLI default)                 |

Cilium is **cluster infrastructure**, not an ordinary platform app. Generic platform namespaces apply to later services only.

### Reserved namespaces (document only in v1 — do not create)

| Namespace           | Future owner                    |
| ------------------- | ------------------------------- |
| `gateway-system`    | Envoy Gateway / Gateway API     |
| `cloudflare-system` | cloudflared                     |
| `cert-manager`      | cert-manager                    |
| `infisical-system`  | Infisical                       |
| `monitoring`        | Prometheus/Grafana/Alertmanager |
| `logging`           | Loki / collectors               |
| `harbor`            | Harbor                          |
| `verdaccio`         | Verdaccio                       |
| `minio`             | MinIO                           |
| `cloudnative-pg`    | CNPG                            |
| `gitlab-runners`    | GitLab runners                  |
| `github-runners`    | GitHub runners                  |
| `storage`           | Longhorn (or chosen CSI)        |

Never install normal platform services into `default`.

### Cilium Helm values (Talos, without kube-proxy)

Aligned with Talos 1.14 “Without kube-proxy” Helm guidance ([deploying Cilium](https://www.talos.dev/v1.14/kubernetes-guides/network/deploying-cilium/)):

```yaml
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
```

Optional / conditional:

- `bpf.hostLegacyRouting: true` — only if required by the pinned Talos/Cilium combo (e.g. KubeSpan / host DNS issues). Default **omit** unless verify shows need; we are **not** enabling KubeSpan in v1.
- Hubble: **off** unless a verify step explicitly needs it (prefer `cilium status` + connectivity test without Hubble UI).

Pin chart version in `versions.env` during implementation (validate compatibility with Kubernetes **v1.37.0** and Talos **v1.14.1**; Talos docs currently exemplify Helm `--version 1.18.0`). Record **version + OCI digest** together; never float `latest`.

### CI access to the cluster

- Kubeconfig supplied via GitLab CI variable / Infisical (file or content) — **not** committed.
- Must target VIP **`https://192.168.68.30:6443`**.
- Deploy job fails closed if kubeconfig server host is not `.30` (guard against stale `.80` configs).

### Suggested repo layout (implementation)

```text
homelab-platform-services/
├── versions.env                 # CILIUM_VERSION, CILIUM_CHART_DIGEST
├── platform/
│   └── cilium/
│       ├── values.yaml          # Talos-aligned values
│       └── README.md
├── docs/
│   ├── namespaces.md            # reserved map
│   ├── runbook-cilium.md
│   └── dependency-cluster-infra.md
├── scripts/
│   ├── helm-render.sh
│   ├── cilium-deploy.sh
│   └── cilium-verify.sh         # success criteria automation
├── .gitlab-ci.yml
└── README.md
```

### Pipeline stages

| Stage       | Job                                                      | When       | Behavior                                              |
| ----------- | -------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| validate    | lint, values schema, `helm template` dry                 | auto       | No cluster mutation                                   |
| render/diff | render manifests; optional `helm diff` if release exists | auto       | Artifact for review                                   |
| deploy      | `helm upgrade --install` OCI chart → `kube-system`       | **manual** | Blocked until cluster-infra prereq documented/checked |
| verify      | success-criteria script + connectivity test ns           | **manual** | Must all pass                                         |

Deploy may include a **precheck** job (or script step) asserting: no kube-proxy, KubePrism expected, API is `.30`, CNI still none / Cilium not half-installed incorrectly.

### Success criteria (milestone complete only if all true)

1. Cilium installs from pinned OCI chart (version + digest).
2. Cilium agents healthy on all **7** nodes.
3. Cilium operator healthy.
4. All **7** nodes `Ready`.
5. CoreDNS healthy.
6. Pod-to-pod works across different workers.
7. ClusterIP service networking works.
8. Kubernetes DNS resolution works.
9. **No** kube-proxy pods/DS.
10. `cilium status` healthy.
11. Cilium connectivity tests pass in a **temporary dedicated** test namespace (label for PodSecurity if needed: `pod-security.kubernetes.io/enforce=privileged` per Talos known issue).
12. No other platform/application services added.

### Explicitly out of scope (v1)

Hubble (unless required for verify), Envoy Gateway, Gateway API routes, Cloudflare Tunnel, CSI, cert-manager, Infisical operator, monitoring, Harbor, Verdaccio, MinIO, CNPG, runners.

---

## Risks / notes

| Risk                                        | Mitigation                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| Stale kubeconfig `.80`                      | CI guard + regenerate kubeconfig from VIP `.30`                               |
| Talos 1.14 multi-doc vs classic proxy field | Prefer `KubeProxyConfig`; confirm genconfig output                            |
| Connectivity test PodSecurity               | Privileged label on ephemeral test ns only                                    |
| CoreDNS + bpf.masquerade                    | Follow Talos known issues; adjust only if DNS fails                           |
| Deploy before prereq                        | Manual deploy + documented hard gate; optional CI variable `CILIUM_PREREQ_OK` |

## References

- [Talos 1.14 — Deploy Cilium CNI](https://www.talos.dev/v1.14/kubernetes-guides/network/deploying-cilium/)
- [Talos 1.14 — KubePrism](https://docs.siderolabs.com/talos/v1.14/configure-your-talos-cluster/system-configuration/kubeprism) (default port 7445)
- Cluster VIP: `192.168.68.30:6443`
- Upstream chart: `oci://quay.io/cilium/charts/cilium`
