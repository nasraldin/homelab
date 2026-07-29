# Vault vs Infisical: Secrets Platforms Compared

Deep comparison of **HashiCorp Vault OSS** and **Infisical** for this homelab.
Decision for Layer-1: **Vault stays the secrets / crypto plane**; Infisical is
**not** a replacement for Transit seal, Raft, or infra auth — optional later as
an **application env-secrets** UX if needed.

Operational Vault runbook: [vault.md](../operations/vault.md). Placement:
[service-placement.md](service-placement.md).

## What this page covers

- Mental models (identity/path vs project/environment)
- Feature-by-feature comparison (OSS/self-host focus)
- Best use cases and anti-patterns
- How secrets in _this_ lab map to each tool — **detail:**
  [secret-ownership-map.md](secret-ownership-map.md)
- OpenBao (brief) vs both
- Locked lab decision and when to revisit

## Mental models

|                           | **HashiCorp Vault**                                                              | **Infisical**                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Unit of organization      | **Identity + path** (`apps/data/gitlab/…`)                                       | **Project → Environment → Secret** (`my-api` / `prod` / `DATABASE_URL`)            |
| Primary user              | Platform / security / ops                                                        | Developers + platform                                                              |
| Question it answers well  | “Who/what can decrypt or mint this credential, under what policy, for how long?” | “What does this app need in `dev` vs `staging` vs `prod`, and how do I inject it?” |
| Environment / stage model | You **build** it with paths, namespaces, policies                                | **First-class** (`dev` / `staging` / `prod`, side-by-side, diffs)                  |
| Design centre             | Building blocks: engines, auth methods, leases                                   | Product workflow: sync, inject, govern envs                                        |

**Env-first is modern practice for application config** (12-factor, deploy stages).
**Identity/engine-first is stronger for machine trust and crypto services** (PKI,
Transit, dynamic DB users, AppRole/JWT/K8s auth).

Neither is universally “better.” Best practice depends on **which kind of
secret** you are managing.

### Same idea, different shape

| Concern                               | Vault-shaped                               | Infisical-shaped                                       |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| Stripe API key per deploy stage       | `secret/data/billing/prod/stripe` + policy | Project `billing`, env `prod`, key `STRIPE_SECRET_KEY` |
| Ephemeral Postgres role for a CI job  | Database secrets engine + lease            | Limited / different depth                              |
| Encrypt app data without exposing key | Transit engine                             | Not a peer                                             |
| Unseal / auto-unseal trust root       | Shamir, Transit, cloud KMS                 | N/A (app + DB model)                                   |

Vault _can_ fake environments with path conventions. That works, but you invent
the product Infisical already is. Infisical **cannot** replace Transit seal or
Vault’s engine depth.

## Feature comparison

OSS / self-host focus. Enterprise-only Vault capabilities are called out.

| Capability                                                | **Vault OSS**                                      | **Infisical**                                             | Prefer for…                                                      |
| --------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Static secrets (KV)                                       | Excellent (KV v2, versioning)                      | Excellent (core product)                                  | Tie                                                              |
| Environment / stage model                                 | Manual paths + policy                              | Native envs, compare/diff, per-env ACL                    | **Infisical**                                                    |
| Local / CI inject (`run`, process env)                    | Agent, templates, custom glue                      | Native CLI / SDKs / `infisical run`                       | **Infisical**                                                    |
| Secret sync → cloud/SaaS (GitHub, AWS SM, …)              | Limited on OSS; stronger on Enterprise/HCP         | Strong sync catalog on open-core                          | **Infisical** (esp. OSS)                                         |
| Human UI                                                  | Usable; CLI/API-first                              | Polished product UI                                       | **Infisical**                                                    |
| RBAC UX                                                   | HCL policies (powerful, steep)                     | Roles on project / env / folder                           | **Infisical** day-1; Vault for path math                         |
| Approval / access-request / JIT UX                        | Leases; Control Groups (Ent) / DIY                 | Built-in workflows, notifications                         | **Infisical**                                                    |
| Audit logging                                             | Very strong                                        | Strong                                                    | Tie / slight **Vault** depth                                     |
| Dynamic DB / cloud credentials                            | Deep: many engines, lease revoke                   | Growing rotation/dynamic; narrower                        | **Vault**                                                        |
| Transit / encryption-as-a-service                         | Yes (lab uses this for auto-unseal)                | Not a peer                                                | **Vault only**                                                   |
| PKI / SSH certificate signing                             | Mature engines                                     | Some machine-identity style features; not Vault PKI depth | **Vault**                                                        |
| Auth methods (AppRole, K8s, JWT/OIDC, LDAP, cloud IAM, …) | Broadest ecosystem                                 | OIDC/SAML/LDAP + machine identity style                   | **Vault** for infra auth                                         |
| Kubernetes                                                | Agent inject, CSI, K8s auth                        | Operator → native K8s Secrets                             | Infisical for “sync Secret”; Vault for identity inject / dynamic |
| Seal / trust root / Raft                                  | First-class (Shamir, Transit, cloud KMS)           | App + DB (no Vault-style seal ceremony)                   | **Vault** for crypto/ops practice                                |
| HA / DR maturity                                          | Battle-tested patterns (Ent for advanced multi-DC) | Self-host around app/DB HA                                | **Vault** for hard infra                                         |
| License (self-host recent)                                | BSL 1.1 (not OSI open source)                      | MIT core (open-core; some features paid)                  | Preference / policy                                              |
| Learning curve / ops cost                                 | High                                               | Lower for app secrets                                     | Infisical for app teams; Vault for platform craft                |
| Interview / employer familiarity                          | Very common                                        | Growing, less universal                                   | **Vault** for this lab’s learning goal                           |
| Replace Vault for seal / Transit                          | —                                                  | No                                                        | Keep Vault                                                       |

### Product marketing vs lab reality

Third-party and vendor pages emphasize Infisical’s DX and Vault’s depth — that
framing matches this lab. Treat vendor comparison pages as biased; use them for
_feature inventories_, not for “replace Vault.”

Useful references (external):

- [Infisical: Infisical vs HashiCorp Vault](https://infisical.com/compare/infisical-vs-hashicorp-vault)
- [selfhosting.sh: Vault vs Infisical](https://selfhosting.sh/compare/vault-vs-infisical/)
- [We The Flywheel: Infisical vs Vault (2026)](https://wetheflywheel.com/en/comparisons/infisical-vs-hashicorp-vault/)

## Best use cases

### Choose Vault when you need

1. **Infrastructure identity and crypto** — AppRole / JWT / K8s auth, Transit, PKI, SSH signer
2. **Dynamic short-lived credentials** — DB roles that expire, cloud IAM leases
3. **Platform / multi-tenant policy depth** — path ACLs, many auth backends
4. **Security ops practice** — seal, audit, Raft, agent / ESO patterns
5. **A system of record for machine trust**, not only for `DATABASE_URL`

**This lab’s Layer-1** (`vault-01` + `vault-seal`, later GitLab JWT / K8s auth)
is Vault’s sweet spot.

### Choose Infisical when you need

1. **App / env secret lifecycle** — same keys across `dev` / `staging` / `prod`, diffs
2. **Developer self-service** — UI + CLI inject without teaching everyone Vault HCL
3. **Push secrets to many destinations** — GitHub Actions, cloud secret stores, etc.
4. **Fast hygiene** — stop `.env` sprawl on laptops and in git
5. **Product teams** where “secret = env var for this deploy” is ~90% of the problem

### Anti-patterns

| Don’t                                                                           | Why                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Replace Vault with Infisical for Transit auto-unseal                            | Infisical is not a seal / Transit backend                                   |
| Put every infra root (GitLab root, Proxmox API, seal keys) only in Infisical    | Wrong trust and auth model for platform secrets                             |
| Force every app `dev/staging/prod` key into Vault paths “because we have Vault” | Works, but poor DX; Infisical (or disciplined Vault path layout) is clearer |
| Run both without a clear split                                                  | Duplicate sources of truth; pick a layer each owns                          |

## Using both (common in real orgs)

| Layer                                                                 | Tool                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| Seal, PKI, Transit, infra tokens, GitLab/Proxmox-class secrets        | **Vault**                                                 |
| Application `dev` / `staging` / `prod` configs for services you build | **Infisical** (optional) _or_ Vault paths that mimic envs |

```text
                    ┌─────────────────────────┐
   Humans / CI      │  Infisical (optional)   │  project + env + inject
   app config       └───────────┬─────────────┘
                                │  (optional sync / pull)
                    ┌───────────▼─────────────┐
   Platform         │  Vault (Layer-1)        │  KV + AppRole/JWT/K8s
   + crypto         │  + vault-seal (Transit) │  Transit / later PKI
                    └─────────────────────────┘
```

## How _this_ lab’s secrets map

**Full inventory** (GitLab root, AIStor, Cloudflare, CI vars, app DB URLs, …)
with **Vault only / Infisical only / Either / Offline / Derived**:
[secret-ownership-map.md](secret-ownership-map.md).

Summary:

| Class                    | Placement                               | Examples                                                             |
| ------------------------ | --------------------------------------- | -------------------------------------------------------------------- |
| Trust / seal             | **Offline** or **Vault only**           | Shamir/recovery, Transit token, root token                           |
| Platform roots           | **Vault only**                          | GitLab root, AIStor root, Proxmox API, Cloudflare tunnel, DNS admins |
| App env config           | **Infisical only** (later)              | `DATABASE_URL`, Stripe keys per `dev/staging/prod`                   |
| CI “talk to platform”    | **Vault only** / **Derived**            | JWT→Vault, Cosign, registry robots                                   |
| CI “deploy this app env” | **Infisical** or GitLab env-scoped vars | App deploy secrets                                                   |
| Minted machine identity  | **Derived**                             | Runner `glrt`, dynamic DB roles                                      |

In this homelab: **Vault** for infra/crypto (live); **Infisical** for app envs
(TF VM + Ansible role scaffolded — apply when monorepo needs it). See
[infisical.md](../operations/infisical.md) · [secret-ownership-map.md](secret-ownership-map.md).

## OpenBao (brief)

[OpenBao](https://openbao.org/) is a community FOSS fork of Vault (MPL-oriented
story after HashiCorp’s BSL change). Same _class_ of tool as Vault (engines,
Transit, Raft-style thinking), **not** the same class as Infisical.

| Option    | Role in this lab                    | Decision                                                                           |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| Vault OSS | Secrets plane + Transit seal helper | **Keep**                                                                           |
| OpenBao   | Vault-compatible FOSS alternative   | **Not switching now** — revisit only for a pure-open mandate                       |
| Infisical | App/env secrets UX                  | **On `infisical-01` LXC** (`.25`) — local Compose PG/Redis; not a Vault replacement |

Using OpenBao **only** as seal while Vault holds secrets is API-possible but
teaches a mixed stack. Prefer one family for seal + primary. Detail:
[vault.md](../operations/vault.md) § Product choice.

## Locked decision (this lab)

| Decision                     | Detail                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Layer-1 secrets / crypto     | **HashiCorp Vault OSS** on `vault-01` + Transit helper `vault-seal`                              |
| Infisical                    | **Scaffolded** for app `dev/staging/prod`; LAN VM; not for seal or infra identity                |
| OpenBao                      | **Skip** for now; same product family discussion, not Infisical                                  |
| Revisit Infisical apply when | Monorepo / app services need first-class env inject ([infisical.md](../operations/infisical.md)) |
| Revisit OpenBao when         | Explicit open-source packaging mandate outweighs churn                                           |

Decision log: [decisions/log.md](../decisions/log.md).

## Related

- [secret-ownership-map.md](secret-ownership-map.md) — Vault / Infisical / Offline per secret type
- [vault.md](../operations/vault.md) — operate Vault / seal
- [service-placement.md](service-placement.md) — VM vs k8s vs skip
- [object-storage.md](../operations/object-storage.md) — AIStor
- [guest-vmid-map.md](../operations/guest-vmid-map.md) — VMIDs / boot order
