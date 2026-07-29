# Object storage (AIStor Free)

Shared lab S3. Software is **MinIO AIStor Free** — not archived MinIO Community
Edition. Do not deploy classic MinIO CE alongside it.

## Placement

| Lab | Guest | S3 API | Console |
| --- | ----- | ------ | ------- |
| **lab-home-k8s** (Dev Homelab) | **`docker-01`** `.21` | `http://192.168.68.21:9000` | `:9001` / `minio.lab` |
| **terraform-lab** (alternate) | `aistor-01` `.17` VMID 115 | `http://192.168.68.17:9000` | `:9001` |

License (gitignored): `lab-home-k8s/ansible/files/aistor/minio.license` or
`ansible-lab/files/aistor/minio.license`.

## Consumers (lab-home-k8s)

| Consumer | How |
| -------- | --- |
| GitLab Omnibus | `object_store` → AIStor on docker-01 |
| GitLab Runner | S3 cache bucket (when configured) |
| Lab apps | buckets via `mc` / Ansible |

## Apply (lab-home-k8s)

```bash
cd ~/homelab/lab-home-k8s/ansible
ansible-playbook playbooks/docker-hosts.yml -e @secrets.yml --limit docker-01
```

## terraform-lab notes

Older runbooks may still say VMID 115 / `.17`. Role: `ansible-lab/roles/aistor/`.
Buckets also in `terraform-lab/object-storage/`.

```bash
cd ~/homelab/ansible-lab
ansible-playbook playbooks/object-storage.yml -e @secrets.yml
```

## Related

- [docker-hosts.md](docker-hosts.md) · [lab-restructure-2026-07-30.md](lab-restructure-2026-07-30.md)
- [gitlab.md](gitlab.md) · [lab-home-inventory.md](lab-home-inventory.md)
