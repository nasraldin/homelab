# Repos JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tab-separated `repos.conf` with a flat `repos.json` map and teach `clone-labs.sh` to read it via `jq`.

**Architecture:** Config becomes a JSON object (`path` → `owner/repo` or full URL). The script validates `jq` + file presence + top-level object type, then streams `path<TAB>spec` pairs into the existing clone/pull loop. Docs and Makefile help strings are updated; `repos.conf` is deleted.

**Tech Stack:** bash, jq, git

**Spec:** `docs/superpowers/specs/2026-07-22-repos-json-design.md`

## Global Constraints

- Flat JSON object map only (no array-of-objects schema).
- Default file: `repos.json` at repo root; override via `HOMELAB_REPOS_CONF`.
- Parser: `jq` required; fail fast with `brew install jq` hint if missing.
- Reject non-object top-level JSON with an explicit error.
- Values: `owner/repo`, or full `https://` / `git@` URLs (unchanged URL resolution).
- No dual-format support; delete `repos.conf`.
- Clone/pull behavior unchanged (`--pull` = `git pull --ff-only`).

## File map

| File                       | Role                                  |
| -------------------------- | ------------------------------------- |
| `repos.json`               | Source of truth for sibling labs      |
| `clone-labs.sh`            | Load JSON via jq; clone/pull loop     |
| `tests/clone-labs-json.sh` | Fixture-based parse/validation checks |
| `README.md`, `Makefile`    | User-facing references                |
| `repos.conf`               | Delete                                |

---

### Task 1: Add `repos.json` and parse/validation tests

**Files:**

- Create: `repos.json`
- Create: `tests/clone-labs-json.sh`
- Delete: (none yet — delete `repos.conf` in Task 3 after script cutover)

**Interfaces:**

- Consumes: none
- Produces: `repos.json` shape `{ "<rel-path>": "<owner/repo|url>", ... }`; test helper asserts jq extraction emits `path\tspec` lines

- [ ] **Step 1: Write the failing test script**

Create `tests/clone-labs-json.sh`:

```bash
#!/usr/bin/env bash
# Fixture tests for repos.json shape + jq extraction used by clone-labs.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0

assert_eq() {
  local name="$1" got="$2" want="$3"
  if [[ "$got" != "$want" ]]; then
    echo "FAIL: $name" >&2
    echo "  got:  $got" >&2
    echo "  want: $want" >&2
    FAIL=1
  else
    echo "ok: $name"
  fi
}

# --- fixture: valid map ---
FIX="$(mktemp)"
trap 'rm -f "$FIX"' EXIT
cat >"$FIX" <<'EOF'
{
  "ansible-lab": "nasraldin/ansible-lab",
  "homebrew/homebrew-tools": "nasraldin/homebrew-tools"
}
EOF

if ! command -v jq >/dev/null 2>&1; then
  echo "FAIL: jq is required for these tests" >&2
  exit 1
fi

# type must be object
type="$(jq -r 'type' "$FIX")"
assert_eq "fixture type is object" "$type" "object"

# extraction format used by clone-labs.sh
got="$(jq -r 'to_entries[] | "\(.key)\t\(.value)"' "$FIX" | paste -sd'|' -)"
want=$'ansible-lab\tnasraldin/ansible-lab|homebrew/homebrew-tools\tnasraldin/homebrew-tools'
assert_eq "jq emits path\\tspec pairs" "$got" "$want"

# --- fixture: array rejected ---
cat >"$FIX" <<'EOF'
[{"path":"x","repo":"y"}]
EOF
type="$(jq -r 'type' "$FIX")"
assert_eq "array type detected" "$type" "array"

# --- real repos.json (must exist after Task 1 Step 3; this check runs in Step 4) ---
if [[ -f "$ROOT/repos.json" ]]; then
  rtype="$(jq -r 'type' "$ROOT/repos.json")"
  assert_eq "repos.json is object" "$rtype" "object"
  # must include known keys
  has_opshub="$(jq -r 'has("opshub")' "$ROOT/repos.json")"
  assert_eq "repos.json has opshub" "$has_opshub" "true"
  count="$(jq -r 'keys | length' "$ROOT/repos.json")"
  if [[ "$count" -lt 1 ]]; then
    echo "FAIL: repos.json has no keys" >&2
    FAIL=1
  else
    echo "ok: repos.json key count=$count"
  fi
else
  echo "FAIL: repos.json missing at $ROOT/repos.json" >&2
  FAIL=1
fi

[[ "$FAIL" -eq 0 ]]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash tests/clone-labs-json.sh`

Expected: FAIL with `repos.json missing` (and/or script not executable yet is fine if invoked via `bash`).

- [ ] **Step 3: Create `repos.json`**

Create `repos.json` at repo root with exactly:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `bash tests/clone-labs-json.sh`

Expected: all `ok:` lines; exit 0.

- [ ] **Step 5: Commit**

```bash
git add repos.json tests/clone-labs-json.sh
git commit -m "$(cat <<'EOF'
Add repos.json and fixture tests for jq extraction.

EOF
)"
```

---

### Task 2: Teach `clone-labs.sh` to read JSON via jq

**Files:**

- Modify: `clone-labs.sh`
- Test: `tests/clone-labs-json.sh` (unchanged; manual smoke for script errors)

**Interfaces:**

- Consumes: `repos.json` / `$HOMELAB_REPOS_CONF` as JSON object
- Produces: same clone/skip/pull counters and CLI flags as before

- [ ] **Step 1: Update header + default CONF path**

Replace the top of `clone-labs.sh` so comments and default path point at JSON:

```bash
#!/usr/bin/env bash
# Clone (or update) all sibling lab repos listed in repos.json.
#
#   ./clone-labs.sh              # clone missing only
#   ./clone-labs.sh --pull       # clone missing + ff-only pull existing
#   ./clone-labs.sh --protocol ssh|https
#
# Add future labs by adding a key/value in repos.json (see that file).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${HOMELAB_REPOS_CONF:-$ROOT/repos.json}"
PROTOCOL="${HOMELAB_GIT_PROTOCOL:-}"
DO_PULL=0
```

Keep the existing `usage` and argument-parsing blocks unchanged.

- [ ] **Step 2: Add jq + JSON-object validation after the file-exists check**

Immediately after the existing `if [[ ! -f "$CONF" ]]; then ... fi` block, insert:

```bash
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required to read $CONF" >&2
  echo "Install: brew install jq" >&2
  exit 1
fi

conf_type="$(jq -r 'type' "$CONF" 2>/dev/null || true)"
if [[ "$conf_type" != "object" ]]; then
  echo "ERROR: $CONF must be a JSON object (path → repo), got: ${conf_type:-invalid JSON}" >&2
  exit 1
fi
```

Leave protocol selection and `resolve_url` unchanged.

- [ ] **Step 3: Replace the loop input source**

Keep the `while IFS=$'\t' read -r path spec` loop body the same, but change the process substitution at the bottom from grepping a text file to:

```bash
done < <(jq -r 'to_entries[] | "\(.key)\t\(.value)"' "$CONF")
```

Also remove the now-unused comment-skip branch reliance on `#` lines (JSON has no comments). Optional cleanup inside the loop: keep the `[[ -z "$path" || "$path" =~ ^# ]]` continue — harmless — or simplify to `[[ -z "$path" ]] && continue`. Prefer simplify to:

```bash
  [[ -z "$path" ]] && continue
```

- [ ] **Step 4: Smoke-test validation errors**

Run (from repo root):

```bash
# missing jq message path: only if you temporarily hide jq — skip if awkward
HOMELAB_REPOS_CONF="$(mktemp)" bash -c '
  echo "[1,2]" > "$HOMELAB_REPOS_CONF"
  ./clone-labs.sh; ec=$?
  rm -f "$HOMELAB_REPOS_CONF"
  exit $ec
'
```

Expected: stderr contains `must be a JSON object`; exit non-zero.

Then:

```bash
./clone-labs.sh
```

Expected: processes all keys from `repos.json` (clone or skip); no `path but no repo` warnings; summary line with `failed=0` (unless a real network/git failure).

- [ ] **Step 5: Commit**

```bash
git add clone-labs.sh
git commit -m "$(cat <<'EOF'
Read sibling repo list from repos.json via jq.

EOF
)"
```

---

### Task 3: Remove `repos.conf` and update docs

**Files:**

- Delete: `repos.conf`
- Modify: `README.md` (clone section ~lines 26–34)
- Modify: `Makefile` (help line for `make clone`)

**Interfaces:**

- Consumes: Task 2 script defaults to `repos.json`
- Produces: docs/help that only mention `repos.json`

- [ ] **Step 1: Update README clone section**

Replace the clone instructions block with:

````markdown
## Clone all labs (fresh machine)

```bash
git clone git@github.com:nasraldin/homelab.git ~/homelab
cd ~/homelab
./clone-labs.sh              # clone everything in repos.json
./clone-labs.sh --pull       # also fast-forward update existing clones
./clone-labs.sh --protocol https
```

Add a future lab: one entry in [`repos.json`](repos.json) (`"local/path": "owner/repo"`),
then re-run `./clone-labs.sh`. Nested paths like `homebrew/homebrew-tools` are supported.
Requires [`jq`](https://jqlang.org/) (`brew install jq`).
````

(Ensure nested fences are valid Markdown — use indented code or adjust if the outer fence conflicts; prefer matching existing README fence style.)

- [ ] **Step 2: Update Makefile help**

Change:

```make
	@echo "  make clone           Clone all labs from repos.conf (missing only)"
```

to:

```make
	@echo "  make clone           Clone all labs from repos.json (missing only)"
```

- [ ] **Step 3: Delete `repos.conf`**

```bash
git rm repos.conf
```

- [ ] **Step 4: Grep for leftover references**

Run: `rg 'repos\.conf' --glob '!docs/superpowers/**'`

Expected: no matches outside historical specs/plans (those may still mention `.conf` as the problem being solved).

- [ ] **Step 5: Re-run parse tests + help smoke**

```bash
bash tests/clone-labs-json.sh
make help | grep repos.json
./clone-labs.sh -h | head -5
```

Expected: tests pass; help mentions `repos.json`; usage header mentions `repos.json`.

- [ ] **Step 6: Commit**

```bash
git add README.md Makefile
git add -u repos.conf
git commit -m "$(cat <<'EOF'
Drop repos.conf; document repos.json for clone-labs.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement                          | Task                                     |
| ----------------------------------------- | ---------------------------------------- |
| Flat path→repo JSON map                   | Task 1                                   |
| File `repos.json`; delete `repos.conf`    | Tasks 1, 3                               |
| `jq` required + brew hint                 | Task 2                                   |
| Reject non-object top-level               | Task 2                                   |
| `HOMELAB_REPOS_CONF` override             | Task 2 (keep env name, new default path) |
| Existing clone/pull/`--protocol` behavior | Task 2                                   |
| README / Makefile updates                 | Task 3                                   |
| Nested paths                              | Task 1 data + existing mkdir -p          |

## Self-review notes

- No dual-format transition (per spec).
- Per-repo branch overrides out of scope.
- `paste` in the test is macOS/BSD-compatible with `paste -sd'|' -`.
