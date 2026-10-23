# CI cache integration — 2026-10-18

Integration is merged. The normal post-merge pipeline633 is running; this report does not claim that repeated full run has completed.

## Merged changes

| Owner | Review | Merge revision |
| --- | --- | --- |
| GitHub source | [PR171](https://github.com/nasraldin/ajrly-platform/pull/171) | `417be5263db8d833e0835c0c5b33ae5ec28843f4` |
| GitHub dispatch repair | [PR172](https://github.com/nasraldin/ajrly-platform/pull/172) | `f645d39c4428526269d66913b7c5cc98bc8e1461` |
| Runtime | [MR70](https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/merge_requests/70) | `ae67b18be352d5c17a5361e2eab4100020bb6463` |
| Authority startup repair | [MR72](https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/merge_requests/72) | `f5ade22b62ca99c771dfdb8c28d2abe8a65de215` |
| Vault mapping | [MR23](https://gitlab.nasraldin.com/homelab/vault/-/merge_requests/23) | `47c68e4177eda753956c4e247e93f296420f5b8d` |
| Docker-runner foundation | [PR16](https://github.com/nasraldin/lab-home-pve01/pull/16) | `84286469994b48937bb6fc399d1832b8c8d102f2` |

GitLab templates MR3 and coordinator MR2 were already merged and were rechecked.

## Pin agreement

- Source `dev`: `f645d39c4428526269d66913b7c5cc98bc8e1461`.
- Both source and coordinator `.gitlab-ci.yml` include template `193bdf294f7335b5079a24a35c775d5f937d83e2`, with matching `AJRLY_TEMPLATES_REF`.
- Coordinator main: `2bb6304a57c41eb6960b8eca824e53f86293666c`.
- Live authority policy accepts the executable coordinator and its immutable template.
- Dependency lockfile, workspace definition and patches are unchanged from the regenerated cache inputs. The existing Node26.12/pnpm12.10.1 canonical identity remains valid.

## Verification

- [Source pipeline625](https://gitlab.nasraldin.com/homelab/ajrly-platform-ci/-/pipelines/625): all19 jobs passed for source revision `a4d63f235d7ad67a0fd5e4afcb756ab671b8e696`, merged through PR171. Earlier failed attempts and bounded targeted retries remain in history.
- [Runtime624](https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/pipelines/624): all21 checks passed.
- [Authority631](https://gitlab.nasraldin.com/homelab/homelab-platform-services/-/pipelines/631): all20 applicable checks passed;340 local tests also passed under Python3.14 and3.15.
- Vault MR613 and post-merge618 passed;34 credential tests passed.
- Foundation:11 tests and Ansible runner playbook syntax passed, with earlier live private-image pull/cache proof.
- Dispatch repair:8 tests passed under both Python versions. The real limited token returned403 for root-owned pipeline variables and200 for its own pipeline; the corrected lookup traversed history without permission expansion.
- [GitHub dispatch39100662505](https://github.com/nasraldin/ajrly-platform/actions/runs/39100662505) succeeded on the real `dev` push after PR172 merged. It automatically created [pipeline633](https://gitlab.nasraldin.com/homelab/ajrly-platform-ci/-/pipelines/633) with the exact new source SHA and push event. Pipeline633 was still running at final readback.

## Integration defects fixed

- Scoped dynamically imported test modules so they neither shadow Python's standard-library `secrets` module nor fail dataclass imports under Python3.14.
- Represent complete matrix job identities as a JSON allowlist, preserving commas inside names.
- Render commissioned authority policy into deployment output and annotate policy/script revisions so redeploys preserve pins and restart when needed.
- Enable socket address reuse to avoid address-in-use restart crashes.
- Raise authority limits from200m CPU/128MiB to1 CPU/256MiB, retaining50m CPU/64MiB requests and existing VMs. One live valid authorization sample improved from13.407s to1.137s; this is not a latency percentile or whole-pipeline speed claim.
- Skip forbidden/deleted history entries in the least-privilege dispatcher; preserve source/event matching and visible authentication/service/submission errors.

Namespace `gitlab-runners`, maximum20 jobs, and publication gates are preserved. No Pending pods were present at final readback. The timer remains paused. The unrelated lab-access MR71 is outside this cache integration.
