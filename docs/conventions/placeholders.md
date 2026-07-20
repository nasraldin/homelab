# Placeholders in this documentation

These docs are written for **students building their own homelab**. Values that
would identify a private network or credential are replaced with safe examples.

| Placeholder | Meaning | Replace with |
| ----------- | ------- | ------------ |
| `192.168.1.10` | Proxmox host LAN IP | Your static LAN IP |
| `192.168.1.1` | Default gateway | Your router |
| `192.168.1.0/24` | Homelab LAN CIDR | Your subnet |
| `pve01.lab.example.com` | Internal node FQDN | Your lab DNS name |
| `homelab.example.com` | Public UI hostname (Tunnel) | Your Cloudflare hostname |
| `kube-api.lab.example.com` | Kubernetes API VIP name | Your cluster API DNS |
| `<ADMIN_USER>` | Non-root admin account | Your username |
| `<SECRET>` / `PVEAPIToken=…=<SECRET>` | API token secret | Value from password manager — **never commit** |
| `config.env` / `secrets.env` | Local env files | Copy from `*.example` files in each lab |

## Rules

1. **Never commit** real passwords, API tokens, kubeconfigs, or Cloudflare tunnel tokens.
2. Prefer **example / `.example` files** in Git; keep real values in gitignored env files or a password manager.
3. Treat any command that prints secrets (e.g. Argo CD initial admin password) as **local-only**.
4. Hardware names (disk models, mini-PC SKUs) in the build story are **reference examples** — adapt to your kit.

## Related

- [Platform tooling](../platform-tooling.md) — what belongs in Git vs secrets store
- [Supply chain & policies](../security/supply-chain-and-policies.md)
