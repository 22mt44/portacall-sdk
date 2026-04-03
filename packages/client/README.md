# @portacall/client

Frontend SDK for Portacall backend routes.

## Install

```bash
bun add @portacall/client
```

```bash
npm install @portacall/client
```

## Usage

Create one shared `lib/portacall.ts` in your frontend application and import it anywhere you need `health()`, conversation management, `chat()`, or `stream()`.

```ts
import { portacall } from "@portacall/client";

export const agent = portacall("http://localhost:4000", "demo-agent");
```

The client sends requests to:

- `GET {backendURL}/api/portacall/{agentId}/health`
- `GET {backendURL}/api/portacall/{agentId}/conversations?externalUserId=...`
- `POST {backendURL}/api/portacall/{agentId}/conversations`
- `GET {backendURL}/api/portacall/{agentId}/conversations/{conversationId}/messages?externalUserId=...`
- `PATCH {backendURL}/api/portacall/{agentId}/conversations/{conversationId}`
- `PATCH {backendURL}/api/portacall/{agentId}/conversations/{conversationId}/archive`
- `DELETE {backendURL}/api/portacall/{agentId}/conversations/{conversationId}?externalUserId=...`
- `POST {backendURL}/api/portacall/{agentId}/chat`
- `POST {backendURL}/api/portacall/{agentId}/stream`

```ts
const conversation = await agent.createConversation(session.user.id, {
  title: "Support thread",
});

const conversationList = await agent.getConversations(session.user.id, {
  limit: 20,
});

const history = await agent.getConversationMessages(
  conversation.id,
  session.user.id,
);

await agent.renameConversation(
  conversation.id,
  session.user.id,
  "Billing support",
);

await agent.archiveConversation(conversation.id, session.user.id);
await agent.unarchiveConversation(conversation.id, session.user.id);

const content = await agent.chat("Hello", {
  externalUserId: session.user.id,
  conversationId: conversation.id,
});

for await (const chunk of agent.stream("Write a short welcome message", {
  externalUserId: session.user.id,
  conversationId: conversation.id,
})) {
  console.log(chunk);
}

await agent.deleteConversation(conversation.id, session.user.id);
```

`externalUserId` is required for every chat and stream request. Use a stable ID
from your own auth system so the same user can resume an existing
`conversationId`, fetch prior messages, and manage their previous conversations.

You can create more than one agent instance in the same app:

```ts
export const supportAgent = portacall("http://localhost:4000", "support");
export const salesAgent = portacall("http://localhost:4000", "sales");
```
