import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ChatView } from "@/components/ChatView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "R2D2 Control — Local AI Agent" },
      {
        name: "description",
        content:
          "Web control panel for R2D2, a local-first AI agent that runs on your laptop with Ollama.",
      },
      { property: "og:title", content: "R2D2 Control — Local AI Agent" },
      {
        property: "og:description",
        content: "Chat, run tools, and manage memory for your local R2D2 agent.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <ChatView />
    </AppShell>
  );
}
