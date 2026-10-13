# Registry, CI cache, and scheduling performance design

Status: proposed for review. Date: October 13, 2026.

## Outcome and scope

Keep Ajrly source on GitHub and reusable Ajrly CI templates exclusively in GitLab under `ajrly/`. Make image and dependency downloads use existing homelab services, preserve caches across disposable jobs, reduce repeated builds, and avoid long unscheduled pod waits. Keep runner/job pods in `gitlab-runners`, admission below twenty simultaneous jobs, existing quality gates, and isolation from infrastructure credentials.

The work covers homelab-platform-services, homelab-cluster-infra, lab-home-pve01, Vault, GitLab pipeline-templates, Ajrly source, Ajrly deployments, and the legacy web-api Dockerfiles. Changes belong in separate reviews in their owning repositories. Existing user changes must remain intact. It does not assume new VMs, larger VM sizing, or scheduling CI onto control-plane/stateful workers.

## Verified baseline

- All seven migration reviews are merged. GitHub hosted dispatch run38282501608 passed and created GitLab pipeline435 for GitHub dev commit `68f687f515bbab63649200831722e5297c00f534`.
- Pipeline435 passed18/18 in1526 seconds. GitHub received success; terminal pods and temporary registry secrets cleaned up. Its completed traces contain no `Unschedulable` messages.
- Earlier passing pipeline412 had one worker job unscheduled for approximately25 seconds during turnover, before the final64Mi helper reservation. Passing results alone do not establish healthy startup behavior. The exact quoted pod `runner-wuw5djncv-project-7-concurrent-0-6vh2bydx` belongs to marketing job6555 in pipeline403. It was unscheduled for approximately30 seconds before placement on worker05, then ran successfully; that run also predates the final resource profile.
- Heavy-job queue times in435 reached675 seconds. API was the critical path at1526 seconds; API Jest took605.7 seconds,483 suites passed, one skipped. Package tasks took968 seconds; Admin789 seconds.
- API trace reported191 cache misses, four local hits, and remote caching disabled. Kubernetes runner configuration has no distributed cache; job-local pnpm/Turbo stores disappear with pods. Every Node job repeats apt setup and a public pnpm executable download.
- Harbor has approximately98GiB filesystem capacity and84MiB used. All74 distinct current live Pod image references point upstream. The node-local `if-not-present` pull policy already avoids redownloading existing layers; registry mirroring addresses cold pulls and upstream availability.
- Verdaccio has persistent upstream caching, approximately2.5GiB used of19.5GiB, a3GiB container reservation/limit and2GiB Node heap. Concurrent cold installs previously overloaded it. Its latest termination was associated with the host reboot; seven restarts do not prove seven OOMs.
- AIStor has an existing200GiB PVC; current kubelet volume metrics report approximately2.04GiB used. Existing bucket quotas must still be inventoried before reserving cache space. Turbo Cache Forge has20GiB persistent SQLite/artifact storage and one API writer. Platform worker03 already reserves3.01 of3.95 CPUs; increasing every artifact service reservation is not the proposed solution.
- Idle app-worker scheduler accounting, including init-container maxima: worker01 reserves3156Mi of7373Mi; worker02 reserves3204Mi of7373Mi; worker05 reserves956Mi of15423Mi. These are a baseline snapshot, not permanent capacity guarantees.

## Recommended approach and alternatives

Use curated digest-preserving image copies for declared workloads, private npm proxying, S3-backed dependency archives, existing Turbo task caching, and separate Harbor BuildKit caches. This provides explicit inventories, offline repeatability, and measurable cache ownership.

Harbor proxy projects can supplement this for exploratory images but still consult upstream manifests; retention and cold-cache outages require care. A cluster-wide image rewriting webhook would add admission/recovery dependencies and obscure declared image identity, so it is not the initial approach.

Adding shared node_modules volumes or merely increasing concurrency would retain ABI/symlink hazards and amplify contention. Persist immutable package-store data and task outputs instead. No performance target is considered achieved without cold/warm measurements.

## 1. Image inventory and repeatable synchronization

Own the image catalog and sync tool in platform-services. Inventory live containers/init containers, rendered Helm/operator workloads, static/bootstrap components, CI images/services/helpers, Dockerfile bases, and operational scripts. Normalize implicit Docker Hub references. Record source registry/repository, tag, immutable digest, target Harbor repository, platforms, current/rollback usage, and bootstrap classification.

The command supports inventory, plan, sync, verify, and explicit refresh. Planning makes no changes. Sync copies with bounded concurrency2, TLS verification, auth files rather than command-line passwords, all platforms and preserved digests. Existing target digests are skipped. Refresh produces a reviewable lock update instead of silently replacing a pinned version.

Use ordinary Harbor mirror projects for retained offline images; never push into proxy-cache projects. Use separate least-privilege mirror-writer and pull robots. Private workload namespaces receive only pull credentials. Define separate pull credential/CA delivery for Talos host/static components, Docker hosts, BuildKit and node preloading; namespace Secrets do not cover those clients. Keep current and rollback digests explicitly tagged and protected from retention/GC; latest20 alone is insufficient. Preflight image sizes and quotas against actual free storage, and abort before exhausting Harbor's volume.

Update references in the owning Helm values/manifests, CI templates, Dockerfiles and verification scripts. Reject uncatalogued image references in validation, with documented bootstrap exceptions. Avoid one monolithic regex rewrite of generated or third-party charts.

Harbor/Gateway/CNI/CSI/control-plane recovery cannot depend exclusively on a registry they are needed to start. Preserve upstream emergency fallback and preload approved bootstrap digests on relevant nodes. Validate cold-node recovery, not only warm node pulls. Use verified LAN routes for internal clients while retaining certificate validation and correct hostnames; do not send routine internal artifact traffic through Cloudflare unnecessarily.

## 2. Private npm and CI tool images

Build a digest-pinned Node CI tool image containing the existing Node/pnpm pins, Git, Python, curl and required setup tools. Keep source-controlled Dockerfiles/version/checksum inputs. Publish maintenance tool images through a trusted path; application PR jobs only pull them. Mirror scanner and service images without reusing stale scanner results.

Set pnpm/npm registry consistently to the homelab npm endpoint for CI, Docker builds and supported local-development setup. Keep public upstream reads inside Verdaccio. Warm one dependency closure at a time, starting with client network concurrency4; test8 and representative parallel job loads before selecting limits. Measure heap/RSS, response latency, upstream bytes and metadata/plugin overhead. Disabling or optimizing the UI cache-index middleware must be justified by profiling, not speculation.

Switch consumers only after cold/warm load tests pass at the current service footprint. Create a dedicated install-only npm identity excluded from publish rules; the existing homelab-ci identity can publish and must not be reused for installs. Public npm proxy reads may remain anonymous. Publishing credentials are separate. Inspect actual tarball URLs, lockfile registry precedence and bootstrap endpoints to prove traffic uses the proxy. Docker builds receive npm configuration using BuildKit secret mounts; never COPY an authenticated .npmrc or pass private tokens in build arguments. Missing private-cache dependencies fail clearly; no silent fallback conceals a broken registry.

## 3. Persistent dependency and task caches

Configure both Kubernetes runner pools and the existing Docker infrastructure runner with the existing S3 service, scoped bucket/prefix credentials, TLS, shared cache addressing where intended, upload-size bounds, quotas and lifecycle expiry. Standard GitLab archive credentials remain on runner managers; helpers use signed cache URLs. Advertise a TLS endpoint reachable from Kubernetes helpers and the Docker VM, and trust its CA in every client, not only managers. Do not mount object-store admin credentials into jobs. Replace the Docker runner role's disabled/stale cache defaults with the verified live endpoint.

Cache pnpm's package store, not node_modules. Keys include cache schema, source dependency identity, exact pnpm/Node versions, architecture and libc. Dependency identity covers the frozen lockfile, workspace settings and patch contents. Use a bounded canonical warm writer and read-only consumers; isolate PR-owned writes from trusted caches. First measure S3 actual used/free space and existing bucket budgets: the200GiB PVC is provisioned capacity, not free capacity. Propose2GiB maximum archives and at most30GiB additional dependency-cache quota within that measured budget. Seven-day expiry is measured from upload, not last read; also expire noncurrent versions and abort incomplete multipart uploads after one day. Avoid having many jobs overwrite the same partial archive.

Ajrly uses `GIT_STRATEGY:none`: GitLab restores archives before its custom GitHub checkout. Use an explicit dependency-store restore AFTER exact-source verification and local dependency-key computation rather than `cache:key:files` or caller-selected pre-checkout archives. Ordinary jobs receive a separate read-only S3 identity limited to the canonical dependency prefix, never runner-backend or administrator credentials. The trusted producer is a pinned maintenance workflow in protected platform-services main; it fetches verified default-branch dependency inputs and does not execute submitted application hooks. No ordinary PR job uploads canonical archives. Restore accepts only the expected store paths and verified manifest/checksum; oversized, expired, missing or corrupt archives are discarded and recomputed through the private registry. Scope-specific archives are used if the full store exceeds the archive budget. Tests cover traversal, corruption, forged keys and attempted policy overrides. Standard runner-managed GitLab caches remain appropriate for infrastructure repos with normal Git checkout.

Enable existing Turbo Cache Forge reads for ordinary jobs and writes only for server-verified current default-branch source. Caller-supplied `AJRLY_TRUSTED` and GitLab coordinator-main protection are not authorization. Its main remains unprotected to avoid inheriting unrelated homelab infrastructure secrets. Read/write tokens have separate scopes; writer credentials are delivered only by trusted orchestration after source authorization, never by a caller-supplied pipeline mode. Shared executable outputs require artifact signing when writer isolation alone cannot establish provenance. Quota/expiry checks for the20GiB Turbo volume and Harbor caches are maintained separately by their owning services.

Audit Turbo inputs, outputs and environment hashes, including CI configuration, toolchain, build/public variables and framework settings. Reuse deterministic package build/typecheck/unit outputs and required coverage artifacts. Database integration outcomes, external probes and security scan results always run fresh. Scanner database/tool caches have explicit freshness rules. Correct documentation that currently claims nonexistent GitLab archive caches.

## 4. Dockerfile layers and image build caches

The audit covers18 Ajrly and two legacy Dockerfiles. All eight production Ajrly application Dockerfiles lack persistent cache mounts; source package trees invalidate install layers. Worker/blog/docs/marketing also install unfiltered workspaces. API independently installs development and production dependencies. Development cache mounts exist but use one undifferentiated ID and copy package source before installation.

Split immutable toolchain, lockfile/workspace/patch fetch, scoped dependency install, source build and runtime stages. Account for approved install hooks and the generated Admin PDF worker. Use cache IDs separated by platform/libc/pnpm version. Reuse the dependency FETCH layer across source-only edits. Installation may correctly rerun when approved lifecycle-hook inputs change; do not claim every install can be source-independent. Preserve Admin's existing module layout: its documented Turbopack externalization behavior makes blind pnpm-deploy conversion unsafe.

Fix stale Astro Markdown exceptions in .dockerignore for the actual apps/web paths, and verify content is present in built images. Pin the PostgreSQL base digest and system_stats source revision; remove error-masking package installation chains. Pin legacy development Node/pnpm and use the frozen lockfile. Validate every declared production image path, including whether Dashboard needs a production Dockerfile or an explicit alternative.

Add BuildKit registry cache import/export per app/platform/trust scope, using a separate cache repository and mode=max for intermediate stages. Published caches have bounded retention and serialized writers per key. PR builds may read trusted caches but cannot overwrite them. Cache mounts complement exported layers. Registry mode=max does not generally export cache-mount contents; durable reuse comes from the source-independent fetched dependency layer unless a separately tested persistent builder-store mechanism is provided.

Rootless BuildKit is currently gated because Talos disables user namespaces. Do not declare image cache acceptance while that blocker remains. A separate canary work package evaluates a rootless builder on one labeled app worker with a bounded user-namespace allowance and narrowly scoped container settings, no privileged mode/host socket/host paths. Scheduling includes builder sidecar, helper, memory and ephemeral storage. The canary must verify UID mapping, snapshotter support, mount/unshare permissions, seccomp/Pod Security and process-sandbox behavior. User namespaces alone are insufficient. Broader exceptions or changes to the no-process-sandbox setting require a separately reviewed decision. Its slots must come from the existing twenty-slot ceiling, not be added on top. If this requires repartitioning job pools, benchmark the mix and preserve at least ten configured admission slots within a tested resource envelope; configured slots do not guarantee immediate execution under unrelated workload pressure. Publication stays gated until the canary, isolation tests and image/runtime smoke checks pass; ordinary PR CI continues throughout.

## 5. Scheduling and resource utilization

Trace job queue, pod admission, image pull, initialization, script, cache transfer and cleanup separately. Record exact pod UID, current per-node reservations, init/sidecar maxima, overhead and terminating pods. Retain the identified pipeline403/job6555 trace as the quoted-pod regression reference.

Fix invalid runner defaults: the build pool currently defaults to a1920Mi request and1Gi limit unless templates override it. Every supported profile must have request <= limit. Replace hardcoded single-node baseline tests with live/effective scheduling budget checks and profile-envelope tests.

Retain control-plane taints and app-worker selection. The two other workers intentionally host platform/stateful services; their exclusion is not an error to fix by widening placement. Maintain a tested node-level turnover margin. Shorten disposable-job termination only after verifying artifact/cache uploads and cancellation cleanup remain intact. Do not reduce reservations below measured need or inflate concurrency to hide queues.

Prefer lighter warmed jobs and less repeated task execution before changing slot counts. Benchmark API test sharding only if it still dominates after caches; merge coverage correctly and preserve all current thresholds, test discovery and database isolation. Any resource adjustment requires measured peak/RSS and CPU throttling evidence.

## Ownership and delivery sequence

1. Platform-services: image inventory/sync, Harbor robots/retention, LAN routes, npm load instrumentation, cache services and runner cache configuration. Vault: scoped credentials/bootstrap/schema. Lab-home-pve01: Docker runner cache configuration. Produce reviewable PRs/MRs.
2. GitLab templates and Ajrly source: pinned CI images, verified dependency keys, dependency/Turbo cache policy, bootstrap reduction, corrected cache documentation and task reuse. Full cold/warm CI tests.
3. Ajrly/legacy source Dockerfiles and image scripts: layer/context correctness, pins, secret mounts and registry caches. Infra: builder canary and image-pull integration. Deployments: catalogued image references. Full image/runtime and recovery tests.
4. Scheduling refinements and any test sharding follow measured evidence. No blanket request reduction or new VM capacity is presumed.

## Acceptance and rollback

- Repeated sync is idempotent; update imports only new digests; multi-platform/digest identity and retention survive GC. All supported image pull sites use catalogued homelab paths or named recovery exceptions.
- With upstream access withheld from test workloads, warmed image/npm/store/task caches remain usable. Never block the whole cluster network to test an outage.
- Source-only edits reuse dependencies; lockfile/patch/toolchain edits invalidate appropriate keys; unrelated app edits do not reinstall every workspace. PR cache-key/policy overrides and corrupt archives cannot poison canonical dependency or trusted task/image caches. Tokens are absent from layers, archives and logs.
- Two warm runs of the same source plus a representative source-only edit show actual cache hits, lower transferred bytes and lower CPU time. Target a25% reduction from the1526-second baseline without dropped gates; report the measured result even if the target is missed. Archive restore/upload must cost less than the work saved.
- Under a mixed burst, no sustained FailedScheduling memory wait, OOM, eviction or quota failure occurs. Normal creation/init Pending state is measured separately. Queue, startup and cleanup percentiles are reported; pending jobs stay in GitLab until usable slots exist.
- All current tests/security/coverage and image health checks pass. Storage remains inside quotas and lifecycle rules. Cache misses/corruption fail safe through recomputation; deletion of a disposable cache never loses source or published artifacts.
- Rollback per owning review: restore prior image paths/toolchain digest/cache policy/registry endpoint, disable the new builder and revert its node settings. Keep current/rollback mirrored artifacts until rollback validation completes. No manual deployment gates are bypassed.

## Primary references

- [Harbor proxy behavior and offline limitations](https://goharbor.io/docs/main/administration/configure-proxy-cache/)
- [GitLab runner distributed cache configuration](https://docs.gitlab.com/runner/install/kubernetes_helm_chart_configuration/)
- [Docker cache layer ordering and cache mounts](https://docs.docker.com/build/cache/optimize/)
- [Docker registry-backed build caches](https://docs.docker.com/build/cache/backends/registry/)
- [pnpm Docker build guidance](https://pnpm.io/docker)
- [BuildKit rootless requirements](https://raw.githubusercontent.com/moby/buildkit/master/docs/rootless.md)
