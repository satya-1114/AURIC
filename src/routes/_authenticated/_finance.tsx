import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { meQuery } from "@/lib/queries";

// UX gate only: the database independently refuses finance data to other roles (RLS + role-checked functions).
export const Route = createFileRoute("/_authenticated/_finance")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me?.role !== "finance_head") throw redirect({ to: "/karigars" });
  },
  component: () => <Outlet />,
});
