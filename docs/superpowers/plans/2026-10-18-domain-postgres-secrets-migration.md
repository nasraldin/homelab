# Homelab domain, database, secrets and AI migration

User authorizes delegated implementation, live changes and verification, then final MRs. Preserve all current data and unrelated work.

Target: public services under ajrly.app; .lab continues locally; private traffic uses service DNS; PostgreSQL resources under postgres; secrets grouped by responsibility; Hermes browser UI and AI integrations functional; Autensa protected by email Access.

## Task ledger
- [x] Confirm cluster access and node health: eight nodes Ready.
- [x] Launch agy database worker (ajrly-k8s-deployments only).
- [x] Launch opencode AI diagnostics worker (read-only).
- [x] Launch agy Vault taxonomy worker (vault only, additive paths).
- [x] Launch agy public-domain worker (platform repo, no live mutation).
- [ ] Inventory existing Cloudflare permissions, zones, tunnels and Access policies.
- [ ] Verify new zone DNS delegation and usable scoped credentials without exposing values.
- [ ] Review worker patches and establish cross-repo consumer contracts.
- [ ] Add new secrets paths before updating consumers; retain legacy paths during transition.
- [ ] Protect Autensa/OpenClaw new hostnames before public exposure.
- [ ] Issue new wildcard cert, verify Ready, then add new gateway/routes and tunnel DNS.
- [ ] Migrate foundation VM public URLs with internal endpoints retained.
- [ ] Verify database backups, restore into postgres, validate data and cut consumers over with rollback available.
- [ ] Repair proven AI faults and deploy supported Hermes Web UI.
- [ ] Verify every local/public route, authentication boundary, app integration and database access.
- [ ] Commit/push final code and open MRs; verify applicable pipelines.

## Release gates
Never delete source databases/PVCs or old secret paths during migration. Keep authenticated services protected throughout; no bypass policies. No credential values in reports, Git, logs or chat. Do not rewrite identity annotations, image registry addresses or TLS backend SNI through blind domain replacement. Database namespace changes require actual restore/data validation, not manifest renaming. Completion requires live evidence and MR/pipeline links; report unverified steps honestly.
