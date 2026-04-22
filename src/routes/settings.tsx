import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SettingsView } from "@/components/SettingsView";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — R2D2 Control" },
      { name: "description", content: "Configure the R2D2 agent connection and model." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}
