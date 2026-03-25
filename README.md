# portacall

Minimal SDK for Portacall server and browser integrations.

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

## Usage

Use the SDK on your backend only. `secretKey` must never be exposed to the browser.

```ts
import { portacall } from "@portacall/sdk";

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
});

const content = await agent.chat("Hello");
```

## Browser

Use the browser entrypoint when your frontend should call your own backend route such as `/api/agent`.
This entrypoint never accepts `secretKey`.

```ts
import { portacall } from "@portacall/sdk/client";

export const agent = portacall({
  baseURL: "http://localhost:4000/api/agent",
});
```

```ts
const content = await agent.chat("Hello");

for await (const chunk of agent.stream("Write a short welcome message")) {
  console.log(chunk);
}
```

## Hono

Mount the SDK directly when you want to avoid writing route-level request handling yourself.
Install `hono` in your app when you use this adapter. The core `@portacall/sdk` package does not install it for you.

```ts
import { portacall } from "@portacall/sdk";
import { createPortacallHono } from "@portacall/sdk/hono";
import { Hono } from "hono";

const app = new Hono();

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
});

app.route("/api/agent", createPortacallHono(agent));
```

## Express

Use the Express adapter when you want a Better Auth style mount point.

```ts
import express from "express";
import { portacall } from "@portacall/sdk";
import { createPortacallExpress } from "@portacall/sdk/express";

const app = express();

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
});

app.use("/api/agent", createPortacallExpress(agent));
```

## Streaming

Use `stream()` when you want chunks as they arrive.

```ts
import { portacall } from "@portacall/sdk";

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
});

let content = "";

for await (const chunk of agent.stream("Write a short welcome message")) {
  content += chunk;
  process.stdout.write(chunk);
}
```

## Error handling

```ts
import { portacall, PortacallError } from "@portacall/sdk";

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
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

## Custom API URL

By default, the SDK sends requests to `https://api.portacall.ai`.

```ts
import { portacall } from "@portacall/sdk";

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
  baseURL: "http://localhost:3000",
});

const content = await agent.chat("Hello from local development");
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
