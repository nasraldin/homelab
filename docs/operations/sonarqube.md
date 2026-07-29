# SonarQube

> **IP collision note:** In **terraform-lab**, `sonarqube-01` is `.26`. In
> **lab-home-k8s**, `.26` is **`llm-01`** (Ollama) and Sonar is interim in k8s
> namespace **`apps`** (LB `.112`). Use [lab-home-inventory.md](lab-home-inventory.md)
> for the live home map.

## terraform-lab guest (`sonarqube-01`)

LAN: `192.168.68.26` · VMID **122** · **2c / 8G / 80G** (right-sized 2026-07-26)

## Design

- **Docker Compose** sole-tenant under `/opt/sonarqube/`
- Image pin: `sonarqube:26.7.0.124771-community` (`roles/sonarqube/defaults/main.yml`) — not `:community`
- **JDBC** → central PgCat: `jdbc:postgresql://192.168.68.21:6432/sonarqube` (session pool)
- **No** local Postgres, **no** reverse proxy on the VM
- Host: `vm.max_map_count≥262144`, high `nofile`

## Public URL

`https://sonar.nasraldin.com` → Cloudflare Tunnel → `http://192.168.68.26:9000`  
(GitLab-style: **no** Access, **no** NPM — Sonar sign-in)

Set Sonar server base URL to `https://sonar.nasraldin.com`.

## Prometheus metrics

`SONAR_WEB_SYSTEMPASSCODE` from `vault_sonarqube_system_passcode` (secrets.yml).
Prometheus scrapes `http://192.168.68.26:9000/api/monitoring/metrics` with
`Authorization: Bearer <passcode>`. Grafana → **Quality** folder
([monitoring.md](monitoring.md)).

## Playbook

```bash
ansible-playbook playbooks/sonarqube.yml -e @secrets.yml
```

Fresh empty DB: pin alone is enough. **Existing DB upgrades** cannot skip required
intermediates (see [REF-027](lab-refresh-issues.md#ref-027-sonarqube-skip-upgrade-path)):
stage image → `POST /api/system/migrate_db` until `UP` → next pin.

## Related

- [database-01.md](database-01.md) · [gitlab.md](gitlab.md)
- [lab-refresh-issues.md](lab-refresh-issues.md) REF-027
