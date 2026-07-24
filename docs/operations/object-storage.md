# Object storage (AIStor Free)

Shared lab S3 on **`aistor-01`** (`192.168.68.17`, **VMID 116**). Software is
**MinIO AIStor Free** — not archived MinIO Community Edition. Do not deploy
classic MinIO CE alongside it.

| Item    | Value                                                 |
| ------- | ----------------------------------------------------- |
| Guest   | `aistor-01` (VMID 116)                                |
| S3 API  | `http://192.168.68.17:9000` (**LAN only**)            |
| Console | `http://192.168.68.17:9001` (LAN only)                |
| Spec    | 4 vCPU / 8 GiB / 300 GiB on `data01`                  |
| License | `ansible-lab/files/aistor/minio.license` (gitignored) |

Ansible role: `ansible-lab/roles/aistor/`. Buckets also catalogued in
`terraform-lab/object-storage/` (aminueza/minio provider).

## Consumers

| Consumer       | How                                               |
| -------------- | ------------------------------------------------- |
| GitLab Omnibus | `object_store` + registry layers → AIStor buckets |
| GitLab Runner  | Distributed S3 cache bucket `runner-cache`        |
| Vault          | Raft snapshots → `vault-raft-snapshots`           |
| Lab apps       | `objects`, `tables`, `files`, …                   |

## What Ansible enforces

- AIStor Free install + license + systemd unit
- UFW for LAN `:9000`/`:9001`
- Idempotent bucket ensure via `mc` for `aistor_buckets`
- Scoped GitLab S3 user (keys seeded into Vault `apps/gitlab/s3`)

## Apply

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/object-storage.yml -e @secrets.yml
# full stack (Vault → AIStor → GitLab → runners):
ansible-playbook playbooks/gitlab.yml -e @secrets.yml
```

## Add a bucket (declarative)

1. Append to `aistor_buckets` in `ansible-lab/roles/aistor/defaults/main.yml`
   **and** `terraform-lab/object-storage/main.tf`.
2. Re-run Ansible `aistor`, and/or:

```bash
cd ~/homelab/terraform-lab/object-storage
terraform init
TF_VAR_aistor_access_key=... TF_VAR_aistor_secret_key=... terraform apply
```

Convention: `<app>-<purpose>` (e.g. `harbor-registry`, `opshub-backups`).

## Credentials

Root and GitLab-scoped keys live in Ansible `secrets.yml` on first bootstrap and
are seeded into Vault at `apps/aistor/root` and `apps/gitlab/s3`.

See also: [guest-vmid-map.md](guest-vmid-map.md) · [vault.md](vault.md) · [gitlab.md](gitlab.md)
