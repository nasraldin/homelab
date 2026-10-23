# Ajrly GitHub source and GitLab Kubernetes CI

## Approved direction

GitHub remains the authoritative Ajrly source repository. GitLab executes CI on
the homelab Kubernetes cluster. The user approved concurrent job slots rather
than 10–20 permanently running runner managers. The objective is to start
independent jobs from one MR promptly, with a maximum of 20 concurrent jobs.
Ten slots are the baseline capacity target; this does not reserve ten idle
build pods or guarantee capacity for ten large builds.

All runner managers and CI job pods use the namespace `gitlab-runners`.
Reusable Ajrly templates live under the root directory `ajrly/` in
`pipeline-templates`. Existing templates and unrelated local work are preserved.

## Source and pipeline bridge

Use a small GitHub-hosted Actions dispatch workflow for push, pull request,
and manual events. It only submits work to GitLab; application checks, builds,
and tests execute in Kubernetes. GitHub self-hosted runners and ARC are not
reintroduced. Re-enable Actions only when this bridge is ready to publish.

Create a GitLab CI coordination project in the existing `homelab` group named
`ajrly-platform-ci`. It stores orchestration configuration, not the authoritative
application source. Its pipeline includes an immutable revision of the Ajrly
templates. Each run receives the GitHub repository, exact source SHA, source
ref, event type, and PR target SHA/ref. Jobs fetch and verify that exact source
commit, including the PR ref where needed. Do not substitute a moving branch
head. A thin GitLab configuration in Ajrly documents the reusable entry point.

Use dedicated, narrowly scoped credentials for dispatch and source/status
access, stored through the existing Vault/Infisical conventions. Do not copy
the broad personal GitHub CLI token into CI. Trusted pipeline configuration
comes from the templates project; untrusted PR content cannot select arbitrary
templates or receive publication credentials. Fork PRs fail closed unless
explicitly approved for an unprivileged run by a maintainer.

Report a stable GitHub commit status with a link to the GitLab pipeline for
pending, success, failure, and cancellation. Reconcile terminal status even
when a job fails before its script runs. Superseded pipelines for the same
source ref are cancelled without affecting other refs. Release and publication
operations are restricted to verified trusted source events; a protected
coordination branch alone does not establish source trust.

## Runner execution and capacity

Deploy a small fixed manager pool using GitLab Runner's Kubernetes executor.
Set the aggregate job concurrency to 20 across the pool, rather than setting
20 on every manager. Managers request negligible resources compared with
build jobs. Job pods scale with ready CI work and disappear when work ends;
manager CPU autoscaling is unnecessary for this workload.

Use separate resource profiles for lightweight checks, Node builds, integration
tests, and image builds. Each profile defines CPU, memory, ephemeral storage,
helper resources, and service-container resources. Set requests so Kubernetes
can schedule safely, and limits so jobs cannot exhaust shared infrastructure.
Restrict configurable resource overrides to documented upper bounds.

Remove the blanket Ajrly CI resource group that currently serializes jobs.
Retain serialization only for operations that mutate shared release state.
Use dependencies and change detection to avoid running irrelevant app jobs.
Heavy jobs can queue when their resource requests exceed available capacity;
20 slots are a concurrency ceiling, not a promise of 20 simultaneous heavy
builds. Measure one complete MR pipeline before tuning requests further.

The observed physical host has about 91 GiB usable RAM and 24 GiB available;
existing VM assignments already exceed physical RAM. Do not increase VM memory
or create additional worker VMs as part of this change. Use worker capacity
already present and protect production/database workloads through scheduling
and namespace resource quotas. Control-plane nodes are excluded from CI jobs.

## Namespace, isolation, and cleanup

Define namespace-scoped runner RBAC. Job service accounts have no Kubernetes
API permissions or mounted API tokens. Do not permit arbitrary namespace,
service-account, privileged-mode, host-path, or node-selector overrides.
Provide Cilium network policy for GitLab, GitHub, registries, DNS, remote cache,
and explicitly required quality services, while denying unrelated application
and database access.

Integration databases and Redis run as containers in the job pod, with
localhost connections and disposable storage. Image builds use a per-job
rootless BuildKit service, subject to a live compatibility check on Talos;
there is no host Docker socket or privileged Docker daemon.

Use executor cleanup for pods and temporary secrets, finite job timeouts,
bounded pod termination grace periods, and supported active deadlines. Add
monitoring for jobs remaining after completion. Any recovery cleanup must
identify runner-owned terminal or expired resources and must never remove an
active job solely because of age. Cache is external and artifacts are retained
according to GitLab policy; no per-job persistent volume survives completion.

## Reusable template layout

Organize `pipeline-templates/ajrly/` into:

- `pipeline.yml`: reusable pipeline entry point and stage/dependency wiring.
- `common/`: exact source checkout, tool versions, cache, resource profiles,
  and source-event trust checks.
- `checks/`: lint, formatting, type checking, and changeset validation.
- `tests/`: tooling, packages, application tests, and disposable integrations.
- `build/`: application and package builds.
- `security/`: secret, dependency, filesystem, and image checks.
- `quality/`: scoped Sonar analysis.
- `images/`: rootless image builds, Harbor scan gates, and publication.
- `release/`: explicitly enabled trusted release operations.
- `README.md`: consumer variables, credentials, profiles, and examples.

Templates reuse the monorepo's existing CI scripts rather than duplicating
application logic. Pin tool versions and template includes. Extend the existing
template preflight catalog with consumer fixtures that exercise Ajrly's merged
pipeline, trusted/untrusted rules, job dependencies, and resource profiles.

## Delivery and validation

Preserve the cleanup commits and unrelated dirty files across all repositories.
Publish changes through reviewable branches, then activate the live replacement
only with configuration matching those branches. Record exact revisions and
live verification results. Finish the remaining obsolete local runner references
and dormant ARC App definitions with the required browser confirmation.

Validation must include GitLab CI lint with expanded jobs, template fixture
checks, rendered Kubernetes/Helm configuration, and live smoke jobs. Run a real
Ajrly MR pipeline and verify its exact checkout SHA, parallel scheduling,
GitHub terminal status, and per-job services. Verify successful, failed,
cancelled, and timed-out jobs leave no runner-owned pods or temporary secrets.
Exercise a burst of lightweight jobs to verify the aggregate 20-job ceiling,
and verify heavy jobs queue safely rather than exhausting memory. Test an
untrusted event cannot obtain protected credentials or publish an image.

## Failure handling

Dispatch failure fails the GitHub bridge visibly. Source SHA mismatch fails
before executing application code. GitLab or Kubernetes outages leave an
actionable pipeline link/status; reconciliation closes stale pending statuses
after service recovery. Capacity exhaustion queues jobs without weakening
requests or bypassing quotas. BuildKit compatibility failures block image
publication while leaving ordinary checks usable. Cleanup failures alert with
resource identities and retain evidence for repair.
