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
import { portacall as createPortacall } from "@portacall/client";

export const portacall = createPortacall({
  backendURL: "http://localhost:4000",
  agentId: "demo-agent",
});
```

The client sends requests to:

- `GET {backendURL}/api/portacall/{agentId}/health`
- `POST {backendURL}/api/portacall/{agentId}/chat`
- `POST {backendURL}/api/portacall/{agentId}/stream`

```ts
const content = await portacall.chat("Hello");

for await (const chunk of portacall.stream("Write a short welcome message")) {
  console.log(chunk);
}
```
