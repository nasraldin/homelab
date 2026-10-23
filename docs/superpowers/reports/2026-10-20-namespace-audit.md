# Namespace usage audit — 2026-10-20

All 23 live namespaces were checked across every discoverable namespaced resource type. No resource-list requests failed. No unused namespace was identified, so none was deleted.

Namespaces without pods:

| Namespace | Reason retained |
| --- | --- |
| default | Kubernetes default namespace; explicitly requested retention. |
| kube-public | Kubernetes system namespace and bootstrap RBAC. |
| kube-node-lease | Heartbeat leases for all eight nodes. |
| cilium-secrets | Live Cilium configuration enables policy secret synchronization and names this namespace; TLS-interception RBAC is installed. |
| lab-portless | Eight HTTPRoutes, three backends and a backend TLS policy serve active local/public URLs. |
| ajrly | Hibernated pre-migration database cluster, six bound PVCs and recovery metadata. Retained as migration recovery data, not an active database endpoint. |

The other 17 namespaces contain workload pods. ai-hermes and ai-sandbox are already absent following consolidation into ai. No source manifest changes were necessary.

## Resource counts

| Namespace | Resource objects excluding events |
| --- | --- |
| ai | 248 |
| aistor | 52 |
| ajrly | 74 |
| artifacts | 214 |
| cert-manager | 38 |
| cilium-secrets | 6 |
| cloudflare-system | 34 |
| cnpg-system | 44 |
| csi-proxmox | 44 |
| default | 7 |
| envoy-gateway-system | 67 |
| gitlab-runners | 121 |
| infisical-system | 31 |
| kube-node-lease | 10 |
| kube-public | 4 |
| kube-system | 195 |
| kubelet-serving-cert-approver | 11 |
| lab-dns | 14 |
| lab-portless | 15 |
| observability | 333 |
| postgres | 188 |
| redis | 55 |
| sonarqube | 40 |
