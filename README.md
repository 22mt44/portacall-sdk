# portacall

Minimal SDK for Portacall frontend and backend integrations.

## Install

```bash
bun add @portacall/sdk
```

```bash
npm install @portacall/sdk
```

```bash
pnpm add @portacall/sdk
```

```bash
yarn add @portacall/sdk
```

## SDK layout

- `@portacall/sdk/client`: frontend SDK that calls your backend route.
- `@portacall/sdk/proxy`: backend SDK that exposes `agent.handler()` for `/api/agent/:agentId/*`.
- `@portacall/sdk`: root export for the same backend proxy API.

`secretKey` must never be exposed to the browser.

## Frontend

Create one shared `lib/agent.ts` in your frontend and import it anywhere you need `chat()`, `stream()`, or `health()`.

```ts
import { portacall } from "@portacall/sdk/client";

export const agent = portacall({
  backendURL: "http://localhost:4000",
  agentId: "demo-agent",
});
```

The client SDK sends requests to:

- `GET {backendURL}/api/agent/{agentId}/health`
- `POST {backendURL}/api/agent/{agentId}/chat`
- `POST {backendURL}/api/agent/{agentId}/stream`

```ts
const content = await agent.chat("Hello");

for await (const chunk of agent.stream("Write a short welcome message")) {
  console.log(chunk);
}
```

## Backend proxy

Create one shared `lib/agent.ts` in your backend with the agent id and secret key. This SDK exposes a single `handler()` entry point instead of frontend-style `chat()` and `stream()` methods.

```ts
import { portacall } from "@portacall/sdk/proxy";

export const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "demo-agent",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
});
```

## Hono

Use one wildcard route and forward the raw request to `agent.handler()`.

```ts
import { Hono } from "hono";
import { agent } from "./lib/agent";

const app = new Hono();

app.all("/api/agent/*", (c) => agent.handler(c.req.raw));
```

If you prefer the adapter entrypoint, it expects `/:agentId/health`, `/:agentId/chat`, and `/:agentId/stream` under the mounted base path.

```ts
import { Hono } from "hono";
import { createPortacallHono } from "@portacall/sdk/hono";
import { agent } from "./lib/agent";

const app = new Hono();

app.route("/api/agent", createPortacallHono(agent));
```

## Express

Use the Express adapter when you want to mount the proxy under `/api/agent`.

```ts
import express from "express";
import { createPortacallExpress } from "@portacall/sdk/express";
import { agent } from "./lib/agent";

const app = express();

app.use("/api/agent", createPortacallExpress(agent));
```

## Error handling

```ts
import { portacall, PortacallError } from "@portacall/sdk/client";

const agent = portacall({
  backendURL: "http://localhost:4000",
  agentId: "demo-agent",
});

try {
  const content = await agent.chat("Hello");
  console.log(content);
} catch (error) {
  if (error instanceof PortacallError) {
    console.error(error.status, error.code, error.message);
  }

  throw error;
}
```

## Custom upstream API URL

The backend proxy talks to `https://api.portacall.ai` by default. Override `baseURL` only on the backend proxy when you need a custom Portacall API origin.

```ts
import { portacall } from "@portacall/sdk/proxy";

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "demo-agent",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
  baseURL: "http://localhost:3000",
});
```

## Publishing

For the first publish:

```bash
npm login
npm whoami
bun run release:dry
bun run release
```

This package is org-scoped, so publishes go out as a public package under `@portacall/sdk`.

For later releases, bump the version first:

```bash
npm version patch
git push --follow-tags
bun run release
```

`release:dry` and `release` automatically trigger `prepublishOnly`, which runs:

```bash
bun run check
bun run build
```
