# Design: Platform Services — Cilium L2 LB + Envoy Gateway (LAN)

**Date:** 2026-09-29  
**Status:** Approved design (pending implementation)  
**Repos:** `homelab/homelab-platform-services` (primary), companion doc fix in `lab-home-pve01`  
**Depends on:** Cilium v1 live (1.18.14), kube-proxy off, KubePrism `:7445`, kubelet serving-cert approver, metrics-server  
**Out of scope:** Cloudflare Tunnel, MetalLB, HAProxy, Kubernetes `Ingress`, public NodePorts, router port-forward

## Goal

Prove private LAN ingress through:

```text
LAN client
  → reserved LoadBalancer IP (192.168.68.40)
  → Cilium L2 Announcement (ARP)
  → Envoy Gateway Service (LoadBalancer)
  → Gateway API Gateway
  → HTTPRoute
  → ClusterIP Service
  → application pods
```

Keep a small Cilium LB IPAM pool for future dedicated LB Services. Most hostnames share the Envoy VIP via Gateway API.

## Explicit non-goals

- No MetalLB, HAProxy VM, Ingress objects, or public exposure
- No Cloudflare Tunnel in this milestone (follow-up after LAN path is healthy)
- No repo restructure to a top-level `networking/` tree — extend existing `platform/` layout
- No claim that Envoy Gateway **v1.9** officially supports Kubernetes **1.37** (matrix lists v1.9 through **1.36**; cluster runs 1.37 — treat as untested-but-acceptable for homelab; document risk; prefer latest patch of v1.9.x)

---

## LAN inventory & IP plan

LAN CIDR: `192.168.68.0/22` · Gateway: `192.168.68.1` (TP-Link)

| Range / IP | Role |
|------------|------|
| `.1` | Router / gateway |
| `.10`–`.13` | Proxmox, Infisical, GitLab, runner |
| `.21`–`.27` | Existing app VMs |
| `.30` | Talos API VIP — **never** in LB pool |
| `.31`–`.37` | Talos nodes (cp01–03, worker01–04) |
| **`.40`–`.49`** | **Cilium LB IPAM only** (10 addresses) |
| `.50`–`192.168.71.250` | DHCP |

### Pool usage

| IP | Reservation |
|----|-------------|
| **`192.168.68.40`** | **Shared Envoy Gateway** (explicit `loadBalancerIP` / IPAM request) |
| `.41`–`.49` | Spare dedicated LB Services (rare; most apps use HTTPRoute on `.40`) |

### Companion documentation (required)

Update `lab-home-pve01/docs/architecture/network.md` (and any inventory that still says `.100–.119` is the LB pool):

- Remove incorrect `.100–.119` Kubernetes LB reservation (conflicts with DHCP starting at `.50`)
- Document `.40–.49` as exclusive Cilium/Kubernetes LoadBalancer range
- Document DHCP as `.50`–`192.168.71.250`

Portable later to MetalLB if ever needed — same reserved block; this milestone uses Cilium only.

---

## Architecture

### Cilium (extend existing `kube-system` release)

Preserve existing Talos/KubePrism settings:

- `kubeProxyReplacement: true`
- `k8sServiceHost: localhost` / `k8sServicePort: 7445`
- existing capabilities, cgroup, IPAM kubernetes, Hubble off

**Add:**

| Setting | Value | Why |
|---------|-------|-----|
| `l2announcements.enabled` | `true` | ARP for LB IPs (**beta** upstream — ship; document) |
| `defaultLBServiceIPAM` | `none` | Only Services that opt into Cilium IPAM/class get addresses |
| `k8sClientRateLimit.qps` | `10` | Sized for ≤10 LB services; default renew 5s → base ≈ 2 QPS; headroom for other API use |
| `k8sClientRateLimit.burst` | `20` | Burst above QPS for lease/election spikes |
| L2 lease timings | **defaults** | Do not tune initially |

Do **not** set Helm `devices` unless verify fails — live agents already use **`ens18`** (virtio_net) as the kube-proxy-replacement / direct-routing device.

### Declarative Cilium CRs

**`CiliumLoadBalancerIPPool`** (name e.g. `homelab-lan-lb`):

- Blocks: `192.168.68.40`–`192.168.68.49`
- Service selector matching Services that should draw from this pool (and/or allowlist via labels used by Envoy)

**`CiliumL2AnnouncementPolicy`** (name e.g. `homelab-lan-l2`):

- `loadBalancerIPs: true`
- `externalIPs: false`
- Service selector: Services intended for L2 (label e.g. `homelab.nasraldin.com/l2-announce: "true"` **and/or** match Envoy’s LB Service)
- Node selector (dynamic labels, **not** node names):
  - `node-role.kubernetes.io/control-plane` DoesNotExist
  - `workload` NotIn `["stateful"]`  
  → candidates: worker01–03 (`apps`, `apps`, `platform`); worker04 (`stateful`) excluded
- Interfaces: `["^ens[0-9]+$"]` (confirmed live: `ens18`)

**Service ownership:**

- Envoy data-plane Service **must** set:
  - `type: LoadBalancer`
  - `loadBalancerClass: io.cilium/l2-announcer`
  - `externalTrafficPolicy: Cluster` (**not** `Local` — Cilium L2 docs: Local can announce on nodes without backends and drop traffic)
  - Explicit request for **`192.168.68.40`** (via `spec.loadBalancerIP` and/or Cilium IPAM request annotation / pool + matching selector — prefer the mechanism supported cleanly by Cilium **1.18.14**; verify in implementation)

Combined with `defaultLBServiceIPAM: none`, Services without the Cilium class do not receive pool IPs or L2 announcements.

### Envoy Gateway

| Item | Choice |
|------|--------|
| Chart | `oci://docker.io/envoyproxy/gateway-helm` **v1.9.1** (or latest **v1.9.x** patch at implement time) |
| CRDs | Install **first** via pinned `oci://docker.io/envoyproxy/gateway-crds-helm` **same version**, enabling Gateway API + Envoy Gateway CRDs explicitly |
| Main chart | Install with **`crds.enabled=false`** so CRDs stay owned by the CRD chart |
| Namespace | `envoy-gateway-system` |
| Gateway API | Version bundled with the pin (**v1.6.1** for v1.9) |
| K8s compatibility | Official matrix for **v1.9**: **1.33–1.36**. Cluster is **1.37** — document as outside tested matrix; proceed for homelab unless blockers appear |
| `GatewayClass` | Shared; controller `gateway.envoyproxy.io/gatewayclass-controller` |
| `Gateway` | Shared internal LAN Gateway; HTTP `:80` for smoke (TLS later) |
| Data-plane LB | Class `io.cilium/l2-announcer`, ETP Cluster, IP **`.40`** |

### Ownership

| Object | Owner |
|--------|-------|
| Cilium Helm values + LB pool + L2 policy | `homelab-platform-services` |
| Envoy Gateway Helm + CRD chart | `homelab-platform-services` |
| `GatewayClass`, shared `Gateway` | `homelab-platform-services` |
| App `HTTPRoute` / `GRPCRoute` | Application repos (later) |
| Temporary `gateway-test` HTTPRoute | This milestone only (ephemeral) |

### Test topology

Namespace `gateway-test`:

- Deployment (simple HTTP)
- ClusterIP Service
- `HTTPRoute` host `test.home.internal` → attach to shared Gateway

LAN validation (another machine or workstation):

```text
192.168.68.40 test.home.internal   # /etc/hosts or temp DNS
curl http://test.home.internal
```

After success: keep Cilium LB/L2, Envoy, GatewayClass, Gateway; optionally delete `gateway-test`.

---

## Repository layout

Keep existing conventions (Approach A):

```text
homelab-platform-services/
├── platform/
│   ├── cilium/
│   │   ├── values.yaml                 # + L2, defaultLBServiceIPAM, rate limits
│   │   ├── lb-ip-pool.yaml
│   │   └── l2-announcement-policy.yaml
│   ├── envoy-gateway/
│   │   ├── values.yaml                 # crds.enabled=false; LB class / IP hints as needed
│   │   ├── gatewayclass.yaml
│   │   ├── gateway.yaml
│   │   └── test/
│   │       ├── namespace.yaml
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       └── httproute.yaml
│   └── metrics-server/                 # unchanged
├── scripts/
│   ├── cilium-deploy.sh                # extended
│   ├── cilium-l2-verify.sh             # new gate
│   ├── envoy-gateway-deploy.sh         # CRDs then main chart
│   ├── envoy-gateway-verify.sh
│   └── gateway-test-*.sh               # apply/verify/teardown helpers
├── versions.env                        # + EG + CRD pins
└── .gitlab-ci.yml
```

---

## CI / apply order

GitLab CI + Helm only (no Argo/Flux). Conceptual stages:

```text
validate → render/diff → manual deploy → verify
```

**Hard order (enforce in jobs / needs):**

1. **Cilium upgrade** — values with L2 + `defaultLBServiceIPAM=none` + rate limits; preserve Talos settings  
2. Apply `CiliumLoadBalancerIPPool` + `CiliumL2AnnouncementPolicy`  
3. **`cilium-l2-verify`** — Cilium healthy; pool Ready; L2 policy Accepted; devices include `ens18`; no MetalLB  
4. Install **gateway-crds-helm** (pinned)  
5. Install **gateway-helm** with `crds.enabled=false`  
6. Apply GatewayClass + Gateway  
7. **`envoy-gateway-verify`** — controller Ready; GatewayClass Accepted; Gateway Programmed; Service has **`192.168.68.40`**; `loadBalancerClass` correct; ETP Cluster  
8. Apply `gateway-test` + HTTPRoute  
9. LAN curl / ARP checks (document workstation steps; automate what CI can from runner LAN)  
10. Re-run existing Cilium connectivity verify (must still pass)

Envoy deploy **must not** run until Cilium L2/LB verify passes.

---

## Rate-limit sizing note

Upstream: `QPS ≈ #services × (1 / leaseRenewDeadline)`.

With ≤10 LB Services and default `leaseRenewDeadline=5s`:

`10 × (1/5) = 2` QPS worst-case renew traffic per busy node.

Chosen **qps=10 / burst=20** provides headroom without copying large-cluster examples. Revisit only if API-server client throttling appears in Cilium agent logs.

---

## Success criteria

1. Cilium remains fully healthy (existing connectivity tests pass).  
2. L2 Announcements enabled (beta documented).  
3. LB IPAM pool `.40–.49` healthy; non-overlapping with DHCP/static map.  
4. Envoy Gateway controller healthy in `envoy-gateway-system`.  
5. `GatewayClass` Accepted.  
6. `Gateway` Programmed/Ready.  
7. Envoy LB Service has **`192.168.68.40`**, class `io.cilium/l2-announcer`, ETP Cluster.  
8. `.40` reachable from another LAN host.  
9. ARP/L2 leadership can move among worker01–03 (failover smoke).  
10. Temporary HTTPRoute Accepted; backends resolved.  
11. `curl http://test.home.internal` succeeds via `.40`.  
12. No MetalLB, HAProxy, Ingress, router DNAT, or public exposure.  
13. `defaultLBServiceIPAM=none` — non-classed LoadBalancers do not steal pool IPs.  
14. Foundation docs no longer advertise `.100–.119` as the LB pool.

---

## Risks & notes

| Risk | Mitigation |
|------|------------|
| L2 Announcements are **beta** | Document; verify ARP + failover; rollback = disable L2 + remove pool/policy |
| EG v1.9 not matrix-tested on K8s 1.37 | Document; pin patch; watch controller logs; fall back to v1.9.x or wait for matrix update if broken |
| `externalTrafficPolicy: Local` | Forbidden on L2-announced Services in this design |
| Wrong NIC regex | Confirmed `ens18`; use `^ens[0-9]+$`; re-check after NIC changes |
| Duplicate IP if DHCP/docs drift | Companion `lab-home-pve01` doc update in same milestone |

---

## Implementation sequencing (when planning)

1. Spec approved → write implementation plan (`writing-plans`)  
2. Companion network.md update in `lab-home-pve01`  
3. Cilium values + CRs + verify gate  
4. Envoy CRDs → Helm → Gateway objects + verify  
5. `gateway-test` + LAN curl  
6. Tear down test ns optionally; leave shared platform objects
