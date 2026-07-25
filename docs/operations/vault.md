# HashiCorp Vault

Lab secrets plane on **`vault-01`** (`192.168.68.18`, **VMID 113**), with a
small **Transit seal helper** on **`vault-seal`** (`192.168.68.19`, **VMID 114**).

| Item          | Value                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Secrets plane | `vault-01` (VMID 113) · `http://192.168.68.18:8200`                                      |
| Seal helper   | `vault-seal` (VMID 114) · `http://192.168.68.19:8200`                                    |
| Package       | Official HashiCorp apt (`vault` pinned in Ansible)                                       |
| Storage       | Raft under `/var/lib/vault/data` (both guests)                                           |
| Seal          | **Transit auto-unseal** on `vault-01` via `vault-seal`; seal helper stays **Shamir 5/3** |
| Swap          | Disabled on both VMs (Raft guidance)                                                     |
| UI            | Enabled on `vault-01`; disabled on `vault-seal`                                          |

Ansible: `ansible-lab/roles/vault/` via `playbooks/object-storage.yml`
(seal host first, then primary, then AIStor).

## Why this shape (prod-style in a homelab)

| Goal                                               | How                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| Secrets survive `vault-01` reboot without 3 humans | Transit auto-unseal                                                  |
| No cloud KMS dependency                            | Second small Vault = Transit seal backend                            |
| Avoid chicken-and-egg                              | Seal helper stays Shamir (one manual unseal after power loss)        |
| Seal ≠ HA                                          | `vault-seal` does **not** hold app secrets; Raft HA is a later story |

## Product choice: Vault vs OpenBao vs Infisical

**Full comparison:** [vault-vs-infisical.md](../architecture/vault-vs-infisical.md)
(mental models, feature table, use cases, lab secret mapping).

| Option                  | Role here                                 | Decision                                                                                        |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **HashiCorp Vault OSS** | Secrets plane + seal helper               | **Keep** — already deployed, Raft/AppRole/Transit match enterprise patterns                     |
| **OpenBao**             | Vault FOSS fork (MPL) after HashiCorp BSL | **Not switching now** — same class as Vault; see comparison doc                                 |
| **Infisical**           | App/dev env-secrets platform              | **On `docker-01`** — monorepo envs via PgCat; not seal/infra; [infisical.md](infisical.md) |

### OpenBao — when it would win

OpenBao is a community fork aimed at staying fully open-source. API overlap with
Vault is high for core KV/Transit/auth, so it _could_ replace Vault or act as
the seal helper.

**Why we still use Vault OSS for both roles:**

1. **Same product for seal + primary** — fewer edge cases than Vault→OpenBao
   Transit mixing while learning seal migration.
2. **Already bootstrapped** — recreating the secrets plane for a license story
   is churn; Vault OSS apt packages and docs match what many employers use.
3. **Revisit later** if you want a pure-open-source mandate or HashiCorp
   packaging/policy becomes a blocker — migrate as a deliberate project, not
   mid-seal rollout.

Using OpenBao **only** as seal while keeping Vault for secrets is possible
(Transit-compatible), but it teaches a mixed stack you will not see in most
shops. Prefer one family.

### Infisical — why not for Layer-1

Infisical’s **project → environment → secret** model matches modern app
delivery (`dev` / `staging` / `prod`). That is a strength for _application_
config — and a reason it is **not** a drop-in for Vault’s seal model, Raft,
Transit, or infra auth (AppRole → GitLab JWT → Kubernetes + ESO).

Keep Infisical out of the core secrets plane. Optional later if app env inject
is worth a second plane — see the comparison doc.

## What Ansible enforces

| Host         | Behaviour                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `vault-seal` | Install, Raft, Shamir init, Transit engine + `vault-01-unseal` key, orphan token → `/root/vault-autounseal-token` |
| `vault-01`   | Install, Raft, `seal "transit"` → seal helper, KV `apps/` `infra/` `ci/`, AppRole, audit, seed                    |

Day-2 `secrets.yml` should shrink toward: Vault addr, AppRole `role_id`, how to
obtain `secret_id` — not the whole secret zoo.

## KV path layout (stable) — `vault-01` only

```text
apps/data/gitlab/root_password
apps/data/gitlab/s3              # object_store + runner cache keys
apps/data/aistor/root
apps/data/aistor/apps/gitlab
infra/data/proxmox/…             # later
infra/data/cloudflare/…          # later
ci/…                             # GitLab JWT later
```

## Apply / unseal

```bash
cd ~/homelab/ansible-lab
# Full path: seal → primary → AIStor
ansible-playbook playbooks/object-storage.yml -e @secrets.yml
```

### First-time / after seal recreate

1. Apply `vault-seal` (or full playbook). Copy `/root/vault-init.json` **offline**.
2. Apply `vault-01`. First time with Transit on an **existing Shamir** `vault-01`,
   Ansible uses the old Shamir keys once for **seal migration**, then auto-unseal
   works on later boots.
3. Copy `/root/vault-init.json` on `vault-01` offline (recovery keys after Transit).

### After host reboot / power loss

1. **Unseal `vault-seal`** (still Shamir) — required.
2. `vault-01` should **auto-unseal** once the seal helper is up (boot order:
   seal order 4 + 20 s delay, then `vault-01` order 5).

```bash
ansible-playbook playbooks/object-storage.yml -e @secrets.yml --limit vault-seal \
  -e 'vault_unseal_keys=["k1","k2","k3"]'
# vault-01 alone if needed:
ansible-playbook playbooks/object-storage.yml -e @secrets.yml --limit vault-01
```

AppRole material: `/root/vault-approle-ansible.json` on `vault-01` after bootstrap.

## Raft snapshots → AIStor

```bash
ssh nasr@192.168.68.18 'sudo VAULT_ADDR=http://127.0.0.1:8200 vault operator raft snapshot save /tmp/vault.snap'
# upload to aistor bucket vault-raft-snapshots via mc
```

Snapshot **`vault-seal`** too (small) — without it, Transit key material for
auto-unseal is gone.

## Later

- 3/5-node Raft on the secrets plane (HA ≠ seal helper)
- GitLab JWT auth for CI
- Kubernetes auth + External Secrets Operator after kubeadm
- Optional: evaluate OpenBao as a full replacement (not seal-only)

See also: [guest-vmid-map.md](guest-vmid-map.md) · [object-storage.md](object-storage.md) ·
[service-placement.md](../architecture/service-placement.md) ·
[vault-vs-infisical.md](../architecture/vault-vs-infisical.md) ·
[secret-ownership-map.md](../architecture/secret-ownership-map.md)
