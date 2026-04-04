# @portacall/react

React adapter for the Portacall client SDK.

## Install

```bash
bun add @portacall/react @portacall/client
```

```bash
npm install @portacall/react @portacall/client
```

## Usage

Start with `usePortacall()` for the simplest setup. If you need finer control, `usePortacallClient()` and `usePortacallChat()` are still available.

```tsx
import { useState } from "react";
import { usePortacall } from "@portacall/react";

function SupportChat() {
  const [draft, setDraft] = useState("");
  const portacall = usePortacall({
    backendURL: "http://localhost:4000",
    agentId: "demo-agent",
    externalUserId: "demo-user",
    autoTitle: (message) => message.slice(0, 60),
  });

  async function handleSend() {
    const nextDraft = draft.trim();
    if (!nextDraft || portacall.isBusy) {
      return;
    }

    setDraft("");
    await portacall.sendMessage(nextDraft);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSend();
      }}
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button disabled={portacall.isBusy} type="submit">
        {portacall.isStreaming ? "Sending..." : "Send"}
      </button>
    </form>
  );
}
```

`usePortacallChat()` manages:

- conversation list pagination
- conversation history loading
- streaming assistant messages
- tool activity labels
- rename, archive, unarchive, and delete mutations
- health state for the current client

## Provider

```tsx
import {
  PortacallProvider,
  usePortacallChat,
  usePortacallClient,
} from "@portacall/react";

function ChatShell() {
  const chat = usePortacallChat({
    externalUserId: "demo-user",
  });

  return <pre>{JSON.stringify(chat.messages, null, 2)}</pre>;
}

function App() {
  const client = usePortacallClient({
    backendURL: "http://localhost:4000",
    agentId: "demo-agent",
  });

  return (
    <PortacallProvider client={client}>
      <ChatShell />
    </PortacallProvider>
  );
}
```
