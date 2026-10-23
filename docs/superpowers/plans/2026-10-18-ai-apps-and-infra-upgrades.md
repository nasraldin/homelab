# AI Applications and Homelab Upgrade Plan

> **For agentic workers:** Execute each bounded task through the existing GitLab MR and gated deployment workflows. Keep a durable task ledger; verify before making completion claims.

**Goal:** Deploy Hermes Agent, Paperclip, Dify, and Autensa in the existing Talos cluster, then upgrade compatible homelab components to current stable releases with tested, reviewable MRs.

**Architecture:** Preserve existing n8n, OpenClaw, PostgreSQL workloads, and Redis contracts. Add application dependencies only where upstream compatibility requires them, wire credentials through the Vault repository, publish supported browser UIs through the existing Cloudflare Tunnel/Access conventions, and keep all service-to-service calls on Kubernetes DNS. Run application deployment before infrastructure version changes; separate core networking, Talos, and Kubernetes upgrades into independently validated MRs.

**Tech Stack:** Kubernetes 1.37 / Talos 1.14.1; Helm and existing platform manifests; CloudNativePG; Redis; Infisical/Vault reconciliation; GitLab CI; Cloudflare Tunnel and Access.

**Spec:** User-provided `/Users/nasr/.codex/attachments/47c9f9e4-2d01-4957-ba00-3e74179ab6ab/Pasted text.txt`, plus the current user authorization to complete the MRs, merges, upgrades, and pipeline verification.

## Global Constraints

- Preserve existing n8n and OpenClaw state and endpoints; do not restart unrelated workloads.
- Do not modify existing PostgreSQL clusters or their data; provision separate application databases only through the established operator/workflow.
- Pin exact stable application, chart, and image versions; do not use floating tags.
- Use Cloudflare Tunnel and Access for supported browser UIs; expose no Redis or database endpoints.
- Keep Hermes execution isolated without mounting host paths, container sockets, or broad Kubernetes credentials.
- Keep Paperclip and Autensa task ownership distinct; leave autonomous schedules and external side effects disabled.
- Use separate credentials per application through Vault; never commit or print plaintext secrets.
- Select storage and placement from inspected live classes and labels; retain single-host and single-replica recovery limitations in docs.
- Upgrade only to versions compatible with Kubernetes 1.37; stage Kubernetes/Talos and any incompatible core upgrades separately.
- Do not add unrelated monitoring infrastructure.

## Review Focus

- Startup ordering or missing optional provider credentials must leave the UIs and non-model functions usable; validate missing-key behavior per app.
- Redis sharing must preserve noeviction for queue workloads and must not treat logical DB numbers as isolation; verify each app's supported commands, key prefixes, and ACL model.
- Application callbacks and webhooks must use public HTTPS only where traffic originates externally; verify internal service calls remain cluster-local.
- Single-host PVC placement can block rescheduling; confirm selected classes/access modes and document recovery before deployment.
- A “latest” chart may not support Kubernetes 1.37; require official support evidence and rendered manifests before bumping.

---

## Work Sequence

### Task 1: Clear reproducible YAML lint warnings

**Repository:** `homelab-platform-services`

**Files:** `platform/sonarqube/alerts.yaml`, `platform/turbo-cache-forge/ci-authority.yaml`, `platform/gitlab-runners/values.yaml`, `platform/gitlab-runners/checks-values.yaml`, `platform/gitlab-runners/cleanup.yaml`.

- [ ] Record the current `yamllint -c .yamllint.yaml` findings for the five files.
- [ ] Wrap the long alert and image values without changing YAML values or behavior.
- [ ] Correct the indentation reported by yamllint without changing pipeline/cleanup semantics.
- [ ] Run yamllint on all five files and the repository YAML lint job.
- [ ] Open, merge, and verify the MR pipeline before app deployment work.

### Task 2: Reconcile app secrets and database/dependency contracts

**Repository:** `vault` (and only additional owning repos identified by discovery).

**Files:** follow existing generator, onboarding, schema, tests, and service-doc patterns; add one narrowly scoped onboarding contract for the four apps and their independent credential keys.

- [ ] Verify available secret names without displaying values; use existing provider credentials only where the app-specific contract allows it.
- [ ] Add validated secret generation/mapping and idempotent plan/apply onboarding for Infisical and project CI variables where the existing deployment consumes them.
- [ ] Add tests proving missing/placeholder values fail safely and output never includes values.
- [ ] Seed available credentials through the existing Vault workflow; document keys that require operator-provided provider or OAuth credentials.

### Task 3: Deploy and integrate the four applications

**Repository:** `homelab-platform-services`; database manifests may belong to the existing app-deployment owner if discovery requires it.

**Files:** `platform/<application>/` manifests/chart, pipeline render/deploy/verify jobs, version pins, application runbooks, and relevant app-specific database/storage resources.

- [ ] Pin supported upstream versions and images from official release sources.
- [ ] Render and statically validate each app and dependency before deploy.
- [ ] Configure Paperclip to use the supported remote Hermes gateway adapter; keep a single Hermes gateway process and persistent state.
- [ ] Configure Dify's documented production component set and compatible isolated database/vector/queue dependencies.
- [ ] Configure Autensa/Mission Control to use the existing OpenClaw Gateway internally without changing its existing config.
- [ ] Add private ClusterIP services, persistent storage where needed, security contexts, opt-in Cloudflare-published routes, and label-scoped NetworkPolicies.
- [ ] Keep scheduled/autonomous execution disabled and require operator-controlled smoke tasks.
- [ ] Add verification for DNS/authentication, Access/public HTTPS, model request when credentials exist, integrations, streaming/WebSockets where applicable, and n8n/OpenClaw health.
- [ ] Open and merge app/dependency MRs in dependency order; deploy only from the established protected pipeline.

### Task 4: Upgrade compatible platform components

**Repositories:** `homelab-platform-services`, plus an owning repo only when the inventory shows it owns that pin.

- [ ] Inventory every third-party chart, image, CLI, provider, and controller pin in the homelab deployment repos.
- [ ] Verify each latest stable release, provenance, compatibility with Kubernetes 1.37, and required migration steps from official upstream sources.
- [ ] Group low-risk patch upgrades into reviewable MRs; give CNI, Gateway, CSI, CNPG/database, and other stateful/core changes separate MRs with explicit rollback notes.
- [ ] Run render, policy, schema, and CI checks for each MR; merge and deploy through gated pipelines one change at a time.
- [ ] Keep unsupported or incompatible updates pinned with a documented blocker rather than forcing an unsafe version jump.

### Task 5: Upgrade Talos/Kubernetes if the supported upgrade path is ready

**Repository:** `homelab-cluster-infra` and dependent platform repositories.

- [ ] Verify official upgrade and rollback guidance, node resource capacity, Talos extension/image compatibility, and all platform support matrices.
- [ ] Stage Kubernetes and Talos changes as separate MRs and follow the upstream control-plane/worker upgrade sequence.
- [ ] Run the cluster-infra plan and validation pipelines; deploy only through their manual gates.
- [ ] Verify all nodes, networking, storage, Gateways, certificates, databases, apps, and backups after each upgrade.

### Task 6: Final acceptance and documentation

- [ ] Record application/version/hostname/endpoint/dependency/storage matrix and the exact pipeline/MR links.
- [ ] Verify backup/recovery and rollback limits, including persistent database, Redis, Hermes, Dify, Paperclip, and Autensa state.
- [ ] Confirm all test records/resources were removed and existing n8n/OpenClaw remain healthy.
- [ ] Report any step that remains unverified or blocked by missing external credentials.

