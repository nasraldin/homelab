# SonarQube (`sonarqube-01`)

LAN: `192.168.68.26` · VMID **122** · **4c / 16G / 80G**

## Design

- **Docker Compose** sole-tenant under `/opt/sonarqube/`
- **JDBC** → central PgCat: `jdbc:postgresql://192.168.68.21:6432/sonarqube` (session pool)
- **No** local Postgres, **no** reverse proxy on the VM
- Host: `vm.max_map_count≥262144`, high `nofile`

## Public URL

`https://sonar.nasraldin.com` → Cloudflare Tunnel → `http://192.168.68.26:9000`  
(GitLab-style: **no** Access, **no** NPM — Sonar sign-in)

Set Sonar server base URL to `https://sonar.nasraldin.com`.

## Playbook

```bash
ansible-playbook playbooks/sonarqube.yml -e @secrets.yml
```

## Related

- [database-01.md](database-01.md) · [gitlab.md](gitlab.md)
