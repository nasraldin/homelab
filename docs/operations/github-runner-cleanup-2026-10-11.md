# GitHub runner cleanup and GitLab CI migration — October 11–12, 2026

## Live cleanup

Removed five ARC scale sets and their controllers, six dedicated namespaces,
four Actions CRDs, five runner admission policies/bindings, runner monitoring,
Grafana dashboard, gVisor RuntimeClass and runner Cilium node configuration.
ARC completed cleanup before controller removal; no finalizers were forcibly
stripped. Both custom GitHub runner groups and App installations were removed.
The user approved deletion of both obsolete ARC App definitions; GitHub shows
both deletions queued and the definitions absent from their settings lists.
Unrelated Apps remain intact.

Ajrly GitHub Actions is disabled, registered self-hosted runners are zero, and
obsolete runs were canceled. The runner-smoke repository is archived with Actions
disabled; its dedicated Sonar project and analysis-token references were removed.
Six ARC GitLab variables, two Infisical folders, and ignored local ARC credentials
were deleted. Configuration generation no longer recreates them.

Worker05/VM308 uses standard Talos with qemu guest agent, no gVisor, apps workload
role and user.max_user_namespaces=0. VM/disks were retained. The user's separate
8-vCPU/16-GiB configuration edit is included in MR16 with explicit approval. All eight nodes are Ready. Shared
CNPG priority and database maintenance/verification jobs remain intact.

## GitLab replacement

Source stays in `nasraldin/ajrly-platform` on GitHub. Coordinator project7 is
[homelab/ajrly-platform-ci](https://gitlab.nasraldin.com/homelab/ajrly-platform-ci).
Reusable templates live exclusively under `ajrly/` in pipeline-templates, pinned
by the source and coordinator to `78950685bb2554159587cfbd49b1a4c8b98744cf`.

Four Kubernetes managers admit eight build jobs and twelve lightweight checks,
with at most twenty active ephemeral job pods in `gitlab-runners`. Heavy work
waits in GitLab before pod creation. Jobs request resources on eligible app
workers 01, 02, and 05, with no fixed node assignment. Builds request 500m CPU
and 1920Mi memory (4Gi limit), plus a 64Mi helper; checks request 100m CPU and 256Mi memory (1Gi limit).
Managers and helpers have separate bounded requests.

Isolated mixed-capacity pipelines 395 and 408 passed 21/21 each. The recorded peak was
20 Running job pods, zero Pending job pods, and one job queued in GitLab;
placement was nine jobs on worker05, six on worker02, and five on worker01.
All job pods subsequently cleaned up. Quota permits a terminating wave as well
as active jobs, avoiding pod-creation failures during turnover. The active
concurrency ceiling remains twenty. No worker count or VM memory was increased.

Jobs have no Kubernetes API token, privileged mode, host socket or host paths.
Cilium allows required package, scanner, and Google Fonts endpoints and denies
unrelated databases and Kubernetes API access. Existing Docker runners remain
for homelab infrastructure CI.

A dedicated CI App has source/PR read and commit-status write access only on the
Ajrly repository. Its key is mounted only in reconciliation. Ordinary jobs use
short-lived read-only installation credentials. The external dispatch identity
has Developer access to coordinator7 and Reporter access to templates1, with
no homelab group/infrastructure membership. Seven scoped credentials are stored in
Infisical under `/platform/gitlab-runners` and verified by readback.

Reconciliation uses independently verified current heads for cancellation,
frozen PR target identity, bounded update snapshots, compressed protected state
below9,000 characters, and retryable terminal status delivery. Its successful
live credential verification reported errors0. Namespace-only cleanup verifies
GitLab project/job identity before removing terminal pods, and cancels verified
orphans after deadline expiry or a missing manager. API outages retain resources.

Public Node CI installs use `https://registry.npmjs.org` with concurrency eight,
independent of the shared Verdaccio publication registry. This avoids overlapping
cold workspace installs exhausting the registry. The shared registry retains its
bounded 3Gi container allocation for other clients.

## Published review requests

- [Ajrly source PR167](https://github.com/nasraldin/ajrly-platform/pull/167), source
  revision `bf36e7db0ff75adeffe6057201d42336cff17cdd`, rebased on current dev.
- [Templates GitLab MR1](https://gitlab.nasraldin.com/homelab/pipeline-templates/-/merge_requests/1).
- [Platform runtime MR66](https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/merge_requests/66),
  revision `3ba7629`, rebased on main `2cd85a5` in isolated
  `/Users/nasr/.codex/tmp/ajrly-ci-migration/platform-runtime`.
  The user's active platform checkout and unrelated OpenClaw/artifact work were preserved.
- [Vault MR22](https://gitlab.nasraldin.com/homelab/vault/-/merge_requests/22), revision767362a.
- [Infrastructure MR16](https://gitlab.nasraldin.com/homelab/homelab-cluster-infra/-/merge_requests/16), revision `e1bf8e4`.
- [Deployments MR7](https://gitlab.nasraldin.com/homelab/ajrly-k8s-deployments/-/merge_requests/7), revision964972e.
- [Legacy web-api PR22](https://github.com/ajrly/web-api/pull/22), revision2bac56a.

The unnecessary GitHub templates PR1 was closed and our unmerged GitHub branch
was removed; the GitLab templates MR is the sole review destination.

No review requests were merged. The archived smoke repository's local cleanup
was not pushed to the archived remote. Lab-home-pve01 required no tracked changes.

## Acceptance evidence and remaining work

- Burst pipeline344 passed21/21: observed20 concurrent jobs plus one waiting;
  maximum22 pods included two managers. Job pods were subsequently removed.
- Service job5051 passed pinned Node26.11.1, pnpm12.10.1, PostgreSQL SELECT1 and
  Redis PONG. No infrastructure credential inheritance was observed.
- Lifecycle pipeline366 passed success/isolation and demonstrated expected
  script failure, timeout and cancellation. All four job pods and temporary
  registry secrets were removed. Kubernetes API and foreign database connections
  were denied while required GitLab access succeeded.
- Manager-interruption pipeline375/job5948 reached canceled state after owner
  removal; its orphan pod was removed and the manager replaced.
- 22 template tests, 22 reconciliation/cleanup tests, and eight runner resource
  tests pass. Template pipeline 410 passed all 45 validation/lint jobs. Latest
  platform, Vault, and deployment pipelines passed. Infrastructure validation
  is pending investigation of the Talos Image Factory TLS timeout.
- All 36 live PostgreSQL integration tests pass after correcting the concurrency
  contract assertion and closing two test pools. Security patch regression tests
  pass. Rust dependency updates compile with the locked Cargo dependencies.
- Real MR pipeline 400 exposed a clean-install test dependency, missing empty
  changeset, Google Fonts egress, and quota turnover failures. Fixes are published; real MR pipeline 412 passed all 19 jobs against source SHA
  `bf36e7db0ff75adeffe6057201d42336cff17cdd`. GitHub reports its CI status as success. Historical failed runs
  remain visible; no checks are weakened to manufacture success.
- Pipeline 403 passed eighteen checks before Admin hit its 4Gi container limit
  (Prometheus recorded 4094Mi). A Next shared-config regression now bounds CI
  workers to two and disables cold build filesystem cache snapshots, with all
  172 package tests passing. The native TS compiler receives GOMAXPROCS=2 and
  GOMEMLIMIT=1GiB. API coverage finished successfully, and manager rollout was applied after the run drained.
- Build pod requests now account for the helper: 1920Mi +64Mi gives a 1984Mi pod.
  Soft host anti-affinity spreads build pods and preserves replacement headroom.
  Live rollout and runner verification passed; post-rollout capacity pipeline408 passed21/21.
- Two npm vulnerabilities without fixed upstream releases have committed source
  backports, lockfile patch hashes, and regression coverage. OSV has narrow
  patched-version exceptions expiring November 12, 2026. Two Rust dependencies
  were upgraded to fixed versions.

Core pull-request CI acceptance is complete: pipeline 412 passed 19/19, GitHub
received success for the exact head, and terminal job pods were removed. GitHub Actions stays disabled
until the bridge reaches the source default branch. Remote cache credentials and
trusted publication acceptance remain incomplete. Rootless BuildKit cannot start
with current Talos user namespace restrictions; image publication is explicitly
gated off. No privileged workaround was introduced and unremediated security findings remain visible.

Git checkout uses HTTP/1.1 and bounded retries only for recognized transport
failures. Redacted diagnostics preserve authentication errors without exposing
credentials; exact source verification remains unchanged. Mutable project-level
template revision overrides were removed, preserving the compiled helper pin.
The Proxmox host rebooted during validation; all eight nodes and the API VIP
recovered, managers resumed, and terminal job pods cleaned up before pipeline412.
The final helper reservation (47.5Mi observed peak, 64Mi request with 512Mi
limit) is deployed. Capacity pipeline 417 passed 21/21 with the final configuration;
all job pods subsequently cleaned up. Runtime pipeline 419 passed 18/18 after
rebasing onto the updated main branch. Infrastructure pipeline 421 initially
hit a transient TLS handshake timeout at Talos Image Factory; the retry reproduced the timeout and a dedicated runner network probe is running.
