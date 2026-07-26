# Monitoring (`monitoring-01`)

LAN: `192.168.68.25` · VMID **121** · **2c / 6G / 100G** (right-sized 2026-07-26)

## Stack (`/opt/monitoring`)

| Component              | Role                                                            |
| ---------------------- | --------------------------------------------------------------- |
| Prometheus             | Metrics TSDB — `http://192.168.68.25:9090`                      |
| Grafana                | Dashboards — `http://192.168.68.25:3000`                        |
| Loki                   | Optional secondary logs (primary logs → ES/Kibana via Filebeat) |
| blackbox_exporter      | HTTP probes                                                     |
| elasticsearch-exporter | ES metrics                                                      |
| pve-exporter           | Proxmox VE API metrics                                          |
| adguard-exporter       | AdGuard Home stats                                              |
| technitium-exporter    | Technitium DNS stats                                            |

## Grafana dashboards (day-one)

Provisioned from [grafana.com](https://grafana.com/grafana/dashboards/) into folders:

| Folder         | Dashboards                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Homelab        | Compact overview                                                                                                                                                                           |
| Infrastructure | [Node Exporter Full](https://grafana.com/grafana/dashboards/1860), [Proxmox](https://grafana.com/grafana/dashboards/10347) / [16805](https://grafana.com/grafana/dashboards/16805)         |
| Databases      | Postgres, Redis, MySQL/MariaDB                                                                                                                                                             |
| Identity       | Keycloak                                                                                                                                                                                   |
| Search         | Elasticsearch                                                                                                                                                                              |
| Storage        | MinIO/AIStor, Docker Registry                                                                                                                                                              |
| Security       | Hashicorp Vault                                                                                                                                                                            |
| DNS            | AdGuard ([20799](https://grafana.com/grafana/dashboards/20799), [23579](https://grafana.com/grafana/dashboards/23579)), Technitium ([24555](https://grafana.com/grafana/dashboards/24555)) |
| GitLab         | Omnibus, CI pipelines/jobs, Runner                                                                                                                                                         |
| Quality        | SonarQube                                                                                                                                                                                  |

### Deferred

**Wazuh** — no VM yet (Phase 11+).

## Scrape prerequisites (automated)

| Target     | How                                                                                  |
| ---------- | ------------------------------------------------------------------------------------ |
| Proxmox    | `monitoring@pve!exporter` API token (`vault_pve_exporter_*`)                         |
| AdGuard    | admin password → adguard-exporter on monitoring-01                                   |
| Technitium | API token `vault_technitium_api_token`                                               |
| Vault      | `telemetry.unauthenticated_metrics_access` in `vault.hcl`                            |
| GitLab     | Omnibus exporters on `:9168` / Gitaly `:9236` / Workhorse `:9229` / Registry `:5001` |
| Runner     | `listen_address = ":9252"` in `config.toml`                                          |
| SonarQube  | `SONAR_WEB_SYSTEMPASSCODE` + Bearer scrape                                           |
| MinIO      | `vault_aistor_prometheus_bearer`                                                     |

## Fleet agents

`observability_agent` on `observed`:

- **node_exporter** → Prometheus / Grafana
- **Filebeat** → Elasticsearch / Kibana Discover

## Logs vs metrics

| Signal  | Where                          |
| ------- | ------------------------------ |
| Metrics | Grafana → Prometheus           |
| Logs    | Kibana Discover → `filebeat-*` |

## Playbook

```bash
# Full stack + dashboards + exporters
ansible-playbook playbooks/monitoring.yml -e @secrets.yml

# After changing Vault telemetry / GitLab exporters / Sonar passcode:
ansible-playbook playbooks/object-storage.yml -e @secrets.yml --limit vault-01
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
ansible-playbook playbooks/sonarqube.yml -e @secrets.yml
ansible-playbook playbooks/monitoring.yml -e @secrets.yml
```
