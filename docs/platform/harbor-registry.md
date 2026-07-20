# Build a Private Container Registry with Harbor

**Harbor** is the primary private registry for this lab — deployed in Kubernetes in Phase 8 via Argo CD. It gives you proxy cache, RBAC, robot accounts, replication, Trivy scanning, and audit logs that match GitLab CI and Kyverno workflows. Budget roughly **4–8 GB RAM** on the cluster.

Zot is optional side practice on a spare VM if you want a minimal OCI registry. Do not run both as production registries; pick one cluster URL (`harbor.lab.example.com`).

## What this page covers

- Harbor vs Zot and why Harbor is primary
- What the Harbor UI cannot do (no “pull from Hub” button)
- Proxy cache, replication, and push workflows
- Wiring images into Kubernetes and CI

## Harbor vs Zot (short)

| | **Harbor** | **Zot** |
| - | ---------- | ------- |
| Admin model | Web UI (projects, users, registries, replication) | **Config file** / env vars |
| Proxy cache upstreams | UI: Administration → Registries | Edit JSON, restart |
| Vulnerability scan | Trivy built-in | Limited / external |
| RBAC / robot accounts | ✅ | Minimal |
| RAM | Higher (~4–8 GB) | Lower (~512 MB–1 GB) |
| This lab | ✅ **Primary** | 🧪 Optional lab only |

**Do not run Harbor and Zot as two production registries** — pick one URL for
the cluster (`harbor.lab.example.com`).

---

## What Harbor UI does **not** do

There is **no** button:

```text
Search Docker Hub → [Pull nginx:latest] → done
```

Harbor never imports images from the UI by typing an upstream name. You get
images into Harbor by one of the workflows below.

---

## Three ways to get images into Harbor

### 1. Proxy cache (recommended for third-party images)

**Setup (UI):** Administration → Registries → New Registry (Docker Hub, GHCR,
Quay, MCR, …). Create a project with type **Proxy Cache** linked to that registry.

**Use:**

```bash
# First pull — Harbor fetches from Docker Hub and caches locally
docker pull harbor.lab.example.com/dockerhub/library/nginx:1.27

# Later pulls — served from Harbor cache
docker pull harbor.lab.example.com/dockerhub/library/nginx:1.27
```

**Kubernetes** (image in Deployment):

```yaml
image: harbor.lab.example.com/dockerhub/library/redis:7.2
```

No manual import. First pod pull populates the cache.

| Good for | Not good for |
| -------- | ------------ |
| nginx, redis, postgres upstream | Images you must own if Docker Hub is down forever |
| Pinning pulls through one URL | One-off “mirror this exact list” without pull traffic |

### 2. Replication (copy into your project)

**Setup (UI):** Administration → Registries + **Replication** rules — copy
`library/nginx` from Docker Hub → `apps/nginx` on a schedule or on event.

**Use:**

```bash
docker pull harbor.lab.example.com/apps/nginx:1.27
```

Image is **fully stored** in Harbor. Works offline from upstream after sync.

| Good for | Not good for |
| -------- | ------------ |
| Known base images you always need | “Browse and click import” |
| Air-gap style preparedness | Ad-hoc one image without a rule |

### 3. Manual import (CLI — common for cherry-picks)

```bash
docker pull nginx:1.27
docker tag nginx:1.27 harbor.lab.example.com/library/nginx:1.27
docker push harbor.lab.example.com/library/nginx:1.27
```

Or in CI: build → scan → **cosign sign** → push to `apps/my-api:1.2.3`.

| Good for | Not good for |
| -------- | ------------ |
| Your own images | Bulk upstream mirroring |
| One image you want in `library/` | Day-to-day Docker Hub browsing |

**Automation alternative:** script or GitLab job that pulls upstream, retags,
pushes — still not a Harbor UI feature.

---

## Recommended project layout

DNS: `harbor.lab.example.com` (internal; AdGuard or `/etc/hosts`).

```text
harbor.lab.example.com
│
├── proxy-dockerhub/     # Proxy Cache → Docker Hub
├── proxy-ghcr/          # Proxy Cache → ghcr.io
├── proxy-quay/          # Proxy Cache → quay.io
├── proxy-mcr/           # Proxy Cache → mcr.microsoft.com
│
├── infra/               # Platform images (copied or built)
│   ├── keycloak
│   ├── postgres
│   └── ...
│
├── apps/                # Your applications (CI push + Cosign)
│   ├── api
│   └── web
│
└── base/                # CI base images (optional)
    ├── node
    └── golang
```

**Naming in manifests:**

| Source | Example image |
| ------ | ------------- |
| Cached Docker Hub | `harbor.lab.example.com/proxy-dockerhub/library/nginx:1.27` |
| Your app (signed) | `harbor.lab.example.com/apps/api:1.2.3` |
| Replicated infra | `harbor.lab.example.com/infra/redis:7.2` |

Exact project names are yours — keep **proxy_** prefix obvious in Kyverno policies.

---

## End-to-end flow (this lab)

```text
Developer / CI
    │
    ├── Third-party: pull via proxy path (auto-cache on first use)
    │
    └── Own app: GitLab CI
              ├── docker build
              ├── trivy scan
              ├── cosign sign
              └── push → harbor.../apps/...

Kubernetes
    │
    ├── imagePullSecrets (robot account or OIDC)
    ├── pull from harbor.lab.example.com/...
    └── Kyverno verifyImages (Phase 9) — only signed + allowed registries
```

Details: [supply-chain-and-policies.md](../security/supply-chain-and-policies.md).

---

## Robot accounts & pulls

| Client | Auth |
| ------ | ---- |
| GitLab CI | Robot account per project — push `apps/*` |
| Kubernetes | `imagePullSecret` from ESO/Vault — read-only robot |
| Your Mac (Lima) | `docker login harbor.lab.example.com` for push tests |

Create robots in Harbor UI: Project → Robot Accounts.

---

## When to use replication vs proxy cache

| Scenario | Use |
| -------- | --- |
| Helm chart pulls `bitnami/redis` occasionally | **Proxy cache** |
| Cluster must survive Docker Hub outage for 10 core images | **Replication** on schedule |
| Your built microservice | **CI push** + Cosign |
| “I saw an image on Hub and want it saved” | **Manual** pull/tag/push or add replication rule |

---

## Zot — if you experiment later

Run Zot on a **lab Docker VM** to learn OCI-only registries. Do not point
production Kyverno `verifyImages` at two registries. Compare, then decommission.

---

## Phase checklist

| Step | Action |
| ---- | ------ |
| 8 | Deploy Harbor via Argo CD (Helm) |
| 8 | Create proxy cache projects (Docker Hub first) |
| 8 | Enable Trivy scanning |
| 8b | GitLab CI: push signed images to `apps/` |
| 9 | Kyverno: allow only `harbor.lab.example.com/*` + signature verify |

---

## Related

- [service-placement.md](../architecture/service-placement.md)
- [supply-chain-and-policies.md](../security/supply-chain-and-policies.md)
- [gitops-bootstrap.md](../kubernetes/gitops-bootstrap.md)
