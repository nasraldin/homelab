# Dockhand

LXC **VMID 200** · LAN `192.168.68.24` · UI: `https://docker.nasraldin.com` (**Cloudflare Access**)

## Role

Dockhand + Hawser agents manage Docker engines on `docker-01`, `database-01`,
`runner-01`, and Podman on `podman-01` (as supported).

**Do not** expose Docker API on the WAN — only the Dockhand UI through Access.

## Related

- [docker-hosts.md](docker-hosts.md)
- cloudflare-tunnel: `docker.nasraldin.com` ingress + Access app
