# Scheduling and performance acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove resource envelopes, cache correctness, lower repeated work and bounded pod startup/cleanup.

**Architecture:** Budget effective requests per job/node, including init maxima and terminating pods. Fix invalid defaults first, then compare identical-source cold/warm runs. Sharding or request changes follow measurements, not assumptions.

**Tech Stack:** Kubernetes scheduling/metrics, GitLab API, Python unittest, Helm, Node/Jest coverage.

**Spec:** [2026-10-13-ci-registry-cache-performance-design.md](/Users/nasr/homelab/docs/superpowers/specs/2026-10-13-ci-registry-cache-performance-design.md), approved October 14, 2026. Read the coordination plan `2026-10-14-ci-cache-performance.md` before execution.

## Global Constraints

Read coordination constraints. App workers01/02/05 only for ordinary CI; maximum20 jobs, minimum10 configured slots inside tested headroom; no larger VM assumptions. Requests never exceed limits or understate measured need. Existing coverage/security gates remain unchanged.

## Review Focus

Init-sidecar maxima, terminating-pod reservations, archive transfer RSS/disk, queued versus unscheduled jobs, and mixed-version rollout are explicitly tested.

### Task 1: Effective reservations and valid profiles

**Files:** platform create `scripts/lib/ci_capacity.py`, `scripts/ci-capacity.py`, `scripts/test_ci_capacity.py`; modify `scripts/test_gitlab_runners.py`, `platform/gitlab-runners/{values,checks-values,quota}.yaml`, `scripts/gitlab-runners-verify.sh`; templates `ajrly/common/resources.yml` when measurements require it.
**Interfaces:** `effective_request(pod:dict,resource:str)->Decimal`; `node_budget(nodes:list,pods:list)->list[dict]`; `evaluate_mix(profiles:list,budgets:list,margin:dict)->dict` reports fits/missing CPU/memory/disk/placement and includes init sidecars/overhead/terminating reservations. CLI emits JSON without secret env data.

- [ ] Write tests for restartable init-sidecar accounting, init maxima, overhead, terminating pods, two near-capacity app nodes, sidecar image build and request>limit. Reproduce old403 marketing2Gi+helper profile against recorded node budget and show why it can fail.
- [ ] Run failing tests; implement Decimal quantity parsing and supported scheduler accounting, rejecting unsupported resource types instead of silently ignoring them. Replace hardcoded3332Mi-only tests with profile fixtures/live report. Correct default1920Mi request/1Gi limit to a valid4Gi limit without increasing the request or changing template limit.
- [ ] Capture idle and burst actual reservations/usage, CPU throttling, peak RSS and temporary disk/cache transfer footprint. Choose turnover margin >= the measured largest simultaneous retained-pod envelope; if the mix cannot fit, reduce admitted concurrency within10–20 rather than falsify requests.
- [ ] Run render/tests/live verify and a mix reflecting real app/check/integration envelopes, not only sleeping synthetic pods. Commit `fix(ci): validate effective runner resource envelopes`.

### Task 2: Startup, turnover and cleanup tracing

**Files:** platform create `scripts/ci-job-timings.py`, `scripts/test_ci_job_timings.py`; modify `scripts/ajrly-ci-cleanup.py`, `scripts/test_ajrly_ci_cleanup.py` only if a reproduced cleanup defect requires it; templates add nonsecret cache timing summaries.
**Interfaces:** timing report joins project/pipeline/job/pod UID and queue/admission/image-init/script/cache/cleanup durations; `classify_wait(events:list)->dict` separates normal init Pending from FailedScheduling/Unschedulable and obsolete historical profiles.

- [ ] Write tests using403 job6555 and412 job6791 timestamp fixtures plus435 zero-unschedulable fixture; retain job UID verification, live-job protection, outage retention, registry Secret GC and timeout/cancel behavior.
- [ ] Run failing diagnostics tests; implement collection and percentiles. Reproduce any new sustained wait before changing cleanup or grace. Completed artifact/store uploads must finish before deletion; safe cancellation remains required.
- [ ] Run at least two mixed turnover waves including integration services, success/failure/timeout/cancel and one manager interruption. Record zero sustained memory FailedScheduling, zero OOM/eviction/quota errors, terminal job/temporary-secret cleanup and unchanged other namespaces.
- [ ] Commit `test(ci): track queue startup and cleanup performance`; lifecycle fixes get their own evidence-backed commit if required.

### Task 3: Full cold/warm acceptance and optional API sharding

**Files:** platform create `scripts/ci-cache-benchmark.py`, `scripts/test_ci_cache_benchmark.py`, `docs/runbook-ci-performance.md`; parent create `docs/operations/ci-cache-performance-2026-10-14.md`. Source/template API test configuration changes are conditional on measured bottleneck after caching.
**Interfaces:** benchmark report has exact GitHub/coordinator/template/image revisions, complete job/gate counts, cold/warm wall and CPU times, cache hits/bytes/transfer cost, upstream hosts, service RSS, queue/startup/cleanup percentiles and storage before/after.

- [ ] Write tests that refuse comparisons across mismatched source/tool/template refs, missing jobs, skipped security/coverage gates or fabricated warm cache hits. Include corrupt-cache and lifecycle expiry recomputation.
- [ ] Run failing report tests; implement normalized GitLab/job/cache/Prometheus collection. Execute one controlled cold run, two same-source warm runs, then a representative source-only edit; do not remove shared application storage to make a cold run.
- [ ] Run warmed isolated upstream-denial probes for images/npm/dependency/task caches. Verify new-version refresh imports only new digests and survives retention/GC. Check all produced images for health/content/auth absence and cold bootstrap recovery.
- [ ] Compare warm wall time against1526 seconds and target<=1144; report actual result even if target is missed. Require cache transfer cheaper than recomputation and lower repeated CPU/downloads without dropped checks.
- [ ] Only if API Jest still dominates, prototype two shards with stable test discovery and merged complete coverage, preserving all thresholds. Reject sharding if extra memory/CPU or duplicate setup negates gain. Keep DB integration serial/isolated and uncached. No sharding code is retained without its own failing/pass coverage and scheduling checks.
- [ ] Run all owning-repo required checks plus fresh branch review; publish final reviews and evidence. Verify current-head GitHub status, no terminal orphan pods/secrets, healthy nodes/artifact services and rollout rollback capability. Commit `docs(ci): record measured cache and scheduling acceptance`.
