# CI registry/cache rollout status — 15 October 2026

This report distinguishes live deployment, feature-branch implementation, measurements, and unfinished acceptance. The contract is NOT complete.

## Latest scope
GitHub remains source owner; GitLab owns CI and reusable templates. Mirror pipeline dependencies only. Exclude PostgreSQL and Argo CD from mirror catalog. No cluster/system image mirror rollout. One current stable version per tool, exact digest pins, no floating latest defaults. Node shared template must be templates/common/node.yml with .node_base, current Node26, all includes/docs/preflight fixtures renamed without node24 aliases. Latest release verification does not prove registry-tag availability or build compatibility.

## Completed and verified
- Original GitHub ARC-to-GitLab migration reviews previously merged and validated. New cache/local-access reviews remain drafts/unmerged.
- Live namespace gitlab-runners: four managers, configured maximum20 jobs (8 heavy,12 checks). Current readback: managers/authority Running, two maintenance jobs Completed, no Pending job pods. This idle sample does not prove scheduling under full load.
- Private Harbor mirror imported117 catalog entries/104 distinct digests before scope correction; this was overbroad. Quota64Gi within existing100Gi PVC. No larger VM/volume. Cleanup not performed yet.
- Private npm installer read access and publish403 verified; registry probe/load fixes deployed without changing credentials. npm.lab and turbo.lab same-origin UI corrections deployed and actual browser hydration checked with no console errors.
- Persistent HTTPS S3 runner cache proven on Kubernetes and Docker executors. Canonical schema2 pnpm store+metadata restores checksum checked and zero-download installs observed; ordinary consumers read-only. Expanded archive caps2Gi each,4Gi combined, pre-extraction header/type/path validation. Platform22 tests and templates93 tests passed independently after integration.
- Platform feature HEAD95402ab; templates feature HEAD11c5f04. Producer schema2/caps integrated locally; exact-version installed-pnpm bootstrap avoids unnecessary download in correct tools image. Not default-branch rollout.
- Short-lived Turbo authority/scoped broker and protocol canaries implemented; actual Turbo CLI cache HIT acceptance still missing. No claim protocol fixture equals Turbo task cache HIT.
- Source PR171 fixes validated through normal hooks. Worker image measured129.9s cold build,7.8s warm,65.3s reversible source edit; startup/health/ready/metrics and graceful shutdown tested with synthetic dependencies, not actual queue throughput.
- Mac local CA trust and portless routes installed/tested. Local chat.lab proxy targets existing LibreChat; npm/Turbo fixed; OpenClaw local BasicAuth enforced. Authenticated sessions/OAuth for every application not exhaustively tested.

## Measured CI
Pipeline517:19/19 success, whole2176s. API1756.548569s plus416.639623s queue, missed1144s target. pnpm restore122.175s,1939reused0download. API Jest798.237s; coverage closure948.543s. Heavy graph15jobs competes for8 heavy slots while12 checkslots handle4jobs; no runner reconfiguration applied.
Pipeline522: API-only workers2, same source/template/tools pins and2CPU/4Gi limit. Success1011.672873s, queue0.652049s. API483 suites/4537tests passed with existing1suite/3DBconditional skips; API Jest380.19s, coverage closure436.919s, restore107.105s,1939reused0download. Below single-job target, but isolated load differs from517; not all improvement attributable to worker count. Turbo tasks0cached. Full two-warm/source-edit acceptance remains unfinished.

## Unfinished work
1. Rename shared Node template and every include/extends/docs/preflight ID/fixture; latest26.12.0 release identified, registry pins and compatible execution required.
2. Upgrade legacy web-api Node24, custom tools Debian base strategy, monorepo/tool pins consistently; rebuild tools, regenerate identity-bound canonical cache if runtime changes, revalidate source installs/builds/native modules. Debian base already installs Node26; cannot replace it by textual version substitution.
3. Verify latest stable Alpine/Python/securitytool/BuildKit releases AND published image manifests. Single version per tool across owning pipeline repos. Remove ArgoCD reusable entry/consumers and PostgreSQL mirror entry; do not delete application PostgreSQL Dockerfile/functionality.
4. Reduce mirror inventory from overbroad117entries to actual pipeline dependencies. Exact root/child-manifest and tag/ref checks needed before delete. Inventory agent reports105mirror roots/563children; extra unknown busybox held. Local chat proxy uses mirrored nginx and must migrate safely or retain until replacement. Cluster has no direct Harbor mirror refs in latest inventory. No registry-wide GC, deletion, or image import during inventory.
5. Persistent internal node hostname source patchca8b968 prepared/tested; live onlyworker05 mapping verified, remaining7not patched. This remains relevant to pipeline kubelet Harbor pulls even though cluster-system mirrors are out of scope. Global mirror defaults stay disabled and should be removed from proposed scope.
6. Performance: repeat bounded workers2 verification under representative load, actual Turbo CLI HIT/TTL/source-edit invalidation, cold+two warm runs, totalqueue/peakmemory evidence; repartition only after aggregate resource budget review, max20 retained.
7. Rootless builder production canary unresolved; publication remains gated. No privileged builder, VM resize or seccomp exception applied.
8. Rebase all final feature branches to fresh source refs, regenerate review descriptions, independent review, push reviewed integrated commits, validate and seek concrete new merge/manualgate authorization. Draft reviews are not deployment completion.
9. Credential incident remediation: machine bootstrap token accidentally retained in a local agent transcript; Kubernetes bootstrap/discovery secret potential stdout exposure. Identified transcript restricted0600, private assessment/rotation plan prepared. CA private-key fields empty; no admin configs printed. Live rotation NOT done. New bootstrap token ID and explicit oldSecret retirement needed; no blind CA rotation. Containment is not remediation.
10. Task-owned resource cleanup/final docs and heartbeat pause only after verified completion.

## Review links
- Templates MR2: https://gitlab.nasraldin.com/homelab/pipeline-templates/-/merge_requests/2
- Runtime MR70: https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/merge_requests/70
- Local access MR71: https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/merge_requests/71
- Vault MR23: https://gitlab.nasraldin.com/homelab/vault/-/merge_requests/23
- Source PR171: https://github.com/nasraldin/ajrly-platform/pull/171
- Foundation PR16: https://github.com/nasraldin/lab-home-pve01/pull/16

## Execution limitations
Cursor/Copilot quota exhausted; native source agent later also reported usage limit. No purchase/spend-limit change authorized or performed. Completed CLI exits were inspected rather than accepted as end-to-end proof. Current active image inventory/consolidation tasks own isolated files. No default merges performed for this new rollout.
