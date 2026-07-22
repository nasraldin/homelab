# OpsHub — Design Spec

**Date:** 2026-07-22  
**Status:** Approved for scaffold (Phase 0)  
**Register:** product

## Problem

Lab services, Proxmox guests, notes, and terminals are scattered across bookmarks and UIs. Need one private dashboard for a solo operator.

## Goals

1. Service URL hub with optional health
2. Live Proxmox VM/LXC stats and light power actions
3. Markdown notes + todo kanban
4. Browser SSH + Proxmox console via secure gateway
5. Configurable auth: Cloudflare Access and/or app login
6. Agent-friendly docs (STATUS/ROADMAP/AGENTS)

## Non-goals

Replace Grafana, Pulse, full Uptime Kuma, or SIEM. Deep metrics stay linked out.

## Users & deploy

- Solo operator
- Always-on **Proxmox LXC**
- LAN primary; Cloudflare Tunnel + Access optional remote

## Architecture summary

Next.js (latest) BFF + Node WebSocket gateway + SQLite (Drizzle). Secrets stay server-side. See the [OpsHub `docs/ARCHITECTURE.md`](https://github.com/nasraldin/opshub/blob/main/docs/ARCHITECTURE.md) in the sibling repository (local path `~/homelab/dashboard` after `clone-labs.sh`).

## Framework

Next.js latest App Router + sibling gateway (see ADR 001). At scaffold: Next.js 16 / React 19 / Tailwind 4.

## Auth

`AUTH_MODE=cloudflare|app|both` (ADR 002).

## Modules & phases

See [OpsHub ROADMAP](https://github.com/nasraldin/opshub/blob/main/docs/ROADMAP.md) Phases 0–11 and [FEATURE-MATRIX](https://github.com/nasraldin/opshub/blob/main/docs/FEATURE-MATRIX.md) for competitor feature mapping (Dashy, Homepage, Sun-Panel).

## High-value extras (Phase 7)

Global search, lightweight uptime, backup/task widget, maintenance events, runbook links to lab docs, inventory allowlist, lite alert/incident notes.

## Security

Dedicated Proxmox API token; SSH keys only on LXC; inventory allowlist; audit open/close; no keystroke logging; WS idle timeout.

## Success criteria (Phase 0)

- OpsHub repo (`nasraldin/opshub`, cloned as `dashboard/`) installs and `pnpm dev` serves the ops shell
- PRODUCT.md / DESIGN.md / agent docs present in that repo
- Homelab README + docs hub link to the GitHub project
