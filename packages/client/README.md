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

Create one shared `lib/agent.ts` in your frontend application and import it anywhere you need `health()`, `chat()`, or `stream()`.

```ts
import { portacall } from "@portacall/client";

export const agent = portacall({
  backendURL: "http://localhost:4000",
  agentId: "demo-agent",
});
```

The client sends requests to:

- `GET {backendURL}/api/agent/{agentId}/health`
- `POST {backendURL}/api/agent/{agentId}/chat`
- `POST {backendURL}/api/agent/{agentId}/stream`

```ts
const content = await agent.chat("Hello");

for await (const chunk of agent.stream("Write a short welcome message")) {
  console.log(chunk);
}
```
