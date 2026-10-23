# Remove GitHub self-hosted runners implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the GitHub self-hosted Actions runner setup from the six named repositories and the live homelab, with GitLab as the CI destination.

**Architecture:** Remove the sources that can recreate runners before retiring their live resources. Separate runner credentials and runtime configuration from shared Harbor, SonarQube, registry, and GitLab services.

**Tech Stack:** GitLab CI, GitHub Actions/ARC, Helm, Kubernetes/Cilium, Talos, Proxmox/Terraform, Infisical.

**Spec:** User request in this chat, 2026-10-11: deep cleanup from repositories and the live cluster; use GitLab runners.

## Global constraints

- Preserve existing local changes: Ajrly Cloudflare files; cluster infra `docs/ci-worker.md` and `cluster.auto.tfvars`; platform OpenClaw runbook.
- Do not print secret values. Remove runner-specific credentials, preserving shared credentials needed by GitLab.
- Preserve application services and GitLab runner VM 113, documented at 192.168.68.13; verify actual live configuration before use.
- Remove active runner jobs deliberately, checking their GitHub status first. Three runners were busy during the audit.
- Keep Git history; cleanup means no active setup or generated residue, not destructive history rewriting.

## Review focus

- GitLab jobs must cover the checks and deployment gates previously supplied by Actions, or explicitly report migration gaps.
- Deploy jobs, generated manifests, cached charts, and secret bootstraps must not recreate ARC.
- Shared Harbor/SonarQube resources and identities may serve GitLab and must survive unless proven runner-only.
- Worker05 VM 308 may be reusable capacity; do not destroy its VM/disks merely to remove runner software. Remove runner-only runtime/labels/taints after checking other workloads and Terraform state.
- ARC finalizers require running controllers during scale-set deletion; do not remove controllers first or indiscriminately strip finalizers.

### Task 1: Preserve work and establish CI destination

- [ ] Capture Git status/diffs and use isolated cleanup branches/worktrees where appropriate; transfer only intended cleanup edits back for review.
- [ ] Check GitLab project/remotes, runner VM configuration and online status, tags, executor, protected-ref access, and secrets by name only. Current Ajrly checkout has only GitHub origin and no `.gitlab-ci.yml`.
- [ ] Inventory Ajrly workflow responsibilities: CI/API integration, parity checks, packages, security, changesets, image build/scan, SonarQube. Inventory runner-specific variables/secrets and other organization repositories using `ajrly-ci`/`ajrly-build`.

### Task 2: Remove repository setup

- [ ] Platform services: remove `platform/github-runners/`, `platform/image-builders/`, `platform/personal-runners/`, matching `scripts/{github-runners,image-builders,personal-runners}-*`, matching runbooks, and jobs beginning at `.gitlab-ci.yml:952`. Update README, namespace inventory, and `scripts/cilium-verify.sh`.
- [ ] Vault: remove runner-only onboarding scripts, runner bootstrap portions, runner schema/folders, and generation logic in `scripts/generate_local_configs.py`. Inspect `bootstrap_personal_ci.py` before removing it because it also configures shared application services.
- [ ] Infra: remove runner-only `scripts/talos-ci-worker.sh`, pipeline job `talos:ci-worker`, topology/Talos gVisor configuration and documentation. Preserve pre-existing edits and the worker VM unless its retirement is separately selected.
- [ ] Ajrly: replace runner-dependent CI with GitLab configuration; remove `docs/SELF_HOSTED_RUNNERS.md`, `.github/actionlint.yaml`, runner labels, smoke workflow, and obsolete runner-dependent workflows/scripts. Preserve unrelated GitHub repository metadata.
- [ ] Check ajrly-k8s-deployments and lab-home-pve01 for indirect integration and update only affected references; the initial targeted scan found no explicit ARC setup there.
- [ ] Remove runner-only ignored render outputs, chart archives and Python bytecode; verify remaining YAML/shell/Python syntax, CI dependency graphs, `git diff --check`, and references across all six repos.

### Task 3: Retire live runners and credentials

- [ ] Disable obsolete CI triggers/deployment paths; list/cancel or drain the busy GitHub runs, verifying that new jobs cannot start on retired runners.
- [ ] Uninstall scale sets with controllers still running: `ajrly-ci` in `github-runners`, `ajrly-build` in `image-builders`, and `ajrly-platform-{ci,build,integration}` in corresponding `platform-*-runners` namespaces. Verify GitHub runner deregistration and scale-set deletion.
- [ ] Uninstall `arc-controller`, `arc-builder-controller`, `arc-platform-ci`, `arc-platform-build`, and `arc-platform-integration` in `arc-system`.
- [ ] Remove the six dedicated namespaces, runner-owned admission policies/bindings, monitoring/dashboard resources, RBAC, secrets, and the four `actions.github.com` CRDs after confirming no remaining consumers.
- [ ] Remove `gvisor-ci` RuntimeClass and `ci-gvisor-service-routing` CiliumNodeConfig only after verifying no non-runner consumers. Reconcile worker05 Talos runtime/extension settings and labels/taints safely, validating node networking afterward.
- [ ] Remove runner registrations/groups and runner-specific GitHub App installation credentials, GitLab deployment variables, and Infisical folders `/platform/github-runners` and `/platform/personal-runners`; inspect image-builder secret locations too. Delete only proven runner-owned identities and tokens; retain shared service credentials for GitLab.

### Task 4: Verify and deliver

- [ ] `helm list -A` contains no ARC charts; all runner namespaces, pods, CRDs, policies, bindings, RBAC, runtime and node configuration leftovers are absent.
- [ ] GitHub runner APIs for the personal repository and Ajrly organization show no retired runners/scale sets/groups; secret inventories show runner-only credentials removed.
- [ ] Remaining nodes are Ready, Cilium is healthy, shared services remain healthy, and GitLab runner completes a representative job.
- [ ] Run repository checks and a final broad reference/artifact scan; inspect diffs against initial snapshots so unrelated changes remain preserved.
- [ ] Deliver per-repository change summary and live removal evidence; explicitly list any unavailable account/API operations or incomplete GitLab migration checks. Publish cleanup branches/PRs only within authorized scope and attach any created PRs to this chat.

## Audit evidence

2026-10-11: Kubernetes context `homelab-talos` is reachable. Five ARC scale-set releases and five controller releases are deployed. All eight nodes are Ready. Worker05 has `workload=ci` taint/label and `homelab.nasraldin.com/gvisor=true`. Four Actions CRDs, five runner admission policies, `gvisor-ci`, and `ci-gvisor-service-routing` exist. Personal repository runners 726, 730, and 735 were online and busy. No GitLab runner deployment appeared in the live cluster; lab-home-pve01 documents a separate Docker-executor VM. No repository or live cleanup has been performed during this audit.
