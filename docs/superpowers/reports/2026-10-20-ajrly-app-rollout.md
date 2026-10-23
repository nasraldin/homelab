# ajrly.app rollout — final server and CI status

The live server/cluster migration is applied. All six review pipelines passed. No MR/PR was merged automatically. This report supersedes the provisional CLI-agent reports, including the incorrect initial Dify marketplace blocker.

| Change | Review | Verified pipeline |
| --- | --- | --- |
| Platform routing, AI, application DB integrations | [Platform MR105](https://gitlab.ajrly.app/homelab/homelab-platform-services/-/merge_requests/105) | [760 passed](https://gitlab.ajrly.app/homelab/homelab-platform-services/-/pipelines/760) |
| Shared PostgreSQL namespace and Dify concurrency budget | [Database MR10](https://gitlab.ajrly.app/homelab/ajrly-k8s-deployments/-/merge_requests/10) | [758 passed](https://gitlab.ajrly.app/homelab/ajrly-k8s-deployments/-/pipelines/758) |
| Canonical Infisical paths and CI credentials | [Vault MR28](https://gitlab.ajrly.app/homelab/vault/-/merge_requests/28) | [752 passed](https://gitlab.ajrly.app/homelab/vault/-/pipelines/752) |
| Canonical CI artifact endpoints | [Templates MR6](https://gitlab.ajrly.app/homelab/pipeline-templates/-/merge_requests/6) | [753 passed](https://gitlab.ajrly.app/homelab/pipeline-templates/-/pipelines/753) |
| Private node registry DNS | [Infrastructure MR18](https://gitlab.ajrly.app/homelab/homelab-cluster-infra/-/merge_requests/18) | [756 passed](https://gitlab.ajrly.app/homelab/homelab-cluster-infra/-/pipelines/756) |
| Foundation URLs, Proxmox identity and VM runner | [Foundation PR18](https://github.com/nasraldin/lab-home-pve01/pull/18) | [Validation passed](https://github.com/nasraldin/lab-home-pve01/actions/runs/39442745176) |

## Applied live

- Canonical public application URLs use ajrly.app; wildcard TLS, scoped DNS/Tunnel/Access token, publisher and legacy compatibility aliases are configured. Autensa and administrative applications require Cloudflare email Access. The publisher's disposable-host test passed publication, public TLS, automatic deletion and unrelated-rule preservation.
- All active PostgreSQL clusters run in postgres: shared ajrly-postgres (3/3), n8n-postgres (1/1) and harbor-postgres (1/1). Database credentials were retained, consumers use private Service DNS, and backups use separate archive prefixes. Source PVC/disk recovery copies are retained; stale sources cannot be switched back after target writes without synchronization.
- Hermes and Dify sandbox now run in ai. The retired ai-hermes and ai-sandbox namespaces were removed. Hermes's offline copy matched all 687 regular-file hashes and modes; its original disk is Released/Retain and the consistent archive remains protected locally.
- Hermes dashboard and provider credentials work. Authenticated inference passed in Hermes, OpenClaw and Dify. Dify's official OpenRouter package was verified by checksum and signature; a working default model was selected.
- Autensa's authenticated internal gateway bridge passed status/model/session calls. Paperclip's pinned reaper bug was fixed with a guarded patch. Sandbox Python and JavaScript both executed successfully with empty error output; networking stays disabled and pod-selected egress is denied.
- Proxmox short node name remains pve01; native FQDN, DNS search domain and certificate SAN are now pve01.lab.ajrly.app. The existing Proxmox CA is unchanged. Native address is private DNS-only https://pve01.lab.ajrly.app:8006/; public https://homelab.ajrly.app remains behind email Access. The targeted source playbook was applied successfully and native verified TLS returned HTTP200.
- Secret responsibilities are organized under /ai/*, /postgres/* and /platform/cloudflare, with protected pipeline variables and read-back verification. Existing passwords were not rotated. Compatibility paths remain during review.
- Kubernetes and VM runners pulled canonical images successfully. Private TLS/SigV4 cache upload/download/checksum/cleanup passed; all eight Talos nodes remain Ready with private artifact DNS. Loki/Tempo storage and monitoring use cluster-local TLS S3.

## Validation

Source/target database per-table comparison, SQL role/TLS isolation, 64-client/3200-transaction load, primary failover, independent PITR restoration, backups, telemetry logs/traces/metrics and persistence checks passed. Normal shared DB, n8n, artifacts and AI deployment scripts were exercised against live state. Harbor manifest and blob checksums passed through both aliases. CI ran unit/regression, render/schema, lint and security checks.

All 34 public and local endpoint probes pass through this Mac's normal resolver, with expected application or authentication responses and successful TLS verification. After the user added lab to NextDNS Excluded Domains, autensa.lab, dify.lab, hermes.lab and paperclip.lab resolve to 192.168.68.40 and respond successfully. The new native Proxmox name resolves to 192.168.68.10; https://pve01.lab.ajrly.app:8006/ returns HTTP200 with its existing Proxmox CA verified. No hosts-file fallback or privileged Mac change was needed.

All five GitLab pipelines and the GitHub validation check were rechecked successfully after the DNS fix. All six review requests remain open and unmerged. The rollout and final Mac-local verification are complete.

## Follow-up: memory optimization (2026-10-20)

The capacity/memory optimization rollout that followed is documented separately in [2026-10-20-memory-optimization.md](2026-10-20-memory-optimization.md). It includes the latest review pipeline IDs for the same open MRs/PR (platform MR105 → 763, infrastructure MR18 → 761, foundation PR18 → run 39448718186), the pve01 host and worker VM memory changes, the observability acceptance result (`pass`), and the verification counts. Nothing above was overwritten and no request was merged. (The reviews were subsequently merged on 2026-10-21 in a separate session — see [2026-10-21-merge-completion.md](2026-10-21-merge-completion.md); the capacity report's 2026-10-23 continuation section records the fresh re-verification after the host restarts.)
