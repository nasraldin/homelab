# Image supply and CI toolchain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an idempotent inventory-driven Harbor image sync and verified client rollout.

**Architecture:** A locked catalog maps source references to digest-identical Harbor images. Scoped clients consume it; bootstrap recovery has explicit fallback/preload. A trusted maintenance build supplies the pinned CI tool image.

**Tech Stack:** Python unittest, Skopeo, Harbor API, Helm, Talos, Docker, GitLab CI.

**Spec:** [2026-10-13-ci-registry-cache-performance-design.md](/Users/nasr/homelab/docs/superpowers/specs/2026-10-13-ci-registry-cache-performance-design.md), approved October 14, 2026. Read the coordination plan `2026-10-14-ci-cache-performance.md` before execution.

## Global Constraints

Read the coordination plan constraints. Copy concurrency2; all platforms/digests preserved; TLS never disabled; normal mirror projects retain current/rollback images; no cluster-wide admission rewrite.

## Review Focus

Rendered operators, implicit Docker Hub names, multi-platform index mismatch, bootstrap dependency loops, and leaking authentication files are pinned by the tasks below.

### Task 1: Catalog and sync command

**Files:** platform create `scripts/lib/image_catalog.py`, `scripts/image-mirror.py`, `scripts/test_image_mirror.py`, `platform/artifacts/images.lock.json`; modify `scripts/artifacts-verify.py`, `docs/runbook-artifacts.md`.
**Interfaces:** `ImageRef(registry:str, repository:str, tag:str|None, digest:str|None)`; `parse_ref(value:str)->ImageRef`; `collect_refs(inputs:list[Path], live:dict)->list[dict]`; `plan_sync(entries:list[dict], target:RegistryClient, free_bytes:int)->list[dict]`. Lock schema1 entries: `source`, `digest`, `target`, `platforms`, `occurrences`, `bootstrap`, `rollback`; report has copied/skipped/failed digests and bytes. CLI `inventory|plan|sync|verify|refresh --catalog FILE --auth-file FILE --concurrency 2 --report FILE`.

- [ ] Write `test_implicit_docker_hub`, `test_operator_and_init_inventory`, `test_digest_idempotency`, `test_index_digest_mismatch`, `test_plan_no_mutation`, `test_refresh_requires_lock_update`, `test_storage_preflight` and `test_auth_redaction`. Assert redis:8 normalizes to docker.io/library/redis:8; unchanged digests cause zero copy calls; any source/target index mismatch fails; planning has zero writes; insufficient quota aborts before copy; secrets never enter logs.
- [ ] Run `python3 -m unittest discover -s scripts -p test_image_mirror.py -v`; confirm these fail against missing implementation.
- [ ] Implement the interfaces/CLI with structured argv and bounded `skopeo copy --all --preserve-digests`; expose RegistryClient inspect/copy/list methods for fakes. Use live JSON plus rendered Kubernetes YAML and structured CI/Dockerfile extraction; unresolved dynamic refs are reported with locations rather than silently omitted.
- [ ] Run unit tests, repo lint and dry inventory against live/rendered input. Verify every distinct reference has an occurrence and current digest; no credentials in report. Commit only listed paths: `feat(images): add verified Harbor sync catalog`.

### Task 2: Scoped registry/cache identities and retention

**Files:** platform modify `scripts/artifacts-configure.py`, `scripts/artifacts-secrets.py`, `platform/artifacts/harbor-values.yaml`; create `scripts/test_image_mirror_credentials.py`. Vault modify `schema/projects/homelab.yaml`, `scripts/onboard_artifacts.py`; create `scripts/test_artifact_cache_credentials.py`.
**Interfaces:** catalog targets from task1; reconciler outputs separate mirror-writer and pull-only identities, explicit current/rollback retention markers, never a secret-bearing report.

- [ ] Write tests asserting read identities cannot push/delete; writer cannot administer Harbor; repeated reconcile preserves valid scoped identities; retention preserves catalog current/rollback and reclaims only unused cache artifacts; dry-run mutates nothing.
- [ ] Run the named Python unittest modules and confirm failure before changes.
- [ ] Reconcile ordinary private mirror projects/robots/retention using existing API helpers; store credentials in Vault/Infisical by role. Preflight catalog byte estimate/project quotas against actual registry free space, not only PVC size.
- [ ] Run tests/schema validation; controlled live copy/read denial/retention checks use disposable repos. Commit each owning repo: `feat(artifacts): provision scoped mirror identities`.

### Task 3: Image client and recovery rollout

**Files:** platform `platform/artifacts/`, `platform/gitlab-runners/{values,checks-values}.yaml`, `scripts/artifacts-verify.py`; infra `talos/patches/common.yaml`, create `talos/patches/registry-mirrors.yaml`, `scripts/registry-mirror-verify.py`; foundation `ansible/roles/docker_host/{defaults,tasks}/main.yml`; deploy image-bearing Helm values/manifests and operational scripts enumerated by task1; templates `ajrly/{common,security,tests,images}/*.yml`.
**Interfaces:** consume verified target/digest mappings and pull identities; produce `image-clients.json` with each client, endpoint, CA/auth delivery and fallback classification.

- [ ] Write `test_all_declared_refs_catalogued`, `test_bootstrap_no_registry_cycle`, `test_host_and_helper_auth_delivery`, `test_tls_hostname_and_fallback`. Assert static/host clients are not treated as covered by namespace Secrets; reject insecure_skip_verify and unknown image rewrites.
- [ ] Run failing tests, then implement explicit Helm/manifest/script updates using existing override/post-render mechanisms. Use verified LAN DNS/TLS routes. Bootstrap images retain upstream fallback and preloading; verify actual Talos mirror behavior against the installed version before configuration.
- [ ] Canary one app node/workload; test namespace, manager/helper, VM Docker and BuildKit-base pulls. Simulate upstream denial only in disposable test paths. Test bootstrap recovery with Harbor unavailable without rebooting the whole cluster.
- [ ] Run render/lint/verify in each repo, publish per-repo reviews, and commit `feat(images): route approved pulls through Harbor`. Retain prior image refs/digests for rollback.

### Task 4: Pinned CI tool image

**Files:** platform create `platform/ci-tools/Dockerfile.node`, `platform/ci-tools/versions.json`, `scripts/ci-tools-build.sh`, `scripts/test_ci_tools.py`; modify `.gitlab-ci.yml`. Templates later consume its published digest.
**Interfaces:** versions.json pins Node/pnpm/tool checksums; maintenance build emits `ci-tools-proof.json` with source revision, image digest, platform and exact tool versions.

- [ ] Write tests that reject unpinned/mismatched tools and token-containing layers; image smoke checks require Node/pnpm pins, Git/Python/curl and successful exact-source helper execution.
- [ ] Run failing tests, implement the trusted maintenance build using the existing infrastructure Docker runner, and keep ordinary Ajrly execution on Kubernetes. No new host Docker socket is exposed to Ajrly PRs.
- [ ] Build/push/scan the image, inspect layers for secrets, canary `.node` without apt/pnpm bootstrap; verify cold-node authenticated pull.
- [ ] Commit/publish `feat(ci): provide pinned homelab Node tool image`; record the digest in task1 catalog and hand it to Cache task1. Never invent the digest in YAML.
