#!/usr/bin/env bash
# Clone (or update) all sibling lab repos listed in repos.json.
#
#   ./clone-labs.sh              # clone missing only
#   ./clone-labs.sh --pull       # clone missing + ff-only pull existing
#   ./clone-labs.sh --protocol ssh|https
#
# Protocol: --protocol / HOMELAB_GIT_PROTOCOL override auto-detect.
# Auto-detect probes git@github.com over SSH; falls back to https if
# SSH keys exist but are not authorized for GitHub (common when the
# agent only holds lab/host keys). Both protocols are always supported.
#
# Add future labs by adding a key/value in repos.json (see that file).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${HOMELAB_REPOS_CONF:-$ROOT/repos.json}"
PROTOCOL="${HOMELAB_GIT_PROTOCOL:-}"
DO_PULL=0

# True when an SSH key can authenticate to GitHub (BatchMode: no prompts).
# GitHub often exits 1 even on success, so match the greeting, not exit code.
github_ssh_ok() {
  local out
  out="$(ssh -o BatchMode=yes -o ConnectTimeout=5 -T git@github.com 2>&1 || true)"
  [[ "$out" == *"successfully authenticated"* || "$out" == *"Hi "* ]]
}

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --pull|-u) DO_PULL=1; shift ;;
    --protocol)
      PROTOCOL="${2:?}"
      shift 2
      ;;
    --protocol=*)
      PROTOCOL="${1#*=}"
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage 1
      ;;
  esac
done

if [[ ! -f "$CONF" ]]; then
  echo "ERROR: repos list not found: $CONF" >&2
  exit 1
fi

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

# Default protocol: ssh only if GitHub accepts a key; else https
if [[ -z "$PROTOCOL" ]]; then
  if github_ssh_ok; then
    PROTOCOL=ssh
  else
    PROTOCOL=https
  fi
fi

case "$PROTOCOL" in
  ssh|https) ;;
  *)
    echo "ERROR: --protocol must be ssh or https (got: $PROTOCOL)" >&2
    exit 1
    ;;
esac

resolve_url() {
  local spec="$1"
  if [[ "$spec" =~ ^(https://|git@) ]]; then
    printf '%s' "$spec"
    return
  fi
  # owner/repo[.git]
  spec="${spec%.git}"
  if [[ "$PROTOCOL" == ssh ]]; then
    printf 'git@github.com:%s.git' "$spec"
  else
    printf 'https://github.com/%s.git' "$spec"
  fi
}

cloned=0
skipped=0
pulled=0
failed=0

while IFS=$'\t' read -r path spec || [[ -n "${path:-}" ]]; do
  # trim CR and spaces
  path="${path//$'\r'/}"
  spec="${spec//$'\r'/}"
  path="$(echo "$path" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  spec="$(echo "$spec" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

  [[ -z "$path" ]] && continue
  if [[ -z "$spec" ]]; then
    echo "WARN: skipping line with path but no repo: $path" >&2
    continue
  fi

  dest="$ROOT/$path"
  url="$(resolve_url "$spec")"

  if [[ -d "$dest/.git" ]]; then
    if [[ "$DO_PULL" -eq 1 ]]; then
      echo "==> pull $path"
      if git -C "$dest" pull --ff-only; then
        pulled=$((pulled + 1))
      else
        echo "FAIL: pull $path (non-ff or network)" >&2
        failed=$((failed + 1))
      fi
    else
      echo "-- skip $path (already cloned; use --pull to update)"
      skipped=$((skipped + 1))
    fi
    continue
  fi

  if [[ -e "$dest" ]]; then
    echo "FAIL: $path exists but is not a git repo" >&2
    failed=$((failed + 1))
    continue
  fi

  echo "==> clone $path ← $url"
  mkdir -p "$(dirname "$dest")"
  if git clone "$url" "$dest"; then
    cloned=$((cloned + 1))
  else
    echo "FAIL: clone $path" >&2
    failed=$((failed + 1))
  fi
done < <(jq -r 'to_entries[] | "\(.key)\t\(.value)"' "$CONF")

echo
echo "clone-labs: cloned=$cloned skipped=$skipped pulled=$pulled failed=$failed (protocol=$PROTOCOL)"
[[ "$failed" -eq 0 ]]
