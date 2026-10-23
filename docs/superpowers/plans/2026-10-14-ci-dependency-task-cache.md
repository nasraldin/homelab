# Dependency and task caches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make private npm, dependency archives and trusted task caches usable across disposable jobs.

**Architecture:** Test Verdaccio before consumer cutover. Infrastructure uses standard runner S3 caching; Ajrly restores dependency stores after verified custom checkout. Canonical producers and trusted task writers run separately from PR consumers.

**Tech Stack:** Verdaccio, S3/AIStor, GitLab Runner, Python, pnpm, Turbo Cache Forge.

**Spec:** [2026-10-13-ci-registry-cache-performance-design.md](../specs/2026-10-13-ci-registry-cache-performance-design.md), approved October 14, 2026. Read the coordination plan `2026-10-14-ci-cache-performance.md` before execution.

## Global Constraints

Read coordination constraints. npm concurrency4 then benchmark8; archives <=2GiB, extra quota <=30GiB after budget checks; seven-day upload/noncurrent expiry and one-day multipart abort. No node_modules cache, source hooks in dependency producer, ordinary canonical uploads, or admin/publishing tokens in installs.

## Review Focus

Registry precedence/tarball bypass, archive traversal/corruption, stale cache-key inputs, forged writer requests and early restore before GitHub checkout have tests below.

### Task 1: Private npm acceptance and runner S3 backend

**Files:** platform `platform/artifacts/verdaccio-values.yaml`, `platform/gitlab-runners/{values,checks-values}.yaml`, `scripts/gitlab-runners-verify.sh`; create `scripts/npm-cache-probe.py`, `scripts/test_cache_config.py`, `scripts/cache-storage-configure.py`; foundation `ansible/roles/gitlab_runner/{defaults,tasks}/main.yml`, `files/fix_runner_cache.py`; Vault `schema/projects/homelab.yaml`, `scripts/onboard_ajrly_gitlab_ci.py`, create `scripts/onboard_ci_cache.py`, `scripts/test_ci_cache_credentials.py`; templates `ajrly/common/node.yml`.
**Interfaces:** `CacheEndpoints(npm_url:str,s3_url:str,turbo_url:str,ca_bundle:Path)`; `probe_npm(profile:dict, concurrency:int)->dict` returns hosts/bytes/latency/peak RSS/restarts; storage reconcile returns bucket policies/lifecycle/quota report with secret values omitted.

- [ ] Write tests for install-only npm user excluded from publish rules, scoped S3 permissions, expired/noncurrent/multipart lifecycle, TLS endpoint reachable by helpers and Docker VM, and configured cache secrets on both pools. Reject legacy HTTP192.168.68.21 defaults and root keys in job variables.
- [ ] Run failing unit/schema/render checks; reconcile dedicated install identity and separate runner-backend, canonical-reader and maintenance-writer S3 scopes. Inventory other bucket quotas first. Existing homelab-ci publisher is not an install identity.
- [ ] Run single cold/warm npm closure loads at4 and8 connections, then representative parallel loads. Capture actual tarball hosts and upstream bytes, memory/CPU and metadata plugin overhead. Keep current Verdaccio footprint until measured need is established; change middleware only after a test reproduces its cost.
- [ ] Configure infrastructure S3 cache and consumer private-registry/tool-image settings after acceptance. Canary TLS/auth/read-denial and offline warmed installs. Commit each repo `feat(cache): configure scoped private dependency services`.

### Task 2: Canonical dependency archive producer and safe restore

**Files:** templates create `ajrly/scripts/dependency_cache.py`, `ajrly/tests/test_dependency_cache.py`, modify `ajrly/common/node.yml`; platform create `scripts/dependency-cache-warm.py`, `scripts/test_dependency_cache_warm.py`, modify `.gitlab-ci.yml`; source modify `scripts/pnpm-install-scoped.mjs` only for prefer-offline/integrity/store compatibility if needed, `docs/REMOTE_CACHE.md`; Vault use task1 read/writer credentials.
**Interfaces:** `dependency_key(root:Path,scope:str,toolchain:dict)->str` hashes canonical schema/platform/libc/Node/pnpm plus lockfile/workspace/patch inputs; `restore_store(root:Path,key:str,reader:S3Reader)->RestoreResult` has hit/miss/rejected/bytes/duration; `publish_store(root:Path,key:str,writer:S3Writer)->dict` runs only in protected maintenance orchestration. Manifest schema1: key, toolchain, scope, created_at, archive_sha256, compressed_bytes, expanded_bytes. Archive paths are relative to `.pnpm-store/` only.

- [ ] Write tests for key changes on lock/workspace/patch/toolchain but not unrelated source edits; exact checkout required before restore; no cache:key:files for custom checkout; reject absolute/../ paths, external symlinks, devices, >2GiB archives, excess expanded size, bad SHA and expired manifest. On rejection remove staging files and cold-install; canonical object must remain unchanged after PR attempts.
- [ ] Run failing unittest modules. Implement streamed staging/verification/safe extraction and atomic store promotion; bound expanded bytes against free job disk. Producer fetches verified current default-branch dependency inputs without executing application hooks, serializes writers per key, and is invoked from protected platform main only. Ordinary jobs get read-only canonical-prefix credentials.
- [ ] Wire restore after `.ajrly_source` verification and before scoped install; preserve frozen lockfile/native hook behavior and integrity validation. Emit hit/miss/bytes/duration summaries without signed URLs or secrets. Misses are normal cold recomputation through Verdaccio.
- [ ] Test real small closure cold/warm, source-only edit and each invalidation input. If full-store budget is exceeded use scope archives, never silently lift size/quota. Commit `feat(cache): restore verified dependency stores after checkout` and pin tested templates/source coordinator together.

### Task 3: Trusted task-cache authorization and reuse

**Files:** platform create `scripts/ci-cache-authority.py`, `scripts/test_ci_cache_authority.py`, `platform/turbo-cache-forge/ci-authority.yaml`; modify service/network policy/render/deploy/verify scripts. Vault extend scoped cache onboarding. Templates `ajrly/common/node.yml`, `ajrly/checks/monorepo.yml`, `ajrly/tests/monorepo.yml`; source `turbo.json`, `scripts/__tests__/turbo-cache.test.mjs`, `docs/REMOTE_CACHE.md`.
**Interfaces:** `authorize_writer(job_token:str)->Grant` derives GitLab job/project/pipeline identity server-side, verifies project7, configured immutable coordinator/template revisions and current GitHub default-branch source SHA, and returns a short-lived team-scoped grant. Unsupported scoped token issuance uses a server-side Turbo API proxy; it never returns its root/upstream writer credential. Allowed GET/HEAD for read grants, artifact PUT only for verified write grants; no cache administration.

- [ ] Write tests rejecting forged mode/ref/SHA/job IDs, stale source, unapproved coordinator revision, PR tokens and expired grants; verify read identities cannot PUT/delete and valid current default-source grants cannot administer another team. Test signature/provenance rejection for untrusted executable artifacts.
- [ ] Run failing tests. Implement authority using existing GitLab job-token validation/GitHub installation-read access and configured revision allowlists; App private key remains only in reconciler. Broker receives short-lived read metadata credentials, scoped upstream cache identity, no infrastructure admin secret. Compare real Forge API support before selecting direct grants versus proxy; both enforce identical tested contract.
- [ ] Hash correctness-affecting toolchain/CI/build/public environment inputs and declare required outputs/coverage. Enable read-only reuse first, authorized writes second. Leave DB integration/external probes/security results uncached; Trivy/rule feed caches must be revalidated on each scan with a24-hour maximum age; stale/unverifiable feeds fail the scan rather than replay a previous result. Add stale-feed and offline-warm-dependency tests separately so an offline dependency test never implies a fresh security scan.
- [ ] Verify local-cleared remote hits, source/input invalidation, PR denial and signed/provenance-correct artifacts. Run full tests and corrected documentation checks; commit `feat(cache): authorize trusted shared Turbo writes`.
