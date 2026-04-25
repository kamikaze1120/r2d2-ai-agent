import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AuditView } from "@/components/AuditView";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [
    { title: "Audit Log — R2D2 Business Engine" },
    { name: "description", content: "Action audit log for the autonomous engine." },
  ]}),
  component: () => <AppShell><AuditView /></AppShell>,
});
