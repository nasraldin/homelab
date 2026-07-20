# Bootstrap GitOps so Git Owns Every Cluster App

Once the kubeadm cluster is up, stop installing apps by hand. Bootstrap the minimum (CNI, optionally storage, Argo CD), then put every permanent workload in Git and let Argo CD sync it.

This page is the handoff from “cluster exists” to “Git owns day-2.” Follow the order; skip steps and you fight missing CRDs and empty storage classes.

## What this page covers

- What you install manually once vs what Argo owns
- Git repo layout for app-of-apps
- Cilium, Longhorn, and Argo CD bootstrap steps
- Root Application and platform sync after Argo is live

## Bootstrap principle

Only these are installed **manually** (or via Ansible once):

1. Kubernetes (kubeadm)
2. Cilium (networking must exist)
3. **Argo CD** (the deployment engine)
4. Optionally Longhorn **if** you need PVCs before Argo can sync storage class

After step 3, **every permanent app** is an Argo CD `Application` in Git.

```text
kubeadm + containerd
        ↓
Cilium (helm or cilium cli)     ← manual
        ↓
Longhorn (helm)               ← manual OR first Argo app
        ↓
Argo CD (helm/kubectl)          ← manual ONCE
        ↓
Git repo (homelab-gitops)
        ↓
Argo syncs: cert-manager, ingress, monitoring, Harbor, apps…
```

---

## Git repository layout (create before Argo)

```text
homelab-gitops/
├── bootstrap/
│   └── root-app.yaml          # App-of-apps entry
├── clusters/
│   └── prod/
│       ├── platform-apps.yaml
│       └── workloads-apps.yaml
├── platform/
│   ├── cert-manager/
│   │   └── values.yaml
│   ├── ingress-nginx/
│   │   └── values.yaml
│   ├── longhorn/              # after manual install, Argo adopts
│   ├── monitoring/
│   └── harbor/
└── apps/
    └── ...
```

Host Git on **GitLab VM** — not inside the cluster.

---

## Step 1 — Platform namespace prep

```bash
kubectl create namespace cilium-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace longhorn-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
```

---

## Step 2 — Cilium

```bash
helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium -n kube-system \
  --set operator.replicas=1 \
  --set ipam.mode=kubernetes
```

Verify: `kubectl get pods -n kube-system -l k8s-app=cilium`

---

## Step 3 — Longhorn

**Prerequisite:** each worker has a second SCSI disk (unformatted) on `data01`.

```bash
helm repo add longhorn https://charts.longhorn.io
helm install longhorn longhorn/longhorn -n longhorn-system \
  --set defaultSettings.defaultReplicaCount=2
```

UI (temporary): `kubectl port-forward -n longhorn-system svc/longhorn-frontend 8080:80`

Set **default StorageClass**:

```bash
kubectl patch storageclass longhorn -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

Later: move to Argo CD `Application` with same `values.yaml` in Git.

---

## Step 4 — Argo CD (the only long-term manual install)

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
# Or: helm install argo-cd argo/argo-cd -n argocd
```

Initial admin password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Port-forward UI: `kubectl port-forward svc/argocd-server -n argocd 8080:443`

**Then:** configure GitLab repo credentials in Argo CD → connect `homelab-gitops`.

---

## Step 5 — Root Application (app-of-apps)

`bootstrap/root-app.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://gitlab.lab.example.com/platform/homelab-gitops.git
    targetRevision: main
    path: clusters/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Apply **once**:

```bash
kubectl apply -f bootstrap/root-app.yaml
```

`clusters/prod/` contains more `Application` manifests pointing at `platform/*` Helm charts.

---

## Step 6 — Helm under Argo CD (not CLI)

Example `platform/cert-manager/application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cert-manager
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://charts.jetstack.io
    chart: cert-manager
    targetRevision: v1.16.*
    helm:
      valueFiles:
        - values.yaml
      parameters:
        - name: installCRDs
          value: "true"
  destination:
    server: https://kubernetes.default.svc
    namespace: cert-manager
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

**You stop running `helm install`** after bootstrap. Edit `values.yaml` in Git → commit → Argo syncs.

---

## Install order via Argo CD (after bootstrap)

| Order | Component | Namespace |
| ----- | --------- | --------- |
| 1 | cert-manager | cert-manager |
| 2 | ingress-nginx | ingress-nginx |
| 3 | metrics-server | kube-system |
| 4 | KEDA | keda |
| 5 | external-secrets | external-secrets |
| 6 | prometheus-stack | monitoring |
| 7 | loki | monitoring |
| 8 | harbor | harbor |
| 9 | keycloak | keycloak |
| 10 | apps | per-app |

Longhorn can stay manual-managed until comfortable, then **adopt** via Argo with matching values.

---

## What stays outside Argo CD

| Item | Tool |
| ---- | ---- |
| Proxmox VMs / disks | Terraform |
| kubeadm join / upgrade | Ansible or runbook |
| GitLab VM packages | Ansible |
| Bootstrap Argo CD itself | One-time helm/kubectl |
| Emergency break-glass | `kubectl` debug |

---

## Anti-patterns

| Don't | Do |
| ----- | -- |
| GitLab in k8s | GitLab VM |
| `helm install` for every app | Argo `Application` |
| Longhorn on OS disk | Dedicated vdisk per worker |
| Terraform helm_provider for Grafana | Argo CD |
| Manual `kubectl apply` for prod apps | Git commit |

---

## Related

- [kubeadm-architecture.md](kubeadm-architecture.md)
- [service-placement.md](../architecture/service-placement.md)
- [platform-tooling.md](../platform-tooling.md)
