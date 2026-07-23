# Sign Images and Enforce Policy with Cosign and Kyverno

Build-time signing (Cosign/Sigstore) and deploy-time admission (Kyverno) close the loop: prove the image was not tampered with after CI, then block unsigned or non-compliant workloads before they run — including Argo CD syncs.

This lab uses **Kyverno** for Kubernetes policy, not Gatekeeper, unless you specifically want Rego. Related ownership: [platform-tooling.md](../platform-tooling.md) · [automation-layers.md](../architecture/automation-layers.md). External read: [Securing Kubernetes workloads with Sigstore](https://www.donaldsebleung.com/blog/20230720-securing-your-kubernetes-workloads-with-sigstore).

## What this page covers

- What Trivy, Syft, Cosign, Harbor, and Kyverno each solve
- End-to-end architecture from CI to admission
- Kyverno vs OPA Gatekeeper for this lab
- Concrete policy and signing steps aligned to phases

## What problem each piece solves

| Component            | Problem                                      | In this lab                                                    |
| -------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| **Trivy**            | Vulnerabilities in image layers              | CI gate + optional Trivy Operator                              |
| **Syft**             | SBOM (what's inside the image)               | CI artifact → attach to image                                  |
| **Cosign**           | Prove image wasn't tampered with after build | Sign after scan, before push                                   |
| **Harbor**           | Private registry + scan storage              | Phase 8 — [harbor-registry.md](../platform/harbor-registry.md) |
| **Kyverno**          | Block bad manifests at admission             | Phase 9 — verify signatures + policies                         |
| **OPA / Gatekeeper** | Rego policies everywhere                     | **Optional** — skip unless learning Rego                       |
| **Argo CD**          | Git is desired state                         | Phase 7 — deploys Kyverno + policies                           |

Sigstore and Kyverno are **complementary**: Cosign signs at build time; Kyverno
enforces at deploy time (including Argo CD syncs).

---

## Architecture (this homelab)

```text
GitLab (or GitHub Actions)
    │
    ├── docker build
    ├── trivy scan (fail on Critical)
    ├── syft → sbom.spdx.json
    ├── cosign sign (+ optional attestations)
    └── push → harbor.lab.example.com/project/app:1.2.3
                        │
                        │  (signature + SBOM in OCI artifacts)
                        ▼
              Kubernetes (kubeadm VMs on data01)
                        │
              Argo CD sync (Git)
                        │
              Kyverno Validating/Mutating webhook
                        │
         ┌──────────────┴──────────────┐
         │                             │
   verifyImages (cosign)        ClusterPolicies
   harbor registry only          no :latest, runAsNonRoot,
   signed by your key            limits, probes, labels
         │                             │
         └──────────────┬──────────────┘
                        ▼
                  Pod allowed / denied
```

**Not in scope for v1:** Falco, Wazuh, full Sigstore **keyless** with public
Fulcio (you can add later). Homelab starts with **Cosign key pair** stored in
Vault or GitLab CI variables.

---

## OPA vs Kyverno — decision for this lab

|                 | **Kyverno**             | **OPA Gatekeeper**                                         |
| --------------- | ----------------------- | ---------------------------------------------------------- |
| Policy language | Kubernetes YAML         | Rego                                                       |
| Cosign verify   | Built-in `verifyImages` | Via external data / custom                                 |
| Learning curve  | Lower                   | Higher (Rego)                                              |
| Your phases     | Phase 9 ✅              | Not planned                                                |
| When to add OPA | —                       | Multi-system policy (TF, API gateway) or Rego career focus |

**Verdict:** Use **Kyverno** for Kubernetes admission. Learn OPA concepts from
articles; implement policies in Kyverno unless you explicitly want Gatekeeper.

Kubernetes 1.26+ also has **ValidatingAdmissionPolicy** (CEL) — Kyverno remains
the better fit for Cosign + mutation + generate in one tool.

---

## Prerequisites (must exist first)

You cannot meaningfully run Cosign verify in Kyverno until these exist:

| #   | Prerequisite                          | Phase  | Repo                          |
| --- | ------------------------------------- | ------ | ----------------------------- |
| 1   | kubeadm cluster                       | 6      | `terraform-lab` VMs + kubeadm |
| 2   | Argo CD                               | 7      | new `argocd/` or app repo     |
| 3   | cert-manager + ingress                | 6–7    | Argo CD                       |
| 4   | **Harbor** (or interim GHCR)          | 8      | Argo CD                       |
| 5   | GitLab Runner **or** GHA with docker  | 2 / 11 | `gitlab-01` or GitHub         |
| 6   | Internal DNS `harbor.lab.example.com` | 3      | AdGuard + Technitium          |

**Order correction vs generic blogs:** Harbor and CI **before** strict Kyverno
signature policies — otherwise every deploy fails until signing is wired.

---

## Implementation roadmap (homelab-specific)

### Phase 6–7 — Cluster + GitOps

```bash
# terraform-lab: kubeadm node VMs
# Argo CD: bootstrap + app-of-apps
```

Deploy first without Kyverno enforcement (observe cluster).

### Phase 8 — Harbor

- Argo CD Application: Harbor (Helm)
- DNS: `harbor.lab.example.com` (internal), optional public via tunnel later
- Enable vulnerability scanning in Harbor (Trivy backend)
- Create projects: `platform`, `apps`, `sandbox`
- Robot account for CI push; human admin via Keycloak later

### Phase 8b — CI pipeline (minimal supply chain)

On **every** image build (GitLab `.gitlab-ci.yml` or GHA):

```yaml
# Conceptual stages — adapt to your runner
stages: [build, scan, sbom, sign, push]

build:
  script: docker build -t $IMAGE:$CI_COMMIT_SHA .

scan:
  script: trivy image --exit-code 1 --severity CRITICAL,HIGH $IMAGE:$CI_COMMIT_SHA

sbom:
  script: syft $IMAGE:$CI_COMMIT_SHA -o spdx-json > sbom.spdx.json

sign:
  script: |
    cosign sign --key env://COSIGN_PRIVATE_KEY $IMAGE:$CI_COMMIT_SHA
    cosign attach sbom --sbom sbom.spdx.json $IMAGE:$CI_COMMIT_SHA  # optional

push:
  script: docker push $IMAGE:$CI_COMMIT_SHA
```

**Secrets:** `COSIGN_PRIVATE_KEY`, `COSIGN_PASSWORD`, and Harbor robot
credentials in GitLab variables. The separate pre-Kubernetes Vault bootstrap
precedes any later in-cluster ESO integration.

**Mac/local test** (before CI):

```bash
cosign generate-key-pair   # once; store safely
docker build -t harbor.lab.example.com/sandbox/demo:0.1.0 .
trivy image harbor.lab.example.com/sandbox/demo:0.1.0
cosign sign --key cosign.key harbor.lab.example.com/sandbox/demo:0.1.0
```

### Phase 9 — Kyverno (warn → enforce)

**Step 1 — Install via Argo CD**

```text
argocd-apps/
  platform/
    kyverno/
      application.yaml    # Helm: kyverno/kyverno
    policies/
      application.yaml    # path: policies/cluster/
```

**Step 2 — Audit-only policies first**

Start with `validationFailureAction: Audit` so Argo CD and platform charts
don't break while you tune rules.

Examples (order):

1. Disallow `:latest` tag
2. Require `resources.limits` / `requests`
3. Require `runAsNonRoot`, drop `ALL` capabilities
4. Disallow `privileged`, `hostNetwork`, `hostPID`
5. Require standard labels (`app.kubernetes.io/*`, `team`, `environment`)

**Step 3 — Cosign verification policy**

After CI signs all images you deploy:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-signed-images
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 30
  rules:
    - name: verify-harbor-images
      match:
        any:
          - resources:
              kinds: [Pod]
      verifyImages:
        - imageReferences:
            - 'harbor.lab.example.com/*'
          attestors:
            - count: 1
              entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      ... from cosign.pub ...
                      -----END PUBLIC KEY-----
```

Store `cosign.pub` in Git (public key is fine) or ConfigMap synced by Argo CD.

**Step 4 — Enforce**

Flip policies to `Enforce`. Add **PolicyExceptions** for `kube-system`, Kyverno,
Argo CD, Cilium — signed platform images only.

### Phase 9 — ESO integration

After the separately designed pre-Kubernetes Vault bootstrap, integrate
in-cluster ESO for Cosign keys and Harbor credentials. This does not decide
Vault's placement or imply that Vault is deployed now.

### Phase 9 — Observability

- Kyverno metrics → Prometheus (ServiceMonitor)
- Grafana dashboard: policy failures, verify image failures
- Argo CD: sync status for `policies/` repo

### Phase 11+ — Harden further

| Tool              | When                                    |
| ----------------- | --------------------------------------- |
| Trivy Operator    | Continuous scan of running workloads    |
| Falco             | Runtime threats (after baseline stable) |
| Provenance (SLSA) | `cosign attest` with build metadata     |

---

## GitOps layout (recommended)

Create a repo (or path) e.g. `homelab-platform` or under `homelab/argocd/`:

```text
argocd/
├── bootstrap/
│   └── root-app.yaml
├── apps/
│   ├── harbor.yaml
│   ├── kyverno.yaml
│   └── monitoring.yaml
└── policies/
    ├── kyverno/
    │   ├── disallow-latest.yaml
    │   ├── require-resources.yaml
    │   ├── require-security-context.yaml
    │   └── verify-signed-images.yaml
    └── exceptions/
        └── platform-system.yaml
```

**Rule:** Application manifests and **ClusterPolicies** both flow through Argo
CD — no `kubectl apply` for permanent policy.

---

## What NOT to do in this lab (yet)

| Anti-pattern                                      | Why                                                          |
| ------------------------------------------------- | ------------------------------------------------------------ |
| Kyverno Enforce before Harbor + Cosign in CI      | Blocks all workloads                                         |
| Gatekeeper + Kyverno together                     | Two admission stacks, confusion                              |
| Sign only on `main` but deploy unsigned `:latest` | Verify policy useless                                        |
| Talos-only path for this feature                  | Primary cluster is **kubeadm** — same Kyverno/Cosign applies |
| OPA for every policy because blog says so         | Kyverno covers k8s admission                                 |
| Keyless Sigstore on day one                       | Needs internet + OIDC; keyed Cosign is fine for homelab      |

---

## Mapping to your phase table

| Blog step        | Your phase       | Status |
| ---------------- | ---------------- | ------ |
| Harbor           | 8                | ⏳     |
| Argo CD          | 7                | ⏳     |
| kubeadm + Cilium | 6                | ⏳     |
| Trivy in CI      | 8b (with Harbor) | ⏳     |
| Syft SBOM        | 8b               | ⏳     |
| Cosign sign      | 8b               | ⏳     |
| Kyverno install  | 9                | ⏳     |
| verifyImages     | 9                | ⏳     |
| Policy pack      | 9                | ⏳     |
| Falco / Wazuh    | 11+              | 🔮     |

---

## Minimum viable “Sigstore + Kyverno” milestone

A portfolio-worthy slice you can demo:

1. kubeadm cluster (Terraform VMs + kubeadm)
2. Harbor + one demo app repo
3. GitLab CI: build → Trivy → Cosign sign → push Harbor
4. Argo CD deploys demo app from Git
5. Kyverno `verifyImages` + `disallow-latest` in **Enforce**
6. Grafana panel: Kyverno policy results

Estimated effort after Phase 7: **2–3 focused sessions**.

---

## Prerequisites before this security stack

You are past **Phase 0** (`aux01` ⏸️ until Slot 3 NVMe), but this security stack
is not next. Complete the approved foundation sequence first:

1. DNS IPv6 polish (TP-Link RDNSS → AdGuard)
2. NetBird remote access (optional)
3. Vault (optional)
4. Later, bootstrap kubeadm + Argo CD
5. Deploy Harbor
6. Add one CI pipeline with Cosign
7. Install Kyverno audit → enforce

See [foundation-sequence.md](../roadmap/foundation-sequence.md) · [current-state.md](../current-state.md).
