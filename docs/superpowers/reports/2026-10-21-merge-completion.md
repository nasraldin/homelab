# Merge completion — 2026-10-21

All six requested reviews are merged, together with the small follow-up that fixes protected-main test isolation. All current automatic main checks passed. No failed jobs remain in the verified pipelines.

| Review | Merge commit |
| --- | --- |
| [vault !28](https://gitlab.ajrly.app/homelab/vault/-/merge_requests/28) | `38e44b2ac5c51f1ab42cefcc77781e33187b7390` |
| [pipeline-templates !6](https://gitlab.ajrly.app/homelab/pipeline-templates/-/merge_requests/6) | `cc232e7a7d7bd7947cc9c80bd1e3b997667bee75` |
| [ajrly-k8s-deployments !10](https://gitlab.ajrly.app/homelab/ajrly-k8s-deployments/-/merge_requests/10) | `d27ec716b229ab4d4fdb83cc1711846b7a629acb` |
| [homelab-cluster-infra !18](https://gitlab.ajrly.app/homelab/homelab-cluster-infra/-/merge_requests/18) | `417bfb8300eb8bffec9aff790e615d6b86701b96` |
| [homelab-platform-services !105](https://gitlab.ajrly.app/homelab/homelab-platform-services/-/merge_requests/105) | `92855c8d39215b80bb1b8cfc2c2716808833efce` |
| [homelab-platform-services (test isolation follow-up) !106](https://gitlab.ajrly.app/homelab/homelab-platform-services/-/merge_requests/106) | `d1be49d9d26ad412a0ea76697362347d52d99a18` |
| [Foundation PR18](https://github.com/nasraldin/lab-home-pve01/pull/18) | `493b8a718d4ed84cd465a9dab8f0816663d4f1f5` |

## Final pipeline checks

- [Pipeline 764](https://gitlab.ajrly.app/homelab/pipeline-templates/-/pipelines/764): passed. No failed or active jobs.
- [Pipeline 765](https://gitlab.ajrly.app/homelab/vault/-/pipelines/765): passed. No failed or active jobs.
- [Pipeline 766](https://gitlab.ajrly.app/homelab/ajrly-k8s-deployments/-/pipelines/766): automatic checks passed; normal manual gates remain. No failed or active jobs.
- [Pipeline 767](https://gitlab.ajrly.app/homelab/homelab-cluster-infra/-/pipelines/767): automatic checks passed; normal manual gates remain. No failed or active jobs.
- [Pipeline 774](https://gitlab.ajrly.app/homelab/homelab-platform-services/-/pipelines/774): automatic checks passed; normal manual gates remain. No failed or active jobs.
- [Foundation main validation](https://github.com/nasraldin/lab-home-pve01/actions/runs/39489711262): passed.

## Resolution and verification

Platform MR105 required combining the newer runner-capacity changes on main with the domain migration. The combined branch passed 382 local tests. CI then exposed a partial-download bug in the kubectl installer; downloads now resume within bounded attempts, verify the official checksum, and install atomically. The resulting suite passed 383 tests.

Main-only protected variables exposed an unrelated environment-isolation gap in a mocked cache lifecycle test. MR106 clears only that test environment; production root-credential rejection remains unchanged. All 383 tests also passed with sentinel protected variables present. Pipeline 772 was superseded by the verified successful automatic checks in pipeline 774.

Post-merge live verification: 8/8 nodes Ready, all active pods ready, 3/3 PostgreSQL clusters healthy, both runner pools 2/2, and 34/34 public/local URL probes passed. No infrastructure bootstrap, upgrade, or manual deployment stage was triggered merely to merge code; the previously applied live rollout remains healthy.
