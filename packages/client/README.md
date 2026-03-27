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

Create one shared `lib/portacall.ts` in your frontend application and import it anywhere you need `health()`, `chat()`, or `stream()`.

```ts
import { portacall } from "@portacall/client";

export const agent = portacall("http://localhost:4000", "demo-agent");
```

The client sends requests to:

- `GET {backendURL}/api/portacall/{agentId}/health`
- `POST {backendURL}/api/portacall/{agentId}/chat`
- `POST {backendURL}/api/portacall/{agentId}/stream`

```ts
const content = await agent.chat("Hello");

for await (const chunk of agent.stream("Write a short welcome message")) {
  console.log(chunk);
}
```

You can create more than one agent instance in the same app:

```ts
export const supportAgent = portacall("http://localhost:4000", "support");
export const salesAgent = portacall("http://localhost:4000", "sales");
```
