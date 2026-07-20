# ITSM, helpdesk, and n8n — what goes where

Customer-facing **tickets** need an ITSM/helpdesk product. **n8n** is a workflow
engine — it reacts to tickets; it does not replace them.

---

## Core rule

| Tool type | Role | Examples |
| --------- | ---- | -------- |
| **ITSM / helpdesk** | System of record for tickets, SLAs, agents | Zammad, GLPI, iTop, UVdesk |
| **Workflow automation** | Webhooks, notifications, integrations | **n8n** |
| **Monitoring** | Metrics/alerts (not tickets) | Prometheus, Grafana |
| **Security incidents** | SIEM/XDR | Wazuh |

```text
Customer / user
      │
      ▼
 Zammad (ticket #12345)     ← system of record
      │
      │ webhook / REST API
      ▼
 n8n                         ← automation only
      │
      ├── Slack / Discord
      ├── GitLab issue
      ├── Prometheus query
      └── Email customer
```

**Never:** “We’ll use n8n forms as our ticket system.”  
**Do:** Zammad (or GLPI) creates the ticket; n8n orchestrates side effects.

This matches [proxmox-updates.md](../operations/proxmox-updates.md): n8n is optional **fan-out**, not the primary update checker.

---

## Open-source options (when to pick which)

### Zammad — customer support (SaaS / external users)

**Closest to:** Zendesk, Freshdesk, Intercom (ticket side)

| Strength | Weakness |
| -------- | -------- |
| Customer portal, email→ticket, chat | Not full ITIL/CMDB |
| SLA, groups, KB, REST, webhooks | Heavier than FreeScout |
| Multi-channel | |

**Pick when:** your product has **external customers** opening complaints, incidents, or service requests.

### GLPI — ServiceNow-style ITSM (internal + assets)

**Closest to:** ServiceNow (breadth), with CMDB/assets

| Strength | Weakness |
| -------- | -------- |
| Incident, request, change, CMDB, assets | UI less “modern SaaS” than Zammad |
| Contracts, SLA, KB | Heavier setup |

**Pick when:** you want **internal IT** + asset lifecycle + change management.

### iTop — ITIL / CMDB-centric

**Closest to:** ServiceNow ITSM process model

| Strength | Weakness |
| -------- | -------- |
| Strong ITIL (incident → CI → service) | Enterprise feel, learning curve |
| CMDB relationships | |

**Pick when:** practicing **ITIL** and enterprise incident→CI traceability.

### Lighter options

| Tool | Use |
| ---- | --- |
| **FreeScout** | Email-only shared inbox — minimal |
| **UVdesk** | SaaS-style portal + KB — middle ground |

---

## Recommendation matrix

| Your goal | Start with | Add later |
| --------- | ---------- | --------- |
| **SaaS customer support** | **Zammad** + n8n | Outline (KB), Keycloak/ZITADEL SSO |
| **Internal homelab / IT ops** | GitLab issues or Zammad (small team) | GLPI or iTop |
| **Full “open ServiceNow” stack** | Zammad (customers) + **iTop or GLPI** (ITIL) + **NetBox** (CMDB/network) | See table below |
| **Homelab only (no customers)** | Skip ITSM; GitLab issues + Grafana alerts | Zammad when building SaaS |

---

## “ServiceNow alternative” stack (reference)

| Capability | Open-source option | This homelab |
| ---------- | ------------------ | ------------ |
| Customer tickets | **Zammad** | Phase 10+ (k8s) when building SaaS |
| ITIL / internal ITSM | iTop or GLPI | Optional lab VM |
| CMDB / IPAM | **NetBox** | Optional — complements Terraform |
| Automation | **n8n** | k8s — webhooks from Zammad, Proxmox scripts |
| Monitoring | Prometheus + Grafana | k8s Phase 9 |
| Security incidents | Wazuh | Dedicated VM Phase 11+ |
| Knowledge base | Outline, or Zammad KB | With Zammad |
| Identity | Keycloak (already planned) | k8s Phase 8 |

---

## Placement in this homelab

| Service | Where | Phase | Why |
| ------- | ----- | ----- | --- |
| **Zammad** | ☸ Kubernetes | 10+ | SaaS-facing; scales with ingress + Longhorn |
| **GLPI / iTop** | 🖥 VM or ☸ | lab | Heavy; VM OK if you want isolation from app cluster |
| **n8n** | ☸ Kubernetes | 10 | Already in roadmap — **after** ticket system exists |
| **NetBox** | 🖥 VM or ☸ | optional | CMDB — not a ticket system |
| **FreeScout** | 🖥 Docker VM | lab | Quick email inbox experiment |

**Recoverability:** if k8s is down, customers cannot open tickets anyway (SaaS is down). For **internal** ITSM during outages, run GLPI on a **small VM** outside the app cluster — same pattern as GitLab.

---

## Example: production issue from a customer

```text
1. Customer → portal or email → Zammad ticket #12345 (High, SLA 8h)
2. Zammad webhook → n8n workflow
3. n8n:
      - Post to Slack #incidents
      - Query Grafana/Prometheus (last 1h errors)
      - Optional: create GitLab incident issue
      - Assign group in Zammad via API
4. Engineer resolves in Zammad; customer notified by Zammad (not n8n alone)
```

n8n never owns ticket state — only **automates** around Zammad.

---

## Homelab learning path

| Stage | Action |
| ----- | ------ |
| Now | GitLab Issues for homelab tasks; Grafana alerts for infra |
| Phase 10 | Deploy **n8n** in k8s; webhook from Proxmox update script (optional) |
| When building SaaS | Deploy **Zammad**; connect n8n; SSO via Keycloak |
| Enterprise interview prep | Spin **iTop** or **GLPI** lab VM; link incident → CI |

---

## Related

- [service-placement.md](../architecture/service-placement.md)
- [proxmox-updates.md](../operations/proxmox-updates.md) — n8n as Layer 3 optional
- [platform/README.md](README.md)
