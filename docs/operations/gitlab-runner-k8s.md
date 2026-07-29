# GitLab Runner (in-cluster)

Kubernetes executor runner managed by Argo in namespace **`gitops`** (with KEDA).
Host runner on `runner-01` (`.16`) remains separate.

Manifests: `lab-home-gitops/platform/gitlab-runner/`.

## Target config

| Item | Value |
| ---- | ----- |
| Namespace | `gitops` |
| Chart | `gitlab-runner` → GitLab Helm |
| `gitlabUrl` / runner `url` | `http://192.168.68.15` (LAN IP — not public Tunnel) |
| Token Secret | `gitlab-runner-token` (keys expected by chart) |
| DNS | `hostAliases` → `gitlab.lab` / `gitlab.nasraldin.com` → `.15` |
| KEDA | `ScaledObject` `minReplicaCount: 1` (keep at least one runner) |

## Why these fixes

| Problem | Fix |
| ------- | --- |
| Public `https://gitlab.nasraldin.com` 530 / Tunnel flaps during jobs | Register and run against **LAN IP** `.15` |
| Pod cannot resolve `gitlab.lab` (cluster DNS ≠ AdGuard) | `hostAliases` on the runner Deployment values |
| Runner scales to zero and misses jobs | KEDA `minReplicaCount: 1` |
| Token missing / wrong keys | Secret `gitlab-runner-token` + InfisicalSecret mapping |

## Infisical seed (still pending)

Universal-auth identity + seed so `InfisicalSecret` can sync the runner token is
**not** assumed complete. Until then:

1. Mint/register token on GitLab (or use host `runner-01` path).
2. Create `gitlab-runner-token` in `gitops` manually, **or** finish
   `infisical-seed.yml` + `kubectl -n security` universal-auth Secret, then let
   the InfisicalSecret reconcile.

`hostAPI` for InfisicalSecrets must be **`http://192.168.68.25:8090`** after the
Infisical LXC cutover (not old infra-01 `.14`).

## Verify

```bash
kubectl -n gitops get deploy,scaledobject,secret | rg -i 'gitlab|runner|keda'
kubectl -n gitops get pods -l app=gitlab-runner
# On GitLab: runner online; jobs pick k8s executor
```

## Related

- Taxonomy: [`lab-home-gitops/docs/namespace-taxonomy.md`](https://github.com/nasraldin/lab-home-gitops/blob/main/docs/namespace-taxonomy.md)
- Host fleeting notes: [gitlab-runner-autoscaling.md](gitlab-runner-autoscaling.md)
- Omnibus ops: [gitlab.md](gitlab.md)
