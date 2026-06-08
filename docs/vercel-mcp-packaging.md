---
title: "Vercel MCP Packaging"
description: "Operator guide for building and deploying the hosted FPF Reference MCP surface on Vercel."
outline: deep
---

# Vercel MCP Packaging

This page is for **operators and contributors** who package or deploy the hosted MCP runtime. It is not part of the first-time adopter path — end users should start at [Connect MCP](/connect-mcp).

## What gets deployed

The MCP Vercel project (`fpf-reference-mcp`) serves:

- Streamable HTTP MCP at `https://mcp.fpf.sh/api/mcp/fpf_reference/mcp`
- Browser landing HTML at `https://mcp.fpf.sh/`
- Freshness JSON at `https://mcp.fpf.sh/api/fpf/status`

The wiki (`fpf.sh`) is a **separate** Vercel project (`fpf-sh`) built from `vercel:website:build`.

## Publication input

Both surfaces consume the committed channel `published/current/**`, staged before MCP deploy via:

```bash
bun run publish:current    # local pre-push / sync PR
bun run predeploy          # stage-from-published before vercel:mcp:build
```

Do not point production deploys at live upstream downloads inside CI.

## Build and deploy commands

```bash
# MCP bundle (includes function size gate)
bun run vercel:mcp:build
bun run vercel:mcp:deploy:prod

# Website bundle (separate project)
bun run vercel:website:build
bun run vercel:website:deploy:prod

# Both production surfaces
bun run deploy:prod
```

Config files:

- [`vercel.mcp.json`](../vercel.mcp.json) — MCP/API project (`buildCommand`: `bun run vercel:mcp:build`)
- [`vercel.json`](../vercel.json) — static wiki project

## Safety switches

| Variable | Purpose |
| --- | --- |
| `FPF_HOSTED_MCP_DISABLED` | Emergency `503` shutoff for `/api/mcp/*` before loading runtime |
| `bench:vercel:function-size` | Fails build when MCP function bundle exceeds budget |

## Verification after deploy

```bash
bun run smoke:production
bun run test:e2e -- tests/e2e/mcp.spec.ts
bun run monitor:content -- --mode live
```

Expect `get_fpf_index_status` and public tool list on the canonical `fpf_reference` route; legacy `fpf_memory` should remain blocked with a cheap migration signal.
