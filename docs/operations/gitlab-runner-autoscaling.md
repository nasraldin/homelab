# GitLab Runner autoscaling (fleeting) — core

Day-one CI scale uses **one** manager VM `runner-01` (VMID **117**, `.15`,
**2c / 4G**) with GitLab **`docker-autoscaler`** + **fleeting-plugin-proxmox**.

**Removed:** static fat `runner-02`.

## Capacity model

| Knob | Start value |
| ---- | ----------- |
| `idle_count` | ≈ 4 |
| `max_instances` | sized for ~40 jobs with free node RAM |
| `capacity_per_instance` | 2 |
| Worker template | ≈ 2c / 4G / 40G ephemeral VMs |

The manager does **not** run 40 concurrent jobs itself.

## Ansible scaffold

Role: `ansible-lab/roles/gitlab_runner_fleeting/`  
Writes `/etc/gitlab-runner/FLEETING.md` + example TOML snippet.

Wire Proxmox API credentials from Vault before enabling the plugin live.

## Related

- [gitlab.md](gitlab.md) · [guest-vmid-map.md](guest-vmid-map.md)
- Design: [core-container-hosts](../superpowers/specs/2026-07-25-core-container-hosts-design.md)
