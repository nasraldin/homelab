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
