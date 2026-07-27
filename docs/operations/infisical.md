# Infisical (application env-secrets)

Application secrets plane on **`docker-01`** (`192.168.68.22`, **VMID 119**).
**Vault** remains Layer-1 for infra/crypto/seal. Infisical owns
**project → environment → secret** for monorepo and app deploys.

Postgres is **central** on [database-01](database-01.md) via PgCat (`:6432`) —
not embedded in the Infisical Compose stack.

| Item      | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Guest     | `docker-01` (VMID 119)                                             |
| UI / API  | `http://192.168.68.22:8090` (LAN; NPM `:80` is edge — proxy later) |
| Stack     | Compose under `/opt/infisical` + local Redis                       |
| DB        | PgCat → `infisical` database on `192.168.68.21:6432`               |
| Host port | **8090** → container `8080` (do not use `:80` — NPM)               |

Comparison and ownership:
[vault-vs-infisical.md](../architecture/vault-vs-infisical.md) ·
[secret-ownership-map.md](../architecture/secret-ownership-map.md).

**Dev Homelab note:** on the home machine Infisical runs on **`infra-01:8090`**
(not `docker-01`). Seed + operator sync:
[dev-homelab secrets](https://nasraldin.github.io/dev-homelab/architecture/secrets-and-infisical).

## Ansible

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/database.yml -e @secrets.yml   # pools first
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml
# or targeted:
ansible-playbook playbooks/infisical.yml -e @secrets.yml
```

Secrets: `vault_infisical_*` in `secrets.yml` (see `secrets.example.yml`).
Back up `ENCRYPTION_KEY` offline — loss means data loss.
