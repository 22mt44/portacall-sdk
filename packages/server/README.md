# @portacall/server

Server SDK for Portacall routes, tool sync, auth handoff, and webhook execution.

## Install

```bash
bun add @portacall/server
```

```bash
npm install @portacall/server
```

## Core usage

```ts
import { createPortacallServer } from "@portacall/server";

const server = createPortacallServer({
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
  webhookSecret: process.env.PORTACALL_WEBHOOK_SECRET ?? "",
});

export const agent = server.agent("demo-agent");
```

## Subpaths

- `@portacall/server/hono`
- `@portacall/server/express`
- `@portacall/server/auth/better-auth`
- `@portacall/server/auth/authjs`

### Hono

```ts
import { Hono } from "hono";
import { createPortacallHono } from "@portacall/server/hono";
import { agent } from "./portacall";

const app = new Hono();
const portacall = createPortacallHono(agent);

app.post("/api/portacall/webhooks", (c) => portacall.webhook(c));
app.all("/api/portacall/*", (c) => portacall.handler(c));
```

### Express

```ts
import express from "express";
import { createPortacallExpress } from "@portacall/server/express";
import { agent } from "./portacall";

const app = express();
app.use("/api/portacall", createPortacallExpress(agent));
```

### Better Auth

```ts
import { createBetterAuthAdapter } from "@portacall/server/auth/better-auth";
```

### Auth.js

```ts
import { createAuthJsAdapter } from "@portacall/server/auth/authjs";
```
