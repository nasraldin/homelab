# Placeholders in these docs

These pages are written so students can copy commands without inheriting **my** LAN. Anything that would identify a private network or a real credential is replaced with a safe example.

I’m [Nasr Aldin](https://nasraldin.com) — if you see my name in footers or credits, it links here on purpose.

| Placeholder | Meaning | You should use |
| ----------- | ------- | -------------- |
| `192.168.1.10` | Proxmox host LAN IP | Your static LAN IP |
| `192.168.1.1` | Default gateway | Your router |
| `192.168.1.0/24` | Homelab LAN CIDR | Your subnet |
| `pve01.lab.example.com` | Internal node FQDN | Your lab DNS name |
| `homelab.example.com` | Public UI hostname (Tunnel) | Your Cloudflare hostname |
| `kube-api.lab.example.com` | Kubernetes API VIP name | Your cluster API DNS |
| `<ADMIN_USER>` | Non-root admin account | Your username |
| `<SECRET>` / `PVEAPIToken=…=<SECRET>` | API token secret | Value from a password manager — **never commit** |
| `config.env` / `secrets.env` | Local env files | Copy from `*.example` files in each lab |

## Rules

1. **Never commit** real passwords, API tokens, kubeconfigs, or Cloudflare tunnel tokens.
2. Prefer **example / `.example` files** in Git; keep real values in gitignored env files or a password manager.
3. Treat any command that prints secrets (for example Argo CD’s initial admin password) as **local-only**.
4. Hardware names in the build story (disk models, mini-PC SKU) are a **reference build** — adapt to your kit.

## Related

- [Platform tooling](../platform-tooling.md) — what belongs in Git vs a secrets store
- [Supply chain & policies](../security/supply-chain-and-policies.md)
