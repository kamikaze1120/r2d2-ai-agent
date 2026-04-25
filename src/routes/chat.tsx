import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/components/ChatView";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — R2D2" },
      {
        name: "description",
        content:
          "Direct chat with R2D2. Tools, memory, and streaming reasoning steps.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ChatView />
    </AppShell>
  ),
});
