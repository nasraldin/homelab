# Elastic Stack (`elastic-01`)

LAN: `192.168.68.27` · VMID **123** · **8c / 32G / 200G**

## Design

- Compose under `/opt/elastic/`: **Elasticsearch** + **Kibana**
- Security on; passwords from Ansible Vault
- ES heap ≈ half guest RAM; `vm.max_map_count≥262144`
- **ES `:9200` LAN only** — never Tunnel-public
- **Option A:** lab ops logs stay on Loki (`monitoring-01`); Elastic is search/SIEM practice

## Public URL

`https://kibana.nasraldin.com` → Tunnel → `http://192.168.68.27:5601`  
(GitLab-style: no Access, no NPM on this VM)

## Playbook

```bash
ansible-playbook playbooks/elastic.yml -e @secrets.yml
```

## Related

- [monitoring.md](monitoring.md) — Loki remains primary logs
