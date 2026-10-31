# Pipeline upstream image sync

Prerequisites: Python3, skopeo (`brew install skopeo`), current kubectl access to this homelab, LAN VIP192.168.68.40 reachable, existing private Harbor mirror project.

Preview22 image entries without network or authentication:

    python3 sync.py --dry-run

Sync and verify all entries, automatically authenticating from local artifacts/harbor-admin Kubernetes Secret:

    python3 sync.py --apply

No login/password prompts. Administrator credentials stay in memory and a temporary0600 auth file removed at exit. No OSKeychain or savedDocker login changes. Harbor requests use LANVIP while preserving hostname/SNI and TLS verification. Upstream downloads require Internet. All platforms copied, exact source/destination manifest digests checked. Stops on failure; rerun samecommand. Immutable digest tags ensure idempotence. This does not change CI YAML, build application/customtools outputs, enable privileged builders, delete artifacts, or modify cluster configuration.

images.json is the complete explicit upstream list22entries for this run, excludingPostgreSQL/ArgoCD/cluster/localchat images. Helm4.3.0 is verified official latest stable release and runtime-tested container; earlier4.3.1 claim was incorrect. Snyk's published vendorimage embedsNode26.11.1 and vendorlint imagesPython3.14.8; latest standaloneNode26.12/Python3.15 do not replace those vendor layers. These are recordedexceptions requiring rebuild to satisfy everyembeddedruntime latestpolicy, not silently claimedcompliant. Legacy --init-auth is unnecessary and its savedfile is ignored by apply.

Checks: dryrun22entries and3offline tests pass. The previous scopedrobot version completed an actualAlpinecopy; the new localadminauthentication path has not performed alivefull22imagecopy yet. Eachsource/dest digest rechecked during apply. No fullsync success claimed until it completes.

Runtime verification: linux/amd64 Helm4.3.0, Snyk1.1308.1, ansible-lint26.9.0 and yamllint1.38.0 version commands exit0. The last two image tags are publisher build versions, not installed Python package versions. See runtime-verification.json. Vendor embedded Node/Python remain as documented; no latest-runtime custom rebuild claimed.
