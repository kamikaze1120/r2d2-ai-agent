import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ApprovalsView } from "@/components/ApprovalsView";

export const Route = createFileRoute("/approvals")({
  head: () => ({ meta: [
    { title: "Approvals — R2D2 Business Engine" },
    { name: "description", content: "Review and approve low-confidence agent actions before they ship." },
  ]}),
  component: () => <AppShell><ApprovalsView /></AppShell>,
});
