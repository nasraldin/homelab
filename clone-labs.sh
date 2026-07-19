#!/usr/bin/env bash
# Clone (or update) all sibling lab repos listed in repos.conf.
#
#   ./clone-labs.sh              # clone missing only
#   ./clone-labs.sh --pull       # clone missing + ff-only pull existing
#   ./clone-labs.sh --protocol ssh|https
#
# Add future labs by appending a line to repos.conf (see that file).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${HOMELAB_REPOS_CONF:-$ROOT/repos.conf}"
PROTOCOL="${HOMELAB_GIT_PROTOCOL:-}"
DO_PULL=0

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

# Default protocol: ssh if an agent key exists, else https
if [[ -z "$PROTOCOL" ]]; then
  if [[ -n "${SSH_AUTH_SOCK:-}" ]] || [[ -f "$HOME/.ssh/id_ed25519" ]] || [[ -f "$HOME/.ssh/id_rsa" ]]; then
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

  [[ -z "$path" || "$path" =~ ^# ]] && continue
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
done < <(grep -v '^[[:space:]]*$' "$CONF" || true)

echo
echo "clone-labs: cloned=$cloned skipped=$skipped pulled=$pulled failed=$failed (protocol=$PROTOCOL)"
[[ "$failed" -eq 0 ]]
