# LibreChat (chat.lab)

Chat UI in namespace **`ai-tools`**, via LiteLLM → Ollama on **llm-01**.

| Item | Value |
| --- | --- |
| URL | http://chat.lab (Cilium LB `192.168.68.105:3080`) |
| GitOps | `lab-home-gitops/apps/librechat` (Helm chart `librechat` 2.0.7 / app `v0.8.7`) |
| Secrets | Infisical `apps` / `prod` / `/librechat` → K8s `librechat-env` |
| Registration | **Disabled** (`ALLOW_REGISTRATION=false`) |

## Admin user (first install)

LibreChat has no `CREATE_FIRST_USER` env. Official path with registration off is
[`npm run create-user`](https://www.librechat.ai/docs/configuration/authentication).

Lab wiring:

1. Store email/password in `lab-home-k8s/ansible/secrets.yml` as
   `vault_librechat_admin_email` / `vault_librechat_admin_password` (gitignored).
2. Seed Infisical (`playbooks/infisical-seed.yml` / `seed-map.yaml` keys
   `LIBRECHAT_ADMIN_EMAIL` / `LIBRECHAT_ADMIN_PASSWORD`).
3. Day-0: `scripts/apply-bootstrap-secrets.sh` also writes those keys into
   `librechat-env`.
4. Sync hook Job `librechat-seed-admin` runs `create-user` (idempotent if the
   user already exists). First registered/created user is **ADMIN**.

`LIBRECHAT_ADMIN_*` are synced via InfisicalSecret `includeAllSecrets` (not the
`template.data` remaps — this operator’s `{{ .KEY }}` renders `{value /path}`).

Do **not** commit plaintext passwords. Rotate via secrets.yml → Infisical seed →
secret sync → re-run seed Job (or `kubectl create job --from=...` after wipe).

## Checks

```bash
# Registration rejected
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://chat.lab/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@example.com","password":"x","name":"x","username":"x","confirm_password":"x"}'
# expect non-2xx (403/400)

# Login (use values from Infisical / secrets.yml — do not paste into git)
curl -sS -X POST http://chat.lab/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<admin-email>","password":"<admin-password>"}' | head -c 200
```
