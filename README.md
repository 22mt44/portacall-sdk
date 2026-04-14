# portacall packages

Monorepo for the published Portacall SDK packages.

## Packages

- `@portacall/client`: frontend SDK plus the `@portacall/client/react` subpath.
- `@portacall/server`: server SDK plus framework and auth subpaths.

`secretKey` must never be exposed to the browser.

## Frontend package

```ts
import { portacall } from "@portacall/client";

export const agent = portacall("http://localhost:4000", "demo-agent");

const content = await agent.chat("Hello", {
  externalUserId: session.user.id,
});

const conversation = await agent.createConversation(session.user.id, {
  title: "Support thread",
});

const conversations = await agent.getConversations(session.user.id, {
  limit: 20,
});

const history = await agent.getConversationMessages(
  conversation.id,
  session.user.id,
);
```

## React subpath

```tsx
import { useState } from "react";
import { usePortacallChat, usePortacallClient } from "@portacall/client/react";

function SupportChat() {
  const client = usePortacallClient({
    backendURL: "http://localhost:4000",
    agentId: "demo-agent",
  });
  const [draft, setDraft] = useState("");
  const chat = usePortacallChat({
    client,
    externalUserId: "demo-user",
    autoTitle: (message) => message.slice(0, 60),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const nextDraft = draft.trim();
        if (!nextDraft || chat.isBusy) {
          return;
        }
        setDraft("");
        void chat.sendMessage(nextDraft);
      }}
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button disabled={chat.isBusy} type="submit">
        {chat.isStreaming ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
```

## Server package

```ts
import { createPortacallServer } from "@portacall/server";

const server = createPortacallServer({
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
  webhookSecret: process.env.PORTACALL_WEBHOOK_SECRET ?? "",
});

export const agent = server.agent("demo-agent");
```

```ts
import { Hono } from "hono";
import { createPortacallHono } from "@portacall/server/hono";
import { agent } from "./lib/portacall";

const app = new Hono();
const portacall = createPortacallHono(agent);

app.post("/api/portacall/webhooks", (c) => portacall.webhook(c));
app.all("/api/portacall/*", (c) => portacall.handler(c));
```

Available `@portacall/server` subpaths:

- `@portacall/server/hono`
- `@portacall/server/express`
- `@portacall/server/auth/better-auth`
- `@portacall/server/auth/authjs`

Portacall conversations are user-scoped:

- `POST /chat` and `POST /stream` must include `externalUserId`
- `GET /conversations` and `GET /conversations/:conversationId/messages` must include `externalUserId` as a query parameter
- `POST /conversations`, `PATCH /conversations/:conversationId`, and `PATCH /conversations/:conversationId/archive` include `externalUserId` in the JSON body
- `DELETE /conversations/:conversationId` requires `externalUserId` in the query string
- a `conversationId` can only be resumed by the same `externalUserId`

## Workspace commands

Run these from the repository root:

```bash
bun run test
bun run typecheck
bun run lint
bun run build
```

- `bun run test`: runs package tests across the published SDK packages through Turbo.
- `bun run typecheck`: runs TypeScript checks across the published SDK packages through Turbo.
- `bun run lint`: runs Biome checks across the published SDK packages through Turbo, then checks root docs and config files.
- `bun run build`: builds the published SDK packages into their own `dist` folders.
- `bun run check`: runs `test`, `typecheck`, and `lint` in sequence.

## Publishing

Dry run:

```bash
bun run release:client:dry
bun run release:server:dry
```

Publish:

```bash
bun run release:client
bun run release:server
```

- `bun run release:client:dry`: runs `npm publish --workspace @portacall/client --dry-run`.
- `bun run release:server:dry`: runs `npm publish --workspace @portacall/server --dry-run`.
- `bun run release:client`: publishes `@portacall/client`.
- `bun run release:server`: publishes `@portacall/server`.
