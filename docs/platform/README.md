# Deploy Shared Platform Services with Argo CD

Platform services are the shared pieces that live **inside** the cluster after GitOps exists: registry, ticketing integrations, and similar day-2 tooling. They land via Argo CD in Phases 7–9 — not via one-off `helm install` on the laptop.

Decide VM vs Kubernetes placement first ([service placement](../architecture/service-placement.md)); this section assumes the service belongs in-cluster.

## What this page covers

- Index of Harbor and ITSM/automation docs
- Where platform services sit in the phase plan
- Pointer to VM vs k8s placement decisions

| Doc | Topic |
| --- | ----- |
| [Harbor registry](harbor-registry.md) | Proxy cache, replication, projects — Harbor vs Zot |
| [ITSM and n8n](itsm-and-automation.md) | Zammad vs GLPI/iTop; n8n automates, does not ticket |
