import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ProductsView } from "@/components/ProductsView";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [
    { title: "Products — R2D2 Business Engine" },
    { name: "description", content: "Generated digital products, niches, and listing copy." },
  ]}),
  component: () => <AppShell><ProductsView /></AppShell>,
});
