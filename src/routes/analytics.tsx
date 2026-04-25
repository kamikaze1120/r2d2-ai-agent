import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AnalyticsView } from "@/components/AnalyticsView";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: "Analytics — R2D2 Business Engine" },
    { name: "description", content: "Revenue, sales, views, and conversion analytics." },
  ]}),
  component: () => <AppShell><AnalyticsView /></AppShell>,
});
