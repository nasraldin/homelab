#!/usr/bin/env bash
# Copy sibling lab docs/ trees into docs/labs/<repo>/ for MkDocs build.
#
# Local (labs cloned next to this repo under ~/homelab/):
#   ./scripts/collect-lab-docs.sh
#
# CI (repos checked out under external/):
#   HOMELAB_EXTERNAL_DIR=external ./scripts/collect-lab-docs.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="${HOMELAB_LABS_CONF:-$ROOT/scripts/labs.conf}"
DOCS_LABS="$ROOT/docs/labs"
EXTERNAL="${HOMELAB_EXTERNAL_DIR:-$ROOT/external}"
# Sibling lab clones live next to this workspace root
HOMELAB_ROOT="${HOMELAB_ROOT:-$ROOT}"

resolve_lab_root() {
  local lab="$1"
  if [[ -d "$EXTERNAL/$lab" ]]; then
    printf '%s' "$EXTERNAL/$lab"
    return 0
  fi
  if [[ -d "$HOMELAB_ROOT/$lab" ]]; then
    printf '%s' "$HOMELAB_ROOT/$lab"
    return 0
  fi
  return 1
}

rm -rf "$DOCS_LABS"
mkdir -p "$DOCS_LABS"

missing=0
collected=0

while IFS= read -r lab || [[ -n "${lab:-}" ]]; do
  lab="${lab//$'\r'/}"
  lab="$(echo "$lab" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$lab" || "$lab" =~ ^# ]] && continue

  if ! lab_root="$(resolve_lab_root "$lab")"; then
    echo "WARN: lab not found (skipped): $lab" >&2
    missing=$((missing + 1))
    continue
  fi

  if [[ ! -d "$lab_root/docs" ]]; then
    echo "WARN: no docs/ in $lab (skipped)" >&2
    missing=$((missing + 1))
    continue
  fi

  mkdir -p "$DOCS_LABS/$lab"
  /bin/cp -R "$lab_root/docs/." "$DOCS_LABS/$lab/"
  echo "collected: $lab ← $lab_root/docs/"
  collected=$((collected + 1))
done < <(grep -v '^[[:space:]]*$' "$CONF" || true)

echo
echo "collect-lab-docs: collected=$collected missing=$missing"
# Platform docs alone are enough for a valid site build
if [[ "$missing" -gt 0 ]]; then
  echo "::warning::Some public lab repos were missing locally; site still builds platform docs." >&2
fi
