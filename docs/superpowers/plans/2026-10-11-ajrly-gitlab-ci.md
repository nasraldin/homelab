# Ajrly GitLab Kubernetes CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Run Ajrly CI on disposable Kubernetes pods while retaining GitHub source and reusable GitLab templates.

**Architecture:** A short GitHub-hosted dispatch workflow starts a GitLab coordination pipeline pinned to trusted templates and an exact GitHub SHA. Two Kubernetes runner managers provide ten slots each, with namespace quotas protecting shared workloads. A reconciliation job reports terminal pipeline status even when application jobs never reach their scripts.

**Tech Stack:** GitLab 19.4, GitLab Runner Kubernetes executor, Helm, Talos, Cilium, Python, Node 26.11.1, pnpm 12.10.1, rootless BuildKit.

**Spec:** `/Users/nasr/homelab/docs/superpowers/specs/2026-10-11-ajrly-gitlab-ci-design.md`

## Global Constraints

- GitHub remains the authoritative Ajrly source repository.
- All runner managers and CI job pods use the namespace `gitlab-runners`.
- Reusable Ajrly templates live under the root directory `ajrly/` in `pipeline-templates`.
- The aggregate job concurrency is 20 across the pool.
- Ten slots are the baseline capacity target; no idle build pods are reserved.
- Do not increase VM memory or create additional worker VMs.
- Preserve unrelated dirty files and existing templates; never stage entire repositories.
- Publication requires verified trusted source events; coordination-branch protection alone is insufficient.
- Do not copy the broad personal GitHub CLI token into CI.

## Review Focus

- A PR branch advances between dispatch and checkout: execute the submitted SHA or fail.
- An attacker submits a forged trusted event: independently verify GitHub metadata before exposing publication credentials.
- A manager dies during a job: detect orphaned resources without deleting another active job.
- GitLab rejects or loses a dispatch response: surface failure and prevent duplicate pipelines on retries.
- Cancellation happens before any status-reporting script: reconciliation must publish a terminal GitHub result.

## Files and execution boundaries

Repository roots used below:

- `templates`: `/Users/nasr/homelab/pipeline-templates`
- `platform`: `/Users/nasr/homelab/homelab-platform-services`
- `vault`: `/Users/nasr/homelab/vault`
- `source`: `/Users/nasr/Sources/Ajrly/ajrly-platform`

Keep existing cleanup branches and commits. Create `codex/ajrly-gitlab-ci` in
templates. At execution start inspect repository instructions and current diffs,
then isolate new work where needed while preserving the cleanup commit bases.
No implementation occurs until this plan is approved and an execution method
is selected.

### Task 1: Exact source and trust contract

**Files:** Create `templates/ajrly/common/source.yml`, `templates/ajrly/scripts/source.py`, and `templates/ajrly/tests/test_source.py`.

**Interfaces:** `validate_event(payload: dict, github_metadata: dict) -> dict` returns validated repository, SHA, ref, target SHA, event identity, and `trusted: bool`. CLI `source.py checkout` consumes `AJRLY_SOURCE_REPOSITORY`, `AJRLY_SOURCE_SHA`, `AJRLY_SOURCE_REF`, `AJRLY_EVENT_ID`, and authenticated metadata; produces the checked-out source tree and a nonsecret event manifest.

- [ ] Write tests for exact SHA checkout, moved refs, invalid repository/ref/SHA, forged trust, fork PRs, and trusted protected pushes. Assert a moved ref never silently changes the SHA and forged events never become trusted.
- [ ] Run `python3 -m unittest discover -s ajrly/tests -p test_source.py` in templates; confirm meaningful failures before implementing.
- [ ] Implement checkout using explicit Git argument arrays, authenticated GitHub metadata, and exact commit verification. Do not persist credentials in Git URLs or artifacts. Use `GIT_STRATEGY: none` for application jobs.
- [ ] Run the tests; confirm all cases pass and logs contain no credential material.
- [ ] Commit only the task files with `feat(ci): verify exact GitHub source events`.

### Task 2: Reusable Ajrly pipeline

**Files:** Create `templates/ajrly/pipeline.yml`, `common/node.yml`, `common/resources.yml`, `checks/monorepo.yml`, `tests/monorepo.yml`, `build/monorepo.yml`, `security/monorepo.yml`, `quality/sonar.yml`, `images/harbor.yml`, `release/changesets.yml`, and `README.md`. Modify `templates/ci/preflight/catalog.json`, `templates/.gitlab-ci.yml`; create Ajrly fixtures/expected snapshots under `ci/preflight/`.

**Interfaces:** Entry point `ajrly/pipeline.yml` includes the files above and consumes Task 1's source contract. Application commands invoke `scripts/ci/` in the verified checkout. Untrusted jobs never inherit publication or analysis credentials.

- [ ] Add consumer fixtures asserting expanded app/package jobs, explicit optional publication gates, independent check dependencies, and absence of blanket `resource_group: ajrly-platform-ci`.
- [ ] Run existing preflight validation against those fixtures and confirm failure before adding templates.
- [ ] Factor the current source `.gitlab-ci.yml` into templates, preserving its existing app inventory and checks. Pin Node/pnpm versions above, use localhost for per-pod integration services, and permit remote-cache writes only for trusted events.
- [ ] Define initial build-container profiles: checks 250m/512Mi request and 1 CPU/1Gi limit; builds 1 CPU/2Gi request and 2 CPU/4Gi limit; integration 500m/1Gi request and 2 CPU/2Gi limit. Set helper request 100m/128Mi, limit 500m/512Mi; account separately for every service. Profile overrides cannot exceed runner bounds. Tune only using Task 7 measurements.
- [ ] Run `python3 ci/preflight/validate.py`, GitLab CI lint with expanded jobs, and formatting checks. Assert trusted/untrusted consumer cases and exact template include revisions.
- [ ] Commit the task files with `feat(ci): add reusable Ajrly pipeline templates`.

### Task 3: Kubernetes runner pool and disposable builds

**Files:** Create `platform/platform/gitlab-runners/{namespace.yaml,values.yaml,quota.yaml,network-policy.yaml}`, `platform/scripts/gitlab-runners-{render,apply,verify}.sh`, and `platform/docs/runbook-gitlab-runners.md`. Modify `platform/versions.env` and `.gitlab-ci.yml` with scoped render/deploy/verify jobs.

**Interfaces:** Helm release `gitlab-runners` uses a pinned chart compatible with the installed GitLab/Runner version. Two manager replicas each have `concurrent: 10`; executor namespace is fixed. Render writes manifests; apply consumes existing kubeconfig conventions; verify exits nonzero for invalid namespace/concurrency/isolation settings.

- [ ] Add manifest checks for namespace-scoped RBAC, two managers, ten slots each, no privileged mode/host socket/host paths, no job API token, allowed resource overrides, finite deadlines, and control-plane exclusion.
- [ ] Render before implementation and confirm the missing runner configuration fails these checks.
- [ ] Implement managers with 100m/128Mi requests, 500m/256Mi limits, graceful shutdown, and supported runner cleanup/deadline settings. Set namespace aggregate quota initially to 12 CPU and 24Gi requests, 24 CPU and 40Gi limits, and bounded ephemeral storage; verify these fit existing node requests before apply. Use quota to queue work safely, not artificially inflate physical capacity.
- [ ] Add Cilium policy allowing required endpoints and denying unrelated application/database access. Separate manager API access from job egress using pod labels.
- [ ] Configure per-job rootless BuildKit with explicit service resources and disposable storage. Verify its security settings on Talos; if unsupported, stop image rollout and report the concrete failure rather than introducing privileged builds.
- [ ] Run Helm render, server dry-run, manifest checks, and scoped network-policy validation. Commit only runner files and deliberate CI/version edits.

### Task 4: GitLab coordination and credential provisioning

**Files:** Create `vault/scripts/bootstrap_ajrly_gitlab_ci.py`, `vault/onboards/ajrly-gitlab-ci.yaml`, and `vault/docs/ajrly-gitlab-ci.md`; update the existing neutral application CI configuration where required.

**Interfaces:** Bootstrap consumes the established local bootstrap credential mechanism; idempotently creates `homelab/ajrly-platform-ci`, scoped runner authentication, pipeline trigger access, trusted/publication separation, and Infisical secrets. Outputs only nonsecret project/runner identifiers and URLs. Coordination config pins the Task 2 template revision.

- [ ] Add API-mocked tests for reruns, conflicting project ownership, partial provisioning failure, and absence of secrets in output.
- [ ] Run those tests and confirm failure before implementation.
- [ ] Implement provisioning using existing GitLab API/Vault conventions. Provision a dedicated GitHub source/status integration scoped to Ajrly contents read and statuses write; do not reuse revoked ARC identities or personal OAuth credentials. Keep publication credentials out of arbitrary dispatch pipelines and resolve them only after Task 1 trust verification through an isolated trusted path.
- [ ] Run tests and secret scanning; commit the provisioning files.
- [ ] After publishing reviewed template/config revisions, run bootstrap and verify API permissions and secret placement without printing values.

### Task 5: Dispatch, status reconciliation, and cancellation

**Files:** Create `source/.github/workflows/gitlab-ci.yml`, `source/scripts/ci/gitlab-dispatch.py`; create `platform/scripts/ajrly-ci-reconcile.py`, `platform/scripts/test_ajrly_ci_reconcile.py`, and `platform/platform/gitlab-runners/reconcile.yaml`. Modify `source/.gitlab-ci.yml` and `source/docs/GITLAB_CI.md` to consume/document pinned templates.

**Interfaces:** Dispatcher accepts GitHub event metadata and an idempotency identity based on repository/event/SHA, returns a GitLab pipeline URL, and fails visibly on submission failure. `reconcile(pipelines: list, github_client, gitlab_client) -> dict` publishes terminal status context `GitLab CI / Ajrly` and cancels superseded runs only for the same source ref.

- [ ] Write mocked tests for duplicate dispatch, timeout after submission, stale SHA, distinct refs, superseded runs, GitLab outage recovery, and cancellation before scripts execute. Assert failure/cancelled pipelines never report success.
- [ ] Run focused dispatcher/reconciler tests and confirm meaningful failures.
- [ ] Implement short GitHub-hosted dispatch, bounded retries with duplicate lookup, exact metadata forwarding, and visible pipeline links. Fork events cannot access dispatch secrets automatically.
- [ ] Implement a reconciliation CronJob in `gitlab-runners`, initially every minute, with overlap forbidden and bounded execution. It inspects GitLab pipeline metadata and independent GitHub source metadata; credentials are mounted only into the reconciler, never general application jobs.
- [ ] Run tests and lint the GitHub workflow and GitLab consumer configuration. Commit the task files.

### Task 6: Finish cleanup and publish reviewable revisions

**Files:** Inspect `/Users/nasr/homelab/ajrly-web-api/.github/workflows/homelab-image.yml` and `/Users/nasr/homelab/github-runner-smoke/.github/workflows/runner-smoke.yml`; update `/Users/nasr/homelab/docs/operations/github-runner-cleanup-2026-10-11.md` and affected CI runbooks.

**Interfaces:** Publication records source/template/platform/Vault commit IDs and pinned cross-repository references. Existing OpenClaw changes and worker05 CPU/memory edits remain untouched.

- [ ] Inventory remaining obsolete GitHub runner references and remote workflow state; remove obsolete runner callers within the authorized cleanup scope while preserving repository history and unrelated application logic.
- [ ] Complete dormant ARC App definition deletion only after the browser-required confirmation at action time; retain unrelated GitHub Apps.
- [ ] Run source/secret scans, appropriate existing tests, and `git diff --check` in every changed repo. Review staged diffs for unrelated edits before each commit.
- [ ] Push review branches to required GitHub/GitLab remotes and create/attach review PRs where supported. Do not merge unrelated bases or enable an incomplete bridge. Record exact published template revisions.

### Task 7: Activate and prove the full path

**Files:** Update the runner runbook, cleanup report, and resource profiles only when measurements justify changes.

**Interfaces:** Acceptance evidence records GitHub SHA, GitLab pipeline URL, job pod identities, observed parallelism, resource use, and cleanup result. Re-enable GitHub Actions when the published dispatch workflow and GitLab credentials are ready.

- [ ] Deploy the pinned runner pool and reconciler. Verify managers and jobs are in `gitlab-runners`, aggregate concurrency is 20, namespace quota is effective, and existing production workloads stay healthy.
- [ ] Run 20 independent lightweight smoke jobs, observe simultaneous scheduling where capacity permits, then submit an additional job and verify the 20-job ceiling. Confirm no blanket serialization.
- [ ] Run a real Ajrly MR pipeline; verify exact source SHA, app change detection, service readiness, remote cache behavior, GitHub status/link, and parallel checks. Measure build peaks and adjust profiles only within documented bounds.
- [ ] Run successful, failing, cancelled, timed-out, and manager-interrupted smoke cases. After the documented cleanup window, assert no corresponding runner-owned pods or temporary secrets remain. Simulate a transient reconciler outage and verify status recovery.
- [ ] Test network isolation and forged/untrusted source events; verify protected publication credentials remain inaccessible. Run a trusted disposable image build, Harbor gate, and cleanup check.
- [ ] Perform one final independent review and address material findings. Record tests, revisions, outstanding browser confirmation if any, and limitations accurately; do not claim completion until the actual MR path and cleanup checks pass.

## Self-review

The tasks cover source integrity, template reuse, runner capacity, resource and
network isolation, credentials, dispatch/status recovery, historical cleanup,
and live acceptance. Review Focus cases are assigned to Tasks 1, 4, 5, and 7.
Provisioning and deployment follow published template revisions; enabling the
GitHub bridge follows successful runner smoke tests. No task assumes 20 large
builds fit the host or grants trust solely from the GitLab coordination ref.
