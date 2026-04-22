import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MemoryView } from "@/components/MemoryView";

export const Route = createFileRoute("/memory")({
  head: () => ({
    meta: [
      { title: "Memory — R2D2 Control" },
      { name: "description", content: "Manage R2D2's long-term memory." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <MemoryView />
    </AppShell>
  );
}
