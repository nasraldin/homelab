# Monitoring (`monitoring-01`)

LAN: `192.168.68.25` · VMID **121** · **4c / 16G / 100G**

## Stack (`/opt/monitoring`)

| Component | Role |
| --------- | ---- |
| Prometheus | Metrics TSDB |
| Grafana | Dashboards (provisioned) |
| Loki | **Primary** lab logs (Option A vs Elastic) |
| Alloy (central) | Receive / scrape |
| blackbox_exporter | HTTP/TCP probes |
| prometheus-pve-exporter | Proxmox API metrics |

## Fleet agents

Ansible role `observability_agent` on **every** guest:

- node_exporter (lab CIDR; scrape from monitoring-01 only)
- Alloy → Loki (+ optional remote_write)
- Docker/Podman: container metrics/logs

## Dashboards (provisioned)

Homelab overview, Proxmox, node fleet, Docker/Podman, data plane, apps/IdP/quality, Vault/DNS, GitLab/CI, logs, SLO probes.

## Option A

Elastic (`elastic-01`) is **not** the day-one log sink. See [elastic.md](elastic.md).

## Playbook

```bash
ansible-playbook playbooks/monitoring.yml -e @secrets.yml
```
