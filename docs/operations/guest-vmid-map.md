# Core guest inventory (VMID, IP, boot order)

Proxmox VMIDs follow Layer-1 foundation order. **LAN IPs keep historical last
octets** where possible (VMID ≠ IP by design). Hardware defaults:
[vm-best-practices.md](../architecture/vm-best-practices.md).

Canonical design:
[2026-07-25-core-container-hosts-design.md](../superpowers/specs/2026-07-25-core-container-hosts-design.md).

Source of truth: `terraform-lab/terraform.tfvars` (`vms` / `containers` maps).

## Inventory

| VMID | Guest           | LAN   | Startup order | Role                                                         |
| ---- | --------------- | ----- | ------------- | ------------------------------------------------------------ |
| 110  | `adguard-01`    | `.10` | 1 (+15 s)     | Recursive DNS / filtering                                    |
| 111  | `technitium-01` | `.11` | 2 (+10 s)     | Authoritative `lab.nasraldin.com`                            |
| 112  | `infra01`       | `.12` | 3             | Ops / management — [remote access](infra01-remote-access.md) |
| 113  | `vault-01`      | `.18` | 5             | HashiCorp Vault OSS (Raft, Transit auto-unseal)              |
| 114  | `vault-seal`    | `.19` | 4 (+20 s)     | Vault Transit seal helper (Shamir)                           |
| 115  | `aistor-01`     | `.17` | 6             | AIStor Free (shared S3)                                      |
| 116  | `gitlab-01`     | `.14` | 7             | GitLab CE Omnibus (**6c / 16G**)                             |
| 117  | `runner-01`     | `.15` | 8             | Fleeting autoscaler **manager** only                         |
| 118  | `database-01`   | `.21` | 9             | Central Postgres+PgCat+PgAdmin, Redis, MariaDB               |
| 119  | `docker-01`     | `.22` | 10            | NPM, Infisical, Keycloak, it-tools, mailpit                  |
| 120  | `podman-01`     | `.23` | 11            | Podman + Caddy (practice)                                    |
| 121  | `monitoring-01` | `.25` | 12            | Prometheus, Grafana, Loki, Alloy                             |
| 122  | `sonarqube-01`  | `.26` | 13            | SonarQube → PgCat; `sonar.nasraldin.com`                     |
| 123  | `elastic-01`    | `.27` | 14            | Elasticsearch + Kibana; `kibana.nasraldin.com`               |
| 200  | `dockhand`      | `.24` | 15            | Dockhand LXC; `docker.nasraldin.com` + Access                |

**Removed from inventory:** `infisical-01` (Infisical lives on `docker-01`), `runner-02` (replaced by fleeting workers).

Startup order is independent of VMID (`vault-seal` boots **before** `vault-01`).
All managed VMs use `on_boot = true`. DNS guests start first so the LAN has a
resolver before app VMs.

## Sizing (start)

| Guest                   | Cores | RAM | Disk    |
| ----------------------- | ----- | --- | ------- |
| DNS / Vault / Dockhand  | 1     | 2G  | 20–50G  |
| `gitlab-01`             | 6     | 16G | 120G    |
| `runner-01` manager     | 2     | 4G  | 40G     |
| `database-01`           | 6     | 24G | 200G    |
| `docker-01`             | 8     | 32G | 120G    |
| `monitoring-01`         | 4     | 16G | 100G    |
| `sonarqube-01`          | 4     | 16G | 80G     |
| `elastic-01`            | 8     | 32G | 200G    |
| `podman-01`             | 4     | 8G  | 80G     |
| `infra01` / `aistor-01` | 4     | 8G  | 80–300G |

Homelab **oversubscription** on single-node `pve01` is intentional — guests do not peak together.

## Recreate-safe Ansible (after disk wipe)

| Concern         | Where                                                                |
| --------------- | -------------------------------------------------------------------- |
| DNS restore     | `playbooks/dns.yml` + [lan-dns-resilience.md](lan-dns-resilience.md) |
| Central DB      | `playbooks/database.yml` · [database-01.md](database-01.md)          |
| Docker apps     | `playbooks/docker-hosts.yml` · [docker-hosts.md](docker-hosts.md)    |
| Infisical       | on `docker-01` · [infisical.md](infisical.md)                        |
| Sonar / Elastic | [sonarqube.md](sonarqube.md) · [elastic.md](elastic.md)              |
| Monitoring      | `playbooks/monitoring.yml` · [monitoring.md](monitoring.md)          |
| Runner fleeting | [gitlab-runner-autoscaling.md](gitlab-runner-autoscaling.md)         |
| Vault unseal    | [vault.md](vault.md)                                                 |
| AIStor / GitLab | [object-storage.md](object-storage.md) · [gitlab.md](gitlab.md)      |

## Related

- [lab-refresh-runbook.md](lab-refresh-runbook.md)
- [deploy-and-rebuild.md](deploy-and-rebuild.md)
- [docker-hosts.md](docker-hosts.md)
- [dockhand.md](dockhand.md)
