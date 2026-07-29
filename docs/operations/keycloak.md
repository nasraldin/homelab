# Keycloak

**lab-home-k8s (current):** interim in-cluster under namespace **`apps`** (GitOps).
Long-term preference: Compose on **docker-01** (`.21`) once drained from k8s.

**terraform-lab (alternate):** Compose on docker-01 historically at `.22` with
JDBC → PgCat on `database-01` — [database-01.md](database-01.md).

## Runtime notes

- Behind NPM / Cloudflare: `KC_PROXY_HEADERS=xforwarded` (or equivalent)
- Do not embed Postgres on the Keycloak host when a shared DB exists
- Secrets via InfisicalSecret / bootstrap secrets in `security` / day-0 script

## Related

- [lab-home-inventory.md](lab-home-inventory.md)
- [`lab-home-gitops/docs/namespace-taxonomy.md`](https://github.com/nasraldin/lab-home-gitops/blob/main/docs/namespace-taxonomy.md)
- [service-placement.md](../architecture/service-placement.md)
