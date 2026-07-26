# Elastic Stack (`elastic-01`)

LAN: `192.168.68.27` · VMID **123** · **8c / 32G / 200G**

## Design

- Compose under `/opt/elastic/`: **Elasticsearch** + **Kibana** + **Elasticvue**
- Cluster name: **`elastic-cluster`** (node `elastic-01`)
- Security on; passwords from Ansible Vault
- Kibana talks to ES as **`kibana_system`** (not `elastic` — forbidden in 8.x)
- UI login: user **`elastic`** / `vault_elastic_password`
- Elasticvue (`cars10/elasticvue`) preloads the LAN ES cluster via `ELASTICVUE_CLUSTERS`
  (browser calls `http://192.168.68.27:9200` with the `elastic` user — CORS enabled on ES)
- **Logs:** Filebeat on `observed` guests ships **journald → Elasticsearch**; use
  **Kibana Discover** (`filebeat-*`). Grafana is for **metrics** (Prometheus), not lab logs.
- **Snapshots:** repo `aistor` → AIStor bucket `elasticsearch-snapshots`
- ES heap ≈ half guest RAM; `vm.max_map_count≥262144`
- **ES `:9200` LAN only** — never Tunnel-public

## URLs

| Service         | URL |
| --------------- | --- |
| Kibana          | `https://kibana.nasraldin.com` → Tunnel → `http://192.168.68.27:5601` |
| Elasticvue      | `http://192.168.68.27:8080` (LAN) |
| Elasticsearch   | `http://192.168.68.27:9200` (LAN only) |

(GitLab-style: no Access, no NPM on this VM for Kibana)

## Playbook

```bash
ansible-playbook playbooks/elastic.yml -e @secrets.yml
```

## Related

- [monitoring.md](monitoring.md) — Loki remains primary logs
- [Elasticvue Docker Hub](https://hub.docker.com/r/cars10/elasticvue)
