# Secret ownership map: Vault vs Infisical

Concrete mapping of **secret types in this homelab** to:

| Label              | Meaning                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Vault only**     | Store / mint / auth here. Do not put the source of truth in Infisical.                                             |
| **Infisical only** | Best as project → env → key. Vault paths would only mimic envs.                                                    |
| **Either**         | Both can hold a _copy_; pick one source of truth (prefer rules below).                                             |
| **Offline**        | Password manager / printed / split custody — not in Vault UI as day-to-day login material, and never in Infisical. |
| **Derived**        | Not stored long-term; minted at use (leases, JWT, runner mint).                                                    |

This is a **decision guide**, not a deploy plan. Layer-1 crypto stays **Vault**
where deployed; **Infisical** on **`infisical-01`** (`.25`) owns app env secrets
for lab-home-k8s ([infisical.md](../operations/infisical.md)).
Product comparison: [vault-vs-infisical.md](vault-vs-infisical.md).
Operate Vault: [vault.md](../operations/vault.md).

## What this page covers

- Rules of thumb for classifying any new secret
- Full inventory by domain (platform → CI → apps)
- Suggested Vault KV paths vs Infisical project/env shape
- What stays in `secrets.yml` vs what moves into Vault
- When “either” becomes a dual-plane anti-pattern

## Rules of thumb

Classify a secret by answering in order:

1. **Does losing it break the secrets plane itself?** (seal keys, Transit token) → **Offline** / **Vault only** (never Infisical).
2. **Is it a platform root** (GitLab root, Proxmox API token, AIStor root, Cloudflare account API)? → **Vault only** (`infra/` or `apps/` platform paths).
3. **Is it minted per machine/job with TTL?** (runner token mint, DB dynamic role, Vault token) → **Derived** / Vault auth engines — not Infisical static env vars as SoT.
4. **Is it the same logical key across `dev` / `staging` / `prod` for an app you ship?** → **Infisical only** (or Either with Infisical as SoT).
5. **Is it a CI variable that is really “deploy config for one app env”?** → Prefer **Infisical** (or GitLab env-scoped vars) over stuffing Vault KV.
6. **Is it a CI variable that is really “talk to the platform”?** (Vault role, registry robot, cluster deploy token) → **Vault only** (often via JWT/AppRole, not a static shared password).

**Default for this lab until Infisical exists:** everything that is not Offline
goes to **Vault** (or stays briefly in gitignored `secrets.yml` for bootstrap).

## Legend for tables

| Column              | Notes                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Placement**       | Vault only / Infisical only / Either / Offline / Derived                                  |
| **Vault path**      | Stable layout under mounts `apps`, `infra`, `ci` (see [vault.md](../operations/vault.md)) |
| **Infisical shape** | `project` / `env` / `KEY` if that plane existed                                           |
| **Today**           | Where it lives **now** in this lab                                                        |

---

## 1. Trust roots and seal

| Secret                                   | Placement                | Vault path / mechanism          | Infisical shape | Today                                      | Why                                            |
| ---------------------------------------- | ------------------------ | ------------------------------- | --------------- | ------------------------------------------ | ---------------------------------------------- |
| `vault-seal` Shamir unseal keys (5/3)    | **Offline**              | Init JSON on host; copy offline | —               | `/root/vault-init.json` + password manager | Chicken-egg; unseals the seal helper           |
| `vault-01` recovery keys (after Transit) | **Offline**              | Init / rekey output             | —               | Init JSON after migration                  | Break-glass; not day-2 login                   |
| Transit autounseal token                 | **Vault only**           | Lives on seal → file on primary | —               | `/root/vault-autounseal-token` on seal     | Crypto trust; Infisical cannot be seal backend |
| Vault root token                         | **Offline** (shrink use) | Bootstrap only                  | —               | Init JSON                                  | Prefer AppRole; root is break-glass            |
| Ansible AppRole `role_id` / `secret_id`  | **Vault only**           | Auth AppRole                    | —               | `/root/vault-approle-ansible.json`         | Machine identity for automation                |

---

## 2. Hypervisor and Terraform

| Secret                                   | Placement                     | Vault path                     | Infisical shape | Today                         | Why                                       |
| ---------------------------------------- | ----------------------------- | ------------------------------ | --------------- | ----------------------------- | ----------------------------------------- |
| Proxmox API token (`terraform@pve!…`)    | **Vault only**                | `infra/data/proxmox/terraform` | —               | Often local/gitignored tf env | Platform automation; not app env          |
| Proxmox root / realm passwords           | **Offline** or **Vault only** | `infra/data/proxmox/root`      | —               | Operator practice             | Human break-glass; avoid Infisical        |
| SSH private keys (Mac → guests, infra01) | **Offline**                   | Optional reference only        | —               | `~/.ssh`                      | Keys are files + agent; not env-secret UX |
| `cloud-init` / guest bootstrap passwords | **Vault only** (if stored)    | `infra/data/guests/…`          | —               | Ansible / image defaults      | Platform provisioning                     |

---

## 3. DNS and edge appliances

| Secret                                  | Placement      | Vault path                             | Infisical shape | Today                           | Why                              |
| --------------------------------------- | -------------- | -------------------------------------- | --------------- | ------------------------------- | -------------------------------- |
| AdGuard admin password                  | **Vault only** | `infra/data/dns/adguard`               | —               | `secrets.yml` → Ansible         | Infra appliance                  |
| Technitium admin password / API token   | **Vault only** | `infra/data/dns/technitium`            | —               | `secrets.yml` → Ansible         | Infra appliance                  |
| TP-Link / Deco admin                    | **Offline**    | —                                      | —               | Router UI                       | Home gear; not in secrets planes |
| Cloudflare Tunnel token (connector)     | **Vault only** | `infra/data/cloudflare/tunnel`         | —               | `cloudflare-tunnel` repo / host | Edge identity for `pve01`        |
| Cloudflare API token (DNS/Access edits) | **Vault only** | `infra/data/cloudflare/api`            | Either*         | Tunnel/Access automation        | Account-scoped platform          |
| Cloudflare Access Service Auth (OpsHub) | **Vault only** | `infra/data/cloudflare/access_service` | —               | OpsHub / tunnel docs            | Machine-to-Proxmox API           |

\*Either only if a _developer tool_ needs to call Cloudflare APIs per app env — still prefer Vault as SoT and short-lived tokens.

---

## 4. Object storage (AIStor)

| Secret                                   | Placement               | Vault path                     | Infisical shape            | Today                             | Why                                                                                             |
| ---------------------------------------- | ----------------------- | ------------------------------ | -------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| AIStor root user/password                | **Vault only**          | `apps/data/aistor/root`        | —                          | Seeded from `secrets.yml`         | Platform S3 root                                                                                |
| AIStor license file                      | **Offline** / host file | Reference in docs only         | —                          | `files/aistor/minio.license`      | Not a KV string workflow                                                                        |
| GitLab S3 access/secret keys             | **Vault only**          | `apps/data/gitlab/s3`          | —                          | Seeded; used by Omnibus + runners | Platform integration                                                                            |
| App-scoped S3 keys (future bucket users) | **Either**              | `apps/data/aistor/apps/<name>` | `my-app` / `prod` / `S3_*` | Planned paths                     | Prefer Vault if Ansible/GitLab platform owns it; Infisical if only the app team rotates per env |
| Vault Raft snapshot upload creds         | **Vault only**          | Reuse AIStor scoped user       | —                          | Runbook                           | Platform backup path                                                                            |

---

## 5. GitLab platform

| Secret                                       | Placement                                          | Vault path                                          | Infisical shape        | Today                                        | Why                                                                                |
| -------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- | ---------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| GitLab `root` password                       | **Vault only**                                     | `apps/data/gitlab/root_password`                    | —                      | Seeded from `secrets.yml`                    | Platform admin                                                                     |
| GitLab runner registration / `glrt-…` tokens | **Derived** / **Vault only**                       | Optional store after mint: `ci/data/runners/<name>` | —                      | Mint play preferred over stale `secrets.yml` | Machine identity; rotate via mint                                                  |
| GitLab Personal Access Token (human)         | **Offline**                                        | Optional `infra/…` if automation needs it           | —                      | Password manager                             | Human; prefer project tokens                                                       |
| GitLab Project / Group access tokens         | **Vault only** (automation) or **Either** (app CD) | `ci/data/gitlab/tokens/<name>`                      | App project / `ci` env | As needed                                    | Platform SoT in Vault; app deploy tokens can live in Infisical _or_ GitLab CI vars |
| GitLab SMTP / OAuth / object_store secrets   | **Vault only**                                     | `apps/data/gitlab/…`                                | —                      | Omnibus / Ansible                            | Platform config                                                                    |
| Container registry robot / deploy password   | **Vault only** or **Derived**                      | `ci/data/registry/…`                                | Either for app pull    | Later Harbor                                 | Prefer Vault + CI JWT                                                              |

---

## 6. CI/CD variables (GitLab)

Split CI secrets by **job purpose**, not by “it’s in GitLab CI settings.”

| Kind of CI var                                | Placement                                       | Vault                        | Infisical                             | Today                   | Why                          |
| --------------------------------------------- | ----------------------------------------------- | ---------------------------- | ------------------------------------- | ----------------------- | ---------------------------- |
| Terraform Proxmox token for infra pipelines   | **Vault only**                                  | JWT/AppRole → read `infra/…` | —                                     | Often masked CI / local | Infra pipeline identity      |
| `VAULT_ADDR` + AppRole/JWT for jobs           | **Vault only**                                  | Auth method                  | —                                     | Later                   | Platform pattern to practice |
| `DATABASE_URL` for app deploy job (`staging`) | **Infisical only** (ideal) or GitLab env-scoped | Path mimic possible          | `my-api` / `staging` / `DATABASE_URL` | Not yet                 | Classic env secret           |
| `STRIPE_SECRET_KEY` / SaaS keys per env       | **Infisical only**                              | Mimic possible               | Project / env / key                   | Not yet                 | App config                   |
| Shared “deploy to all envs” god token         | Avoid                                           | —                            | —                                     | —                       | Anti-pattern in both tools   |
| Cosign signing key / password                 | **Vault only**                                  | `ci/data/cosign/…`           | —                                     | Planned keyed Cosign    | Supply-chain; platform       |
| Harbor / registry push creds in CI            | **Vault only**                                  | `ci/data/harbor/…`           | Either                                | Later                   | Prefer Vault + short-lived   |

**Rule:** If the variable changes meaning by **environment** and belongs to an
**application**, Infisical (or GitLab environment-scoped CI vars) wins. If the
variable means “this pipeline may touch Proxmox / Vault / cluster,” Vault wins.

---

## 7. Application secrets (future services)

| Secret                                    | Placement                     | Vault path                         | Infisical shape                                 | Today | Why                           |
| ----------------------------------------- | ----------------------------- | ---------------------------------- | ----------------------------------------------- | ----- | ----------------------------- |
| App `DATABASE_URL` / Redis URL per env    | **Infisical only**            | `apps/data/<svc>/<env>/db` (mimic) | `<svc>` / `dev\|staging\|prod` / `DATABASE_URL` | —     | Best Infisical fit            |
| App session / JWT signing secrets per env | **Infisical only**            | Mimic                              | Same                                            | —     | Env-scoped app config         |
| Shared “platform” API key all apps use    | **Vault only**                | `apps/data/platform/…`             | Bad fit                                         | —     | Central policy / rotation     |
| Dynamic DB username/password per job      | **Derived** (Vault DB engine) | Database secrets engine            | Not SoT                                         | Later | Vault depth                   |
| K8s `Secret` for one Deployment (static)  | **Either**                    | ESO ← Vault                        | Infisical operator                              | Later | Pick one SoT; don’t dual-sync |

---

## 8. Kubernetes and GitOps (later)

| Secret                                  | Placement          | Vault                            | Infisical               | Notes                            |
| --------------------------------------- | ------------------ | -------------------------------- | ----------------------- | -------------------------------- |
| Kubernetes auth / SA → Vault            | **Vault only**     | K8s auth                         | —                       | Planned after kubeadm            |
| External Secrets Operator → Vault       | **Vault only**     | KV / engines                     | —                       | Default lab path                 |
| Infisical K8s operator → native Secrets | **Infisical only** | —                                | Operator                | Only if Infisical plane exists   |
| Sealed Secrets / SOPS in Git            | Complementary      | Can encrypt to Vault-backed keys | Can sync from Infisical | Git is ciphertext store, not SoT |
| Argo CD repo credentials                | **Vault only**     | `ci/data/argocd/…`               | —                       | Platform GitOps                  |

---

## 9. Personal / lab convenience (out of scope for both planes)

| Secret                           | Placement                 | Notes                             |
| -------------------------------- | ------------------------- | --------------------------------- |
| Vaultwarden / personal passwords | **Offline** / Vaultwarden | Not Vault platform; not Infisical |
| Mac Keychain / browser passwords | Offline                   | —                                 |
| Home Wi-Fi PSK                   | Offline                   | —                                 |

---

## Bootstrap vs steady state

| Phase                     | Where secrets live                                                        | Goal                             |
| ------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **Day-0 bootstrap**       | gitignored `ansible-lab/secrets.yml` + offline init JSON                  | Bring up Vault / AIStor / GitLab |
| **Day-1 steady**          | Vault KV + AppRole; shrink `secrets.yml` to addr + how to get `secret_id` | Ansible reads Vault              |
| **Day-2 apps** (optional) | Infisical for app envs; Vault remains platform                            | Two planes, clear ownership      |
| **Day-2 CI**              | GitLab JWT → Vault (platform); Infisical CLI/sync (apps)                  | No long-lived god tokens in CI   |

Suggested Vault mounts (already in role defaults):

```text
apps/     # GitLab, AIStor, future app *platform* shared secrets
infra/    # Proxmox, Cloudflare, DNS admins
ci/       # Runner metadata, Cosign, registry robots, Argo
```

Infisical (if introduced) should **not** duplicate `infra/` or seal material.
It should own **application projects** only.

---

## Quick decision matrix

| Secret example             | Vault only | Infisical only | Either | Offline | Derived |
| -------------------------- | :--------: | :------------: | :----: | :-----: | :-----: |
| Shamir / recovery keys     |            |                |        |    ✓    |         |
| Transit autounseal token   |     ✓      |                |        |         |         |
| GitLab root password       |     ✓      |                |        |         |         |
| AIStor root                |     ✓      |                |        |         |         |
| GitLab S3 keys             |     ✓      |                |        |         |         |
| AdGuard / Technitium admin |     ✓      |                |        |         |         |
| Cloudflare tunnel / API    |     ✓      |                |        |         |         |
| Proxmox Terraform token    |     ✓      |                |        |         |         |
| Runner `glrt` token        |     ✓*     |                |        |         |    ✓    |
| App `DATABASE_URL` per env |            |       ✓        |   ✓†   |         |         |
| Stripe/etc. per env        |            |       ✓        |   ✓†   |         |         |
| CI job → Vault via JWT     |     ✓      |                |        |         |    ✓    |
| Dynamic Postgres role      |     ✓      |                |        |         |    ✓    |
| Human PAT                  |            |                |        |    ✓    |         |

\*May be stored in Vault after mint for recovery; mint remains source of issue.  
†Either = pick **one** SoT (prefer Infisical for app envs); do not dual-write.

---

## Anti-patterns for this lab

| Anti-pattern                                                       | Do instead                                      |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| Put seal keys or root Vault token in Infisical                     | Offline password manager                        |
| Put GitLab root only in Infisical “because UI is nicer”            | Vault `apps/gitlab/…`                           |
| Mirror every Vault path into Infisical “for convenience”           | Split by layer; sync only app secrets if needed |
| Store Proxmox token in Infisical `prod` for a web app project      | Vault `infra/proxmox` + CI JWT                  |
| Use Infisical as Transit / unseal                                  | Impossible / wrong tool — keep `vault-seal`     |
| Long-lived `DATABASE_URL` in Vault _and_ Infisical _and_ GitLab CI | One SoT + inject                                |

---

## Locked takeaway

| Plane                      | Owns                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Offline**                | Seal/recovery, human PATs, router                                                                                       |
| **Vault (now)**            | All platform + crypto + current seeded secrets                                                                          |
| **Infisical (scaffolded)** | App `dev/staging/prod` — VM/Ansible/TF ready; apply when monorepo needs it ([infisical.md](../operations/infisical.md)) |
| **Derived**                | Runner mint, JWT, dynamic engines                                                                                       |

Until Infisical is applied, treat every new secret as **Vault only** or
**Offline** unless it is clearly an application env var — then either GitLab
environment-scoped CI variables (interim) or Infisical after `infisical.yml`.

## Related

- [vault-vs-infisical.md](vault-vs-infisical.md) — product comparison
- [infisical.md](../operations/infisical.md) — operate Infisical
- [vault.md](../operations/vault.md) — operate Vault
- [gitlab.md](../operations/gitlab.md) — Omnibus / runners
- [object-storage.md](../operations/object-storage.md) — AIStor
- [service-placement.md](service-placement.md) — Infisical skip
- [decisions/log.md](../decisions/log.md)
