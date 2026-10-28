import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSessionFn } from "@/server/fns";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const session = await getSessionFn();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user: session.user };
  },
  component: Outlet,
});
