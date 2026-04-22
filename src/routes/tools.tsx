import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ToolsView } from "@/components/ToolsView";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Tools — R2D2 Control" },
      { name: "description", content: "Tools available to your local R2D2 agent." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <ToolsView />
    </AppShell>
  );
}
