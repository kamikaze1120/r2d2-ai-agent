import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MarketingView } from "@/components/MarketingView";

export const Route = createFileRoute("/marketing")({
  head: () => ({ meta: [
    { title: "Marketing Queue — R2D2 Business Engine" },
    { name: "description", content: "Pinterest auto-posts and TikTok manual queue." },
  ]}),
  component: () => <AppShell><MarketingView /></AppShell>,
});
