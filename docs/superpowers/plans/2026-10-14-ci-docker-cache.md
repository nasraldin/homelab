# Dockerfile and build-layer caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse dependency/image layers and correct every audited Dockerfile without changing runtime behavior.

**Architecture:** Fetch immutable dependencies before source-heavy stages. Export separate registry BuildKit caches only from authorized writers. Live acceptance waits for a rootless canary; existing publication gates remain in place.

**Tech Stack:** Dockerfiles, pnpm, BuildKit, Harbor, Talos, Kubernetes.

**Spec:** [2026-10-13-ci-registry-cache-performance-design.md](../specs/2026-10-13-ci-registry-cache-performance-design.md), approved October 14, 2026. Read the coordination plan `2026-10-14-ci-cache-performance.md` before execution.

## Global Constraints

Read coordination constraints. Keep Admin module layout and approved hooks; no authenticated .npmrc COPY/private-token build args; all platforms/libc cache identities explicit. No privileged/host-socket/host-path fallback. Rootless sidecar/helper requests count toward the twenty-slot cap.

## Review Focus

PDF-worker hooks, Admin externalized-module paths, omitted Astro content, missing production Dockerfiles and mistaken cache-mount export assumptions have checks below.

### Task 1: Source/context and dependency layers

**Files:** source all18 tracked `*Dockerfile*`, `.dockerignore`, create `scripts/ci/test-docker-build-contract.py`; legacy `Dockerfile`, `Dockerfile.development`, `.dockerignore`; source may create `apps/web/dashboard/Dockerfile` if its production target is supported; templates image target list must agree.
**Interfaces:** each image target declares Dockerfile/context/platform/health command in the image catalog; dependency fetch inputs are frozen lock/workspace/patches/toolchain; installation includes actual lifecycle-hook source inputs.

- [ ] Write failing contract/context tests for actual apps/web Markdown inclusion, supported production targets, digest-pinned PostgreSQL/system_stats revision, frozen legacy Node/pnpm, and no masked package failures. Image tests require API/worker startup, Astro content route, Next health routes and Admin PDF worker/externalized imports.
- [ ] Run tests to establish failures. Split toolchain/fetch/scoped install/source build/runtime stages across the20 audited files. Keep manifests/patches before source, use source-independent pnpm fetch layers and platform/libc/version cache IDs. Lifecycle hooks may rerun on relevant source changes; keep Admin layout exactly. Avoid replacing its install with pnpm deploy without separate proof.
- [ ] Verify each target cold build, source-only and dependency-change build, health command and secret/layer inspection. Record layer CACHED status, fetched bytes and image sizes. Compare output content to baseline, not just exit status.
- [ ] Run repo required checks, commit owning repos `fix(docker): preserve reusable dependency layers and build content`, and publish reviews.

### Task 2: Registry layer cache and safe build credentials

**Files:** source `scripts/ci/build-image.sh`, create `scripts/ci/test-build-image-cache.py`; templates `ajrly/images/harbor.yml`; platform Harbor cache retention/provisioning from Image task2; Vault cache/pull/npm secret onboarding.
**Interfaces:** cache ref `harbor.ajrly.com/<cache-project>/<app>-<platform>-<libc>:trusted`; readonly imports for ordinary builds; export mode=max only with Cache task3-authorized writer. Build metadata records source/digest/cache ref/hits, omitting credentials.

- [ ] Write tests asserting correct --import-cache/--export-cache arguments, no export for untrusted jobs, no tokens in build args/layers, serialized writers per ref, and retained current caches with bounded unused-cache pruning.
- [ ] Run failing tests. Add registry cache arguments, secret-file mounts, safe argv and explicit app/context/platform validation. Scope Harbor/npm tokens by role. Reuse fetched layers across disposable builders; registry cache does not promise persisted cache-mount data.
- [ ] Cold then warm build on a fresh builder, source-only and lockfile edits, token-free layer inspection and pull/run health tests. A fresh builder must demonstrate actual registry imports rather than hidden local state.
- [ ] Commit `feat(images): reuse scoped registry BuildKit layers`; publication remains gated until task3 passes.

### Task 3: Rootless builder canary

**Files:** infra create `talos/patches/ci-rootless-canary.yaml`, modify only worker05 patch selection in `talos/talconfig.yaml`; platform create `platform/gitlab-runners/buildkit-canary.yaml`, `scripts/buildkit-canary-verify.py`, `scripts/test_buildkit_canary.py`; templates `ajrly/images/harbor.yml` after proof.
**Interfaces:** canary report has node/version/sysctls/UID maps/snapshotter/seccomp/sandbox/peak requests and isolation results; readiness flag becomes true only with all required checks.

- [ ] Write policy/envelope tests rejecting privileged, host paths/socket, global sysctl changes, stateful/control-plane selection and additional slots beyond20. Test that failed compatibility keeps publication false and restores original node settings.
- [ ] Verify installed Talos/kernel/BuildKit prerequisites read-only; canary a positive bounded user namespace allowance on worker05, proposed16384, only if that value is sufficient for the observed runtime. Preserve other worker settings. Test native snapshotter/UID maps/mount/unshare and current Pod Security/seccomp without silently expanding exceptions.
- [ ] Test build, registry cache import/export, runaway-process cleanup, cancellation and Pod deletion; prove API/foreign-DB isolation and no host access. If current policy cannot support it, report evidence and stop this task for separately reviewed sandbox design; other work packages continue.
- [ ] Repartition profiles only from the existing twenty-slot total after Scheduling task1 budgets prove capacity; test concurrent source CI. Set readiness flag only after success, commit `feat(ci): validate bounded rootless image execution`, and retain explicit manual publication policy.
