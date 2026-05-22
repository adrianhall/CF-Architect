import { createRootRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell/AppShell.js";

export const Route = createRootRoute({
  component: AppShell,
});
