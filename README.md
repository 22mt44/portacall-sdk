# portacall

Minimal server-side SDK for calling a Portacall agent.

## Install

```bash
bun add portacall
```

```bash
npm install portacall
```

```bash
pnpm add portacall
```

```bash
yarn add portacall
```

## Usage

Use the SDK on your backend only. `secretKey` must never be exposed to the browser.

```ts
import { portacall } from "portacall";

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
});

const content = await agent.chat("Hello");
```

## Streaming

Use `stream()` when you want chunks as they arrive.

```ts
import { portacall } from "portacall";

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
import { portacall, PortacallError } from "portacall";

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
import { portacall } from "portacall";

const agent = portacall({
  agentId: process.env.PORTACALL_AGENT_ID ?? "",
  secretKey: process.env.PORTACALL_SECRET_KEY ?? "",
  baseURL: "http://localhost:3000",
});

const content = await agent.chat("Hello from local development");
```
