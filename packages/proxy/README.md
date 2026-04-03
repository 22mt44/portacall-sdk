# @portacall/proxy

Backend proxy SDK for Portacall routes.

## Install

```bash
bun add @portacall/proxy
```

```bash
npm install @portacall/proxy
```

## Usage

Create one shared `lib/portacall.ts` in your backend application and expose `proxy.handler()` under `/api/portacall/*`.

```ts
import { portacall } from "@portacall/proxy";

export const proxy = portacall(
  process.env.PORTACALL_SECRET_KEY ?? "",
);
```

```ts
import { Hono } from "hono";
import { proxy } from "./lib/portacall";

const app = new Hono();

app.all("/api/portacall/*", (c) => proxy.handler(c.req.raw));
```

The proxy handles these route shapes:

- `GET /api/portacall/:agentId/health`
- `GET /api/portacall/:agentId/conversations?externalUserId=...`
- `POST /api/portacall/:agentId/chat`
- `POST /api/portacall/:agentId/stream`

Chat and stream requests must include `externalUserId` in the JSON body. The
same `externalUserId` is required later if the client resumes a saved
`conversationId`.

## Adapters

```ts
import { createPortacallExpress } from "@portacall/proxy/adapters/express";
```
