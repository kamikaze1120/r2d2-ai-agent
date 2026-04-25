import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { JarvisHome } from "@/components/JarvisHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "R2D2 — Autonomous Business Engine" },
      {
        name: "description",
        content:
          "JARVIS-style command center for the R2D2 autonomous digital product engine. Speak orders, get spoken replies, and let R2D2 run the business.",
      },
      {
        property: "og:title",
        content: "R2D2 — Autonomous Business Engine",
      },
      {
        property: "og:description",
        content:
          "Cinematic JARVIS interface for the R2D2 autonomous engine — voice, proactive questions, and a self-driving worker pool.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <JarvisHome />
    </AppShell>
  );
}
