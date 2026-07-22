# Design: JSON-based sibling repo list

**Date:** 2026-07-22  
**Status:** Approved for implementation planning  
**Scope:** Replace tab-separated `repos.conf` with `repos.json`; update `clone-labs.sh` and docs.

## Problem

`clone-labs.sh` splits config lines on tabs only (`IFS=$'\t'`). Space-separated edits look valid but are skipped with `path but no repo`. Tabs are easy to lose in editors and diffs.

## Decision

- **Format:** Flat JSON object map — local path → repo spec.
- **File:** `repos.json` only. Remove `repos.conf`.
- **Parser:** `jq` (fail fast with install hint if missing).

## Schema

```json
{
  "ansible-lab": "nasraldin/ansible-lab",
  "camunda-lab": "nasraldin/camunda-lab",
  "cloudflare-tunnel": "nasraldin/cloudflare-tunnel",
  "docker-lab": "nasraldin/docker-lab",
  "proxmox-bootstrap": "nasraldin/proxmox-bootstrap",
  "terraform-lab": "nasraldin/terraform-lab",
  "homebrew/homebrew-tools": "nasraldin/homebrew-tools",
  "opshub": "nasraldin/opshub"
}
```

**Rules:**

- Keys: relative paths under the homelab root (nested paths allowed).
- Values: `owner/repo`, or full `https://…` / `git@…` URLs (same as today).
- No comments in JSON; document usage in README / script header.
- Invalid JSON or empty file → non-zero exit with a clear error.

## Script changes (`clone-labs.sh`)

1. Default config path: `$ROOT/repos.json` (env override remains `HOMELAB_REPOS_CONF`).
2. Require `jq` on `PATH`; if missing, print `brew install jq` (or equivalent) and exit 1.
3. Emit path/spec pairs via:
   ```bash
   jq -r 'to_entries[] | "\(.key)\t\(.value)"' "$CONF"
   ```
4. Keep the existing clone / skip / `--pull` / `--protocol` loop unchanged after pairs are produced.
5. Reject non-object top-level JSON (e.g. array) with an explicit error.

## Docs / tooling

Update all references from `repos.conf` → `repos.json`:

- `README.md`
- `Makefile` help text
- `docs/community-labs.md`, `docs/operations/deploy-and-rebuild.md`, and any other mentions

Delete `repos.conf` from the repo.

## Out of scope

- Changing pull semantics (still `git pull --ff-only`).
- Per-repo branch or protocol overrides in JSON.
- Supporting both `.conf` and `.json` during a transition period.

## Success criteria

- Adding a lab is editing one JSON key/value (no tabs).
- `./clone-labs.sh` clones all mapped repos that are missing.
- `./clone-labs.sh --pull` updates existing clones with the same behavior as today.
- Missing `jq` or invalid JSON fails with a clear message.
