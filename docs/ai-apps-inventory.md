# Ajrly AI application setup inventory

This inventory records the Ajrly Talos cluster only. The separate `lab-home-gitops`
repository is for the Dev Homelab cluster and is not part of this deployment.

| Application | Planned version | Public URL | Internal endpoint | Dependencies | Persistent data |
| --- | --- | --- | --- | --- | --- |
| Hermes Agent | `v0.21.3` | none | `hermes.ai.svc.cluster.local:8642` | OpenAI/Anthropic secrets; Paperclip adapter | `proxmox-data` RWO home/config and session files |
| Paperclip | `v2026.916.1` | `paperclip.ajrly.com` | `paperclip.ai.svc.cluster.local:3100` | isolated PostgreSQL database/role; Hermes gateway | workspace PVC (`proxmox-data`) and database in CNPG |
| Dify | `v1.17.1` | `dify.ajrly.com` | web/API services in `ai`; internal plugin/sandbox services | isolated PostgreSQL database with pgvector; dedicated Redis broker; external provider keys | uploads/plugin state and Redis persistence as required by Dify |
| Autensa (Mission Control) | `v2.5.1` | `autensa.ajrly.com` | `autensa.ai.svc.cluster.local:4000` | existing OpenClaw gateway | SQLite/workspace PVC (`proxmox-data`) |

Versions are candidates from current upstream releases and must be rechecked against
image digests and rendered manifests before merge. Public URLs use the existing
Ajrly wildcard TLS certificate and Cloudflare tunnel publisher. UIs still require
application login; Cloudflare Access should add an email allow-list gate where
it does not block machine API calls.

## Known cluster contracts

- `redis-queue.redis.svc.cluster.local:6379`, authentication secret
  `redis/redis-queue-auth` key `password`; queue policy is `noeviction` and AOF.
- `redis-cache.redis.svc.cluster.local:6379`, authentication secret
  `redis/redis-cache-auth` key `password`; cache policy is `allkeys-lfu`.
- The Ajrly `ai` namespace enforces restricted Pod Security. Application pods
  must disable service-account token mounting, use non-root with RuntimeDefault
  seccomp, explicit modest resource bounds, and node label `workload=platform`
  only where the measured placement allows it. Stateful scheduling should prefer
  `workload=stateful`; both labels are present on actual cluster nodes.
- `proxmox-data` is the default RWO storage class with WaitForFirstConsumer and
  Retain. Persistent claims are tied to the single Proxmox host/storage pool.
- PostgreSQL is the existing CNPG cluster in namespace `ajrly`, with TLS-required
  services and per-database roles. App pods need the established
  `homelab.nasraldin.com/database-client=true` label and matching NetworkPolicy.

## Connection settings for Ajrly

The monorepo BullMQ, realtime, and Redis identity clients use `REDIS_HOST`,
`REDIS_PORT`, `REDIS_PASSWORD`, and optional `REDIS_TLS`. Set the queue connection
host to `redis-queue.redis.svc.cluster.local`, port `6379`, password from
`redis/redis-queue-auth:password`, and TLS false for the in-cluster service.
The cache adapter uses `CACHE_ADAPTER=redis` and `REDIS_URL`; use the distinct
`redis-cache` service and its password. `REDIS_ENDPOINT` is used by feedback queues and RBAC validation; `REDIS_URL` is
used by the cache adapter. Neither is a shared queue/cache shortcut. BullMQ and cache
must keep separate endpoints. Redis logical database numbers do not provide
instance isolation.

This repository setup does not change current Ajrly application endpoint values
or restart Ajrly web/worker pods. Apply the connection values in the application
deployment repo only after its own review and rollout plan.
