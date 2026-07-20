# Wazuh — SIEM / XDR in this homelab

What Wazuh is, how it differs from Prometheus/Grafana/Falco/Kyverno, and
**when** to add it to your platform engineering lab.

---

## What Wazuh is

**Open-source security platform** — SIEM + host monitoring + file integrity +
vulnerability detection + compliance reporting + optional active response.

```text
Endpoints (agents or agentless)
  Proxmox, Linux VMs, k8s nodes, (optional Mac/Windows)
        │
        ▼
  Wazuh manager  ← rules, correlation, alerts
        │
        ▼
  OpenSearch indexer  ← log/event storage
        │
        ▼
  Wazuh dashboard  ← SOC-style UI, compliance reports
```

**Question it answers:** *“Did something security-relevant happen?”*  
(not *“Is CPU high?”* — that’s Prometheus/Grafana)

---

## Main capabilities (enterprise mapping)

| Feature | What it does | Veeam/enterprise analogue |
| ------- | ------------ | ------------------------- |
| **SIEM** | Collect & correlate logs | Splunk, Sentinel, QRadar |
| **EDR / XDR** | Process, malware, suspicious behavior | CrowdStrike, Defender |
| **FIM** | `/etc/passwd`, sshd_config changes | Change auditing |
| **Vuln detection** | CVEs in installed packages | Qualys, Tenable (light) |
| **Compliance** | CIS, PCI, GDPR report templates | GRC tooling |
| **Active response** | Auto-block IP after brute force | SOAR playbooks (simple) |

Homelab value: practice **SOC workflows** — alerts, triage, dashboards — without
Splunk licensing.

---

## Where it fits in **your** stack

Your lab uses **NGINX Ingress** (not Traefik). Security layers by phase:

```text
BUILD          DEPLOY           RUNTIME           INFRA
─────          ──────           ───────           ─────
Trivy/Syft     Kyverno          Falco             Wazuh agents
Cosign         (admission)      (k8s syscalls)    (hosts + logs)
Harbor scan                      │
                                 ▼
                          Prometheus/Grafana/Loki
                          (health + app logs)
```

| Tool | Layer | Role |
| ---- | ----- | ---- |
| **Kyverno** | Deploy | Block bad manifests (policy) |
| **Trivy** | Build + scan | Image/config CVEs |
| **Falco** | K8s runtime | Container threat detection |
| **Wazuh** | Host + SIEM | VMs, Proxmox, auth logs, FIM, compliance |
| **Prometheus** | Metrics | SLOs, capacity |
| **Loki** | App logs | Debug, tracing adjacency |
| **Wazuh/OpenSearch** | Security events | Incidents, audit, compliance |

**They complement each other** — Wazuh does not replace Prometheus or Loki.

---

## Wazuh vs tools you’ll already run

| | Prometheus + Grafana | Loki | Falco | Kyverno | Wazuh |
| - | -------------------- | ---- | ----- | ------- | ----- |
| **Focus** | Metrics | App logs | K8s runtime threats | Admission policy | SIEM / endpoint / compliance |
| **“SSH brute force?”** | No | Maybe (if parsed) | Maybe | No | **Yes (built-in rules)** |
| **“File /etc/shadow changed?”** | No | No | No | No | **Yes (FIM)** |
| **“Unsigned image?”** | No | No | No | **Yes** | No |
| **“Shell in container?”** | No | No | **Yes** | No | Partial |

---

## Where to deploy in homelab

### Manager stack (heavy)

Run **Wazuh manager + indexer + dashboard** as:

| Option | Pros | Cons |
| ------ | ---- | ---- |
| **Dedicated VM** (recommended) | Isolated RAM/CPU; survives k8s rebuild | Another VM to manage |
| **Kubernetes** (Helm) | GitOps-native | ~8–16 GB RAM; noisy neighbor with GitLab |

**Phase:** **11+** — after Prometheus/Grafana/Loki and core platform are stable.

### Agents (light)

Install Wazuh **agent** on:

| Target | Priority | Why |
| ------ | -------- | --- |
| **pve01** (Proxmox) | High | Hypervisor is crown jewel |
| **kubeadm / Talos nodes** | High | Cluster compromise detection |
| **GitLab VM** (if VM) | Medium | Auth + repo audit |
| **Mac** (optional) | Low | Learn endpoint monitoring; not required |
| **Inside every pod** | No | Use Falco for k8s runtime |

Agents forward to manager; low overhead (~100–200 MB each).

---

## Architecture (target)

```text
                    Internet
                        │
                 Cloudflare Tunnel
                        │
              NGINX Ingress (k8s)
                        │
         ┌──────────────┴──────────────┐
         │         Kubernetes          │
         │  Argo CD, Harbor, apps…       │
         │  Falco (daemonset)            │
         └──────────────┬──────────────┘
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
 pve01              wazuh-01 VM          GitLab VM
 (agent)            manager+indexer       (agent)
                         │
                    OpenSearch
                         │
                   Wazuh dashboard
                         │
              alerts → email / Slack / n8n
```

**Log flow:** Proxmox, sshd, NGINX, Keycloak, Harbor → agent → manager → rules → alert.

You do **not** need Wazuh to ingest everything on day one — start with
`pve01` + k8s nodes + sshd/auth logs.

---

## RAM impact (X1 Pro, 96 GB)

Wazuh + OpenSearch is **not light**:

| Component | Rough RAM |
| --------- | --------- |
| Wazuh manager | 2–4 GB |
| OpenSearch indexer | 4–8 GB+ (grows with retention) |
| Dashboard | 1–2 GB |
| Agents (×5) | ~1 GB total |

**Budget ~12–16 GB** for the SOC stack. Fine on 96 GB **if** GitLab, Harbor,
and monitoring are sized with limits — don’t deploy Wazuh in Phase 6.

**Overlap note:** Wazuh ships with **OpenSearch**. You might run **Loki for apps**
and **Wazuh/OpenSearch for security** — two log systems is normal in enterprise
(Splunk + Datadog, etc.). Don’t merge them on day one.

---

## Phase placement (your roadmap)

| Phase | Security focus |
| ----- | -------------- |
| 0–1 | Proxmox hardening, backups, tunnel |
| 6–7 | kubeadm + Argo CD |
| 8 | Harbor, MinIO, Keycloak |
| 9 | Kyverno, Velero, **Falco**, ESO, Prometheus/Grafana/Loki |
| 10 | AI workloads |
| **11+** | **Wazuh**, GitLab runners hardening, advanced compliance |

**Order:** Kyverno + Falco + observability **before** Wazuh. Wazuh without
metrics/logs baseline = alert fatigue with no context.

---

## What to learn for Platform Engineer interviews

| Skill | Homelab demo |
| ----- | ------------ |
| Defense in depth | Diagram: Kyverno → Falco → Wazuh |
| SIEM vs metrics | “Grafana for SLOs, Wazuh for threats” |
| FIM | Show alert on sshd_config change |
| Compliance | Run CIS report on a Linux VM |
| Active response | Careful — test in lab only; document iptables ban rule |

---

## When **not** to prioritize Wazuh

| Situation | Do instead |
| --------- | ---------- |
| No k8s yet | Finish bootstrap + Terraform |
| No monitoring | Prometheus + Loki first |
| Chasing every ChatGPT tool | Kyverno + Falco cover more k8s interview ground |
| Single service homelab | `fail2ban` on Proxmox may be enough temporarily |

---

## Practical next steps (when ready)

1. Deploy **Phase 9** observability + Falco + Kyverno
2. Create VM `wazuh-01` (4 vCPU, 16 GB RAM, disk on `data01`)
3. Install Wazuh single-node (manager + indexer + dashboard) — official docs or Ansible role
4. Agent on `pve01` and k8s nodes
5. Integrate alerts with `NOTIFY_EMAIL` / n8n (same pattern as Proxmox updates)
6. Optional: forward Harbor/Keycloak logs via syslog

---

## Related

- [Supply chain & policies](supply-chain-and-policies.md) — Kyverno, Cosign, Trivy
- [Backup platform](../operations/backup-platform.md)
- [Phases §9–11](../roadmap/phases.md)
- [Wazuh documentation](https://documentation.wazuh.com/)
