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

Create one shared `lib/portacall.ts` in your backend application and expose `portacall.handler()` under `/api/portacall/*`.

```ts
import { portacall as createPortacall } from "@portacall/proxy";

export const portacall = createPortacall(
  process.env.PORTACALL_SECRET_KEY ?? "",
);
```

```ts
import { Hono } from "hono";
import { portacall } from "./lib/portacall";

const app = new Hono();

app.all("/api/portacall/*", (c) => portacall.handler(c.req.raw));
```

## Adapters

```ts
import { createPortacallExpress } from "@portacall/proxy/adapters/express";
```
