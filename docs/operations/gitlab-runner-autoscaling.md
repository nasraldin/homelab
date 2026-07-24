# GitLab Runner autoscaling (next CI wave)

**Core stage status:** `runner-02` stays a **static** fat VM (`concurrent=40`).
That does **not** free Proxmox resources when idle. This page is the follow-up
checklist — do not block Vault/AIStor/GitLab on it.

## Target design

```text
runner-02  →  small manager (docker-autoscaler)
                 └─ fleeting-plugin-proxmox
                      └─ ephemeral VMs from a CI template
                           idle_count / idle_time / max_instances
```

- Keep job tag `runner-02` (pipelines unchanged)
- Keep `runner-01` as static light / untagged pool
- After kubeadm, prefer Kubernetes executor + HPA for most CI

## Implementation checklist (follow-up)

1. TF: CI template VM (Debian + Docker + qemu-guest-agent)
2. Resize `runner-02` to manager size (e.g. 2c/4G)
3. Ansible: install fleeting Proxmox plugin; switch executor to `docker-autoscaler`
4. Proxmox pool + dedicated API user (permissions per plugin docs)
5. Store Proxmox API creds in Vault `infra/proxmox/fleeting`
6. Tune `max_instances`, `idle_count=0` for scale-to-zero when quiet

### Tuning knobs

| Knob                    | Role                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `idle_count`            | Warm instances waiting (0 = scale to zero when quiet)      |
| `idle_time`             | How long idle workers live before destroy                  |
| `max_instances`         | Hard capacity ceiling (replaces “concurrent=40” on one VM) |
| `capacity_per_instance` | Jobs per ephemeral VM (often 1–4)                          |

## What we will not do

- Docker Machine autoscaler (deprecated)
- Autoscaling by only tweaking `concurrent` on a 32 GiB VM
- Building a custom fleeting plugin (use maintained Proxmox plugin)

## Related

- [gitlab.md](gitlab.md) — current static runner layout
- [vault.md](vault.md) — where fleeting Proxmox API creds will live
