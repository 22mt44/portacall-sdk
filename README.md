# portacall packages

Monorepo for the published Portacall SDK packages.

## Packages

- `@portacall/client`: frontend SDK that sends requests to your backend route.
- `@portacall/proxy`: backend SDK that exposes `portacall.handler()` plus an optional Express adapter.

`secretKey` must never be exposed to the browser.

## Frontend package

```ts
import { portacall } from "@portacall/client";

export const agent = portacall("http://localhost:4000", "demo-agent");

const content = await agent.chat("Hello", {
  externalUserId: session.user.id,
});

const conversations = await agent.getConversations(session.user.id);
```

## Backend package

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

Portacall conversations are user-scoped:

- `POST /chat` and `POST /stream` must include `externalUserId`
- `GET /conversations` must include `externalUserId` as a query parameter
- a `conversationId` can only be resumed by the same `externalUserId`

## Workspace commands

Run these from the repository root:

```bash
bun run test
bun run typecheck
bun run lint
bun run build
```

- `bun run test`: runs package tests in `packages/client` and `packages/proxy` through Turbo.
- `bun run typecheck`: runs TypeScript checks in both packages through Turbo.
- `bun run lint`: runs Biome checks in both packages through Turbo, then checks root docs and config files.
- `bun run build`: builds both published packages into their own `dist` folders.
- `bun run check`: runs `test`, `typecheck`, and `lint` in sequence.

## Publishing

Dry run:

```bash
bun run release:client:dry
bun run release:proxy:dry
```

Publish:

```bash
bun run release:client
bun run release:proxy
```

- `bun run release:client:dry`: runs `npm publish --workspace @portacall/client --dry-run`.
- `bun run release:proxy:dry`: runs `npm publish --workspace @portacall/proxy --dry-run`.
- `bun run release:client`: publishes `@portacall/client`.
- `bun run release:proxy`: publishes `@portacall/proxy`.
