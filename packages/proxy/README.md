# @portacall/proxy

Backend proxy SDK for Portacall agent routes.

## Install

```bash
bun add @portacall/proxy
```

```bash
npm install @portacall/proxy
```

## Usage

Create one shared `lib/agent.ts` in your backend application and expose `agent.handler()` under `/api/agent/*`.

```ts
import { portacall } from "@portacall/proxy";

export const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "demo-agent",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
});
```

```ts
import { Hono } from "hono";
import { agent } from "./lib/agent";

const app = new Hono();

app.all("/api/agent/*", (c) => agent.handler(c.req.raw));
```

## Adapters

```ts
import { createPortacallExpress } from "@portacall/proxy/adapters/express";
```
