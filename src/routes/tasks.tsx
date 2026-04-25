import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TasksView } from "@/components/TasksView";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [
    { title: "Tasks — R2D2 Business Engine" },
    { name: "description", content: "Persistent task queue, agent activity, and worker status." },
  ]}),
  component: () => <AppShell><TasksView /></AppShell>,
});
