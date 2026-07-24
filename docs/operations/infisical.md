# Infisical (application env-secrets)

Application secrets plane on **`infisical-01`** (`192.168.68.20`, **VMID 115**).
**Vault** remains Layer-1 for infra/crypto/seal. Infisical owns
**project → environment → secret** for monorepo and app deploys.

| Item       | Value                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| Guest      | `infisical-01` (VMID 115)                                                |
| UI / API   | `http://192.168.68.20` (**LAN only** — no Cloudflare Tunnel)             |
| Stack      | Docker Compose: Infisical + Postgres 16 + Redis 7 under `/opt/infisical` |
| Sizing     | 4 vCPU / 8 GiB / 50 GiB (Infisical Compose recommended)                  |
| Boot order | 7 (after AIStor; before GitLab)                                          |

Comparison and ownership:
[vault-vs-infisical.md](../architecture/vault-vs-infisical.md) ·
[secret-ownership-map.md](../architecture/secret-ownership-map.md).

## Split of responsibility

| Plane            | System                   | Examples                                                     |
| ---------------- | ------------------------ | ------------------------------------------------------------ |
| Infra / crypto   | **Vault** + `vault-seal` | Seal, AppRole, GitLab root, AIStor root, Proxmox, Cloudflare |
| Application envs | **Infisical**            | `DATABASE_URL`, SaaS keys per `dev`/`staging`/`prod`         |

Do **not** put seal keys, Vault root, or Proxmox tokens in Infisical.

## Terraform

| Layer               | Path                                                  | Role                                      |
| ------------------- | ----------------------------------------------------- | ----------------------------------------- |
| VM                  | `terraform-lab/terraform.tfvars` → `vms.infisical-01` | Guest lifecycle                           |
| Day-2 projects/envs | `terraform-lab/infisical/`                            | Infisical provider (after Universal Auth) |

## Ansible

Role: `ansible-lab/roles/infisical/`  
Playbook: `ansible-lab/playbooks/infisical.yml`

```bash
# 1) Ensure secrets.yml has Infisical keys (see secrets.example.yml)
openssl rand -hex 16          # ENCRYPTION_KEY
openssl rand -base64 32       # AUTH_SECRET

# 2) VM
cd ~/homelab/terraform-lab && terraform apply   # creates infisical-01

# 3) Configure
cd ~/homelab/ansible-lab
ansible-playbook playbooks/infisical.yml -e @secrets.yml
```

First browser visit: create the **instance admin** (first signup).

Back up **`ENCRYPTION_KEY`** offline (and later into Vault `infra/data/infisical/`).
Losing it makes the Postgres volume unrecoverable even with dumps.

## DNS

Technitium A record: `infisical-01.lab.nasraldin.com` → `.20`  
(re-run `playbooks/dns.yml` after adding the default).

## Remote access

Same policy as Vault/AIStor: **LAN only**. From away, use SSH/mesh onto the
LAN — do not publish a public Tunnel hostname for Infisical.

## Monorepo usage (later)

1. Create Infisical project(s) for apps (`terraform-lab/infisical/` or UI).
2. Define `dev` / `staging` / `prod` environments.
3. CI: `infisical run` / SDK, or sync into GitLab env-scoped vars.
4. Keep GitLab JWT → Vault for **platform** CI (Terraform, Cosign, Proxmox).

## Related

- [vault.md](vault.md) · [object-storage.md](object-storage.md) · [gitlab.md](gitlab.md)
- [guest-vmid-map.md](guest-vmid-map.md)
- [Infisical Docker Compose docs](https://infisical.com/docs/self-hosting/deployment-options/docker-compose)
