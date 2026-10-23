# Final rollout review and performance acceptance

Status: Independent verification in progress. Earlier completion claims were superseded.

Scope: Ajrly Platform and its homelab CI repositories. `ajrly/web-api` is excluded.
GitHub owns source; GitLab owns the reusable `ajrly/` templates.

## Verified integration and repairs

The integration reviews and source/coordinator pins are recorded in
[the integration report](2026-10-18-ci-cache-integration.md).
Source remains `f645d39c4428526269d66913b7c5cc98bc8e1461`, coordinator
`2bb6304a57c41eb6960b8eca824e53f86293666c`, and template
`193bdf294f7335b5079a24a35c775d5f937d83e2`. Fresh API and policy readback
confirmed agreement.

- Runtime MR71 merged the local routing/security corrections.
- Runtime MR73 bounded concurrent artifact/auth request buffers.
- Runtime MR74 fixed rereading the rotated GitHub metadata token file.
- [Runtime MR90](https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/merge_requests/90)
  merged allocator retention protection at `54894db21f4b57be680c29dd22f6df2a2b8a80a6`.
  Pipeline701 passed. `MALLOC_ARENA_MAX=2` is commissioned without raising512MiB.
- [Runtime MR104](https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/merge_requests/104)
  adjusts admission to current shared-node reservations and runs allocator
  regressions in normal CI. Live acceptance follows its exact-head CI and merge.

## Audit of previous measurements

All five original pipelines eventually completed their18 checks, but their
reliability histories matter. These are observations, not accepted clean trials.

| Pipeline | Trial | Wall seconds | Audit finding |
| --- | --- | ---: | --- |
|645|Cold dependency/task caches|2310.179|No failed attempts; image caches retained.|
|648|Trusted warm-up replay|1632.612|Failed checkout attempt9047 before retry; excluded from timing acceptance.|
|649|Warm1|1002.173|Failed Trivy checkout attempt9080 before retry; authority OOM during run.|
|651|Warm2|1601.239|No retried jobs; authority OOM during run.|
|655|Source edit|1337.546|No retried jobs; authority OOM during run.|
|703|Post-allocator warm trial|1710.371|All18 attempts succeeded, but traces contain sustained Unschedulable waits; rejected for clean acceptance.|

The authority was OOMKilled at07:48:06Z,08:09:56Z and08:35:41Z on October18.
An idle process retained about483MiB anonymous memory despite one live thread.
Linux glibc allocator stress with only two simultaneous transfers reproduced
exit137 at512MiB. Setting `MALLOC_ARENA_MAX=2` completed four batches. A separate
canary using the exact live Python image passed four batches at512MiB with
idle RSS approximately102–122MiB. Test pods and local containers were removed.

Pipeline703 exposed a separate shared-capacity defect. New AI workloads reserve
memory on app workers01/02. The previous eight-build/twelve-check mix no longer
fits. The reviewed replacement admits four build and ten check jobs (14total,
within the approved10–20 range), retaining requests, app-node isolation and VM
sizes. A recorded live-budget regression covers every0–4 active integration mix
plus a retained two-service integration envelope. GitLab queue time is distinct
from Kubernetes scheduling time; the former may increase when admission is reduced.

## Cache evidence and limits

- Canonical dependency restore reports identify the Node26.12/pnpm12.10.1 key and
  successful626,103,947-byte archive plus181,091,380-byte metadata restores.
- Sanitized Turbo summaries contain `cache.remote=true`, task hashes and real
  invalidation misses. Replayed task-log hit totals are not unique remote-task counts.
- The original source edit changed marketing build/typecheck hashes while
  unchanged applications retained remote hits. A fresh reviewed disposable source
  edit is prepared for post-capacity validation.
- Whole-run public-registry byte elimination was not captured. No claim of100%
  WAN elimination, cold image pulls, complete cold CPU accounting or offline full
  security scans is made. Security/integration gates remain fresh.
- Historical1526s and target1144s are references. A target miss must be reported;
  workloads/admission have changed, so earlier timing differences are not a
  controlled comparison with the final configuration.

## Remaining acceptance

After MR104 deployment, capture a fresh cold dependency/task-cache run, two
sequential warm runs and the tracked source edit on the same final configuration.
Require all18 checks, no retried failures, no sustained scheduler capacity waits,
no authority OOM, real remote hits/invalidation and job-pod/temporary-secret cleanup.
Publish queue/startup/cleanup/resource measurements with sampling limitations.
Remove only task-owned temporary branch/observer variables/collectors. Timer stays paused.

## Publication boundary

Rootless BuildKit isolation failed its canary before daemon startup and was
rolled back. Publication remains disabled under the approved design. No broader
sandbox exception or privileged builder is enabled; this report does not certify
rootless publication.

Evidence: `/Users/nasr/.codex/tmp/ajrly-ci-migration/review-performance-final/`.
