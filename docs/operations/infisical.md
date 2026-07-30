# Infisical (application env-secrets)

Application secrets plane on **`infisical-01`** LXC (`192.168.68.25`, **CTID 125**).
**Vault** remains Layer-1 for infra/crypto/seal. Infisical owns
**project → environment → secret** for monorepo and app deploys.

Self-host shape follows
[official Docker Compose](https://infisical.com/docs/self-hosting/deployment-options/docker-compose)
(backend + Postgres + Redis on one host). Lab tweaks: pinned image tag,
Postgres 16 with tuned `shared_buffers`, Redis with requirepass + AOF.
PgCat is **not** used here (single Infisical consumer; official compose is direct).

| Item      | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Guest     | `infisical-01` (CTID 125)                                          |
| UI / API  | `http://192.168.68.25:8090` · `http://infisical.lab` via NPM       |
| Stack     | Compose under `/opt/infisical`                                     |
| DB/Redis  | Local compose services (`db`, `redis`)                             |
| Host port | **8090** → container `8080`                                        |

Operator seed / universal-auth: `playbooks/infisical-seed.yml` —
`vault_infisical_url` must be `http://192.168.68.25:8090` after move.
Update K8s `InfisicalSecret` host/endpoints accordingly.

Comparison and ownership:
[vault-vs-infisical.md](../architecture/vault-vs-infisical.md) ·
[secret-ownership-map.md](../architecture/secret-ownership-map.md) ·
[lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md).

## Ansible

```bash
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook playbooks/infisical.yml -e @secrets.yml
ansible-playbook playbooks/infisical-seed.yml -e @secrets.yml
```

Secrets: `vault_infisical_*` in `secrets.yml` (see `secrets.example.yml`).
Back up `ENCRYPTION_KEY` offline — loss means data loss.
