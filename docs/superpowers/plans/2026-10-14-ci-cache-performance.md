# CI registry and cache performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repeated public downloads and disposable caches with verified homelab caches while preserving CI correctness.

**Architecture:** Four independently testable work packages ship in dependency order. Existing Harbor, Verdaccio, AIStor and Turbo Cache Forge provide the storage and services; source remains on GitHub and templates under GitLab ajrly/.

**Tech Stack:** Python, Bash, OCI/Skopeo, Helm/Kubernetes, Talos, GitLab Runner/S3, Node26.11.1, pnpm12.10.1, Turbo2.11.7, BuildKit.

**Spec:** [2026-10-13-ci-registry-cache-performance-design.md](/Users/nasr/homelab/docs/superpowers/specs/2026-10-13-ci-registry-cache-performance-design.md), approved October 14, 2026. Read the coordination plan `2026-10-14-ci-cache-performance.md` before execution.

## Global Constraints

- GitHub source and GitLab `ajrly/` template ownership remain unchanged; immutable template/image references.
- All Ajrly runner/job pods stay in `gitlab-runners`; maximum20 active jobs, at least10 configured slots within tested capacity. Extra controllers do not grant extra job slots.
- No new VMs, larger VM sizing, control-plane taint removal or use of stateful/platform workers for ordinary CI.
- Ordinary application jobs receive no App private key, S3 administrator, npm publishing, Harbor writer or infrastructure credentials.
- Image sync concurrency2, preserved all-platform digests and TLS verification; current/rollback images survive GC.
- npm client concurrency4 initially, benchmark8; retain current3Gi Verdaccio/2Gi Node heap until measurements justify changes.
- Dependency archives at most2GiB; proposed extra cache quota at most30GiB after existing budgets are checked. Seven-day upload-based expiry, noncurrent version expiry, incomplete multipart abort after one day.
- Keep security scans, external probes and database integration fresh. Preserve all tests, coverage thresholds and artifact checks.
- Rootless publication stays gated until canary/isolation/image checks pass. Broader sandbox exceptions require a separate reviewed decision.
- Full CI baseline1526 seconds; warm-run target <=1144 seconds (at least25% faster), not a promised outcome.

## Review Focus

1. New operator/helper/static images absent from live inventory: rendered and bootstrap declarations must still be catalogued (Image task1).
2. Offline registry bootstrap loop or invalid TLS hostname: recovery images must pull without depending on Harbor/Gateway being healthy (Image task3).
3. Corrupt, traversing or caller-selected dependency archive: discard and recompute without modifying files outside the store or trusted canonical objects (Cache task2).
4. Forged default-branch/cache-writer authorization: source SHA alone or a caller mode flag never grants write credentials (Cache task3).
5. Cache transfers/build sidecars/terminating pods consume unbudgeted resources: effective reservations and cleanup must still fit the tested mix (Scheduling tasks1–2).

## Repositories and isolation

| Alias | Existing checkout | Base |
|---|---|---|
| platform | /Users/nasr/homelab/homelab-platform-services | main |
| templates | /Users/nasr/homelab/pipeline-templates | GitLab main |
| vault | /Users/nasr/homelab/vault | main |
| infra | /Users/nasr/homelab/homelab-cluster-infra | main |
| foundation | /Users/nasr/homelab/lab-home-pve01 | main |
| source | /Users/nasr/Sources/Ajrly/ajrly-platform | dev |
| deploy | /Users/nasr/homelab/ajrly-k8s-deployments | main |
| legacy | /Users/nasr/homelab/ajrly-web-api | dev |

- [ ] Read applicable AGENTS.md and the worktree skill; fetch current base refs, inventory dirty files, and create/reuse isolated `codex/ci-cache-*` worktrees. Do not reset existing checkouts. Inspect current versions; preserve deliberately updated pins if newer than the recorded baseline.
- [ ] Record baseline current source SHA, source pipeline, all job durations/queue times, request envelopes, upstream byte counts, artifact-service memory and storage budgets. Historical435 is a reference, not proof of the current tree.

## Delivery order

1. [Image supply](2026-10-14-ci-image-supply.md): catalog/sync, scoped credentials/retention, client/recovery rollout, pinned tool image. This can ship independently.
2. [Dependency and task caches](2026-10-14-ci-dependency-task-cache.md): registry load acceptance, distributed infrastructure cache, post-checkout Ajrly store restore, trusted task-cache writer. Requires Image task4 for the final tool-image cutover.
3. [Docker build caching](2026-10-14-ci-docker-cache.md): Dockerfile/context fixes can start after Image catalog interfaces; live BuildKit validation waits for its rootless canary and verified private npm.
4. [Scheduling and acceptance](2026-10-14-ci-scheduling-acceptance.md): diagnostics/default-profile fix can start immediately after plan approval; final mixed-load and performance checks wait for the other packages.

Each task produces a small commit and an owning-repository review. Run required repo validation on that exact head. Update source/coordinator pins only after the corresponding template commit is tested and reachable in GitLab. Attach created reviews. Do not merge new reviews or bypass manual deployment gates without applicable authorization; the previous merge approval covered the completed migration reviews.

## Rollout and result

- [ ] Canary tool image/private npm on one controlled job, then representative concurrency. Roll back consumers to their previous digest/endpoint if the canary fails.
- [ ] Enable cache reads before trusted writes; verify corruption/miss recomputation and key invalidation before wider use.
- [ ] Run full MR and default-branch CI, two warm repetitions and a source-only edit; collect the report defined by Scheduling task3.
- [ ] Publish all review links and measured results, including any unmet performance target or still-gated publication capability. Remove only task-owned disposable test resources after capturing evidence.

## Execution handoff

Recommended method: **Native**. Cache authorization, credential provisioning, template pins and rollout sequencing share interfaces; one implementer avoids overlapping state changes. Use one independent whole-branch review before integration, plus targeted review of authorization and rootless isolation. A subagent-driven implementation is also available if preferred; it adds per-task implementation/review contexts.
