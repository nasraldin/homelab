# Deploy or Rebuild the Homelab in the Correct Order

This is the canonical execution order for the repositories under
`~/homelab`. Run each layer only after the previous layer passes its checks.
Each repository owns one boundary; do not reproduce its work manually in the
Proxmox UI.

## Ownership and order

```text
Official Proxmox installer
        ↓
proxmox-bootstrap     host identity, APT, SSH, ZFS tuning, firewall, updates
        ↓
cloudflare-tunnel     remote Proxmox UI + infra01 SSH through Access
        ↓
terraform-lab         storage, images, VM hardware, cloud-init, backups
        ↓
ansible-lab           non-k8s guest OS and applications
        ↓
acceptance tests      DNS, UI, SSH, backups
        ↓
TP-Link DHCP cutover  clients receive AdGuard as DNS
```

Kubernetes follows later: Terraform creates Debian VMs (q35 + OVMF + VirtIO SCSI —
[vm-best-practices](../architecture/vm-best-practices.md)), kubeadm bootstraps the
cluster, and Argo CD owns in-cluster applications.

## 0. Control-machine prerequisites

```bash
cd ~/homelab
./clone-labs.sh --pull

ssh-add ~/.ssh/pve01
ssh root@192.168.68.13 hostname
```

Local secret files are intentionally gitignored:

| Repository          | Create locally                                    | Contains                                |
| ------------------- | ------------------------------------------------- | --------------------------------------- |
| `proxmox-bootstrap` | `config.env` from `config.env.example`            | Node identity and notification settings |
| `cloudflare-tunnel` | `config.env`; token exported for one command only | Cloudflare account and Access allowlist |
| `terraform-lab`     | `credentials.auto.tfvars` from its example        | Proxmox API token                       |
| `ansible-lab`       | `secrets.yml` from `secrets.example.yml`          | AdGuard and Technitium admin passwords  |

Never copy these files into documentation, plans, commits, or terminal logs.
The tunnel bootstrap rejects a token stored in `config.env`.

## 1. Bootstrap and verify Proxmox

Skip the install itself when the node already exists.

```bash
cd ~/homelab/proxmox-bootstrap
cp -n config.env.example config.env

./mac/bootstrap.sh --check
./mac/bootstrap.sh
./mac/bootstrap.sh --remote --check
./mac/bootstrap.sh --remote

./mac/enable-firewall.sh --check
./mac/enable-firewall.sh
./mac/install-update-automation.sh --check
./mac/install-update-automation.sh

# Final drift proof
./mac/bootstrap.sh --remote --check
./mac/enable-firewall.sh --check
```

Do not continue if SSH, `pveversion`, ZFS, or the API check fails.

## 2. Configure remote UI access

This publishes the Proxmox UI through Cloudflare Tunnel + Access. The same
configuration declares the `infra01` SSH route, which becomes healthy after
Terraform and Ansible create `192.168.68.12`.

```bash
cd ~/homelab/cloudflare-tunnel
cp -n config.env.example config.env
export CLOUDFLARE_API_TOKEN='retrieve-from-password-manager'

./mac/bootstrap.sh --check
./mac/bootstrap.sh --yes
bash tests/test_cloudflare_api.sh
bash tests/test_ingress.sh
unset CLOUDFLARE_API_TOKEN
```

Verify `https://homelab.nasraldin.com` from cellular and confirm Access prompts
before the Proxmox login page.

## 3. Create infrastructure with Terraform

Review the plan before applying it. A saved plan prevents applying something
different from what was reviewed.

```bash
cd ~/homelab/terraform-lab
cp -n credentials.auto.tfvars.example credentials.auto.tfvars

terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
rm -f tfplan

terraform output
ssh nasr@192.168.68.10 hostname
ssh nasr@192.168.68.11 hostname
ssh nasr@192.168.68.12 hostname
```

Important:

- `terraform.tfvars` is the desired infrastructure inventory.
- `credentials.auto.tfvars`, state, `.terraform/`, and `tfplan` are local only.
- Never run `terraform destroy` as a routine cleanup command.
- Confirm destructive plans explicitly, especially disk/ZFS changes.
- **GitLab CI (later):** selective guest apply via `TF_TARGET_GUESTS` — never
  shrink `var.vms` in CI. Contract:
  [gitlab-infra-pipeline.md](gitlab-infra-pipeline.md).
  Local same scripts: `TF_TARGET_GUESTS=infra01 TF_ACTION=plan ./scripts/ci-run.sh`

## 4. Configure guests with Ansible

Terraform must finish and both SSH checks must pass first.

```bash
cd ~/homelab/ansible-lab
cp -n secrets.example.yml secrets.yml
# Replace both placeholder passwords before running.

ansible-inventory --graph
ansible all -m ping
ansible-playbook playbooks/dns.yml --syntax-check -e @secrets.yml
ansible-playbook playbooks/dns.yml -e @secrets.yml

# Idempotence proof: both hosts must report changed=0.
ansible-playbook playbooks/dns.yml -e @secrets.yml

ansible-playbook playbooks/infra.yml --syntax-check
ansible-playbook playbooks/infra.yml
ansible-playbook playbooks/infra.yml # expect changed=0
```

The playbook uses application APIs for AdGuard and Technitium policy. Do not
replace their generated configuration files directly. Permanent UI changes must
also be represented in Ansible or the next run will intentionally restore the
declared policy.

Finish the remote operator path after `infra01` is configured:

```bash
cd ~/homelab/cloudflare-tunnel
export CLOUDFLARE_API_TOKEN='retrieve-from-password-manager'
./mac/bootstrap.sh --yes
unset CLOUDFLARE_API_TOKEN
./mac/install-ssh-client.sh

ssh infra01 'hostname; sudo -n true'
ssh infra01-admin 'ssh pve01 "hostname -f; pveversion"'
```

The first SSH command opens the Cloudflare Access email-OTP flow. See
[infra01 remote access](infra01-remote-access.md).

## 5. DNS acceptance

```bash
dig @192.168.68.11 pve01.lab.nasraldin.com +short
# 192.168.68.13

dig @192.168.68.10 pve01.lab.nasraldin.com +short
# 192.168.68.13

dig @192.168.68.10 example.com +short
# one or more public addresses

dig @192.168.68.10 doubleclick.net +short
# 0.0.0.0 (blocked)

dig @fe80::ff:fe00:10%en0 doubleclick.net +short
# 0.0.0.0 (blocked over IPv6)

curl -I http://192.168.68.10:3000/
curl -I http://192.168.68.11:5380/
```

UIs are LAN-only:

- AdGuard Home: `http://192.168.68.10:3000`
- Technitium DNS: `http://192.168.68.11:5380`

## 6. Cut DHCP clients over to AdGuard

Only after all acceptance checks pass, follow
[dns-dhcp-cutover.md](dns-dhcp-cutover.md) and
[lan-dns-resilience.md](lan-dns-resilience.md). Keep the DHCP address pool and
gateway unchanged. Set:

- **Primary DNS** = `192.168.68.10` (AdGuard)
- **Secondary DNS** = `1.1.1.1` (required — LAN stays online if AdGuard is down)

After clients renew their leases:

```bash
dig pve01.lab.nasraldin.com +short
# 192.168.68.13
```

Confirm client requests appear in the AdGuard query log when AdGuard is healthy.

Before Terraform `-replace` of DNS VMs: `ansible-lab/scripts/dns-failover-public.sh`.
After `dns.yml`: `ansible-lab/scripts/dns-restore-adguard.sh`.

## Routine reruns

| Change                             | Correct command                                             |
| ---------------------------------- | ----------------------------------------------------------- |
| Proxmox host drift                 | `proxmox-bootstrap/mac/bootstrap.sh --remote --check`       |
| VM CPU, RAM, disk, image, or IP    | Review and apply `terraform-lab`                            |
| DNS software or filtering policy   | Run `ansible-lab/playbooks/dns.yml`                         |
| Infra01 OS or operator tools       | Run `ansible-lab/playbooks/infra.yml`                       |
| Cloudflare Tunnel or Access policy | Run `cloudflare-tunnel/mac/bootstrap.sh --check` then apply |
| Router DHCP DNS                    | Follow the cutover runbook manually                         |

Always validate, review the diff/plan, apply, and run the matching acceptance
checks. A successful command without its acceptance check is not completion.
