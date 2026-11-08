import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      {
        name: "description",
        content: "Gold inventory and karigar management for jewellery workshops.",
      },
      { property: "og:title", content: "AURIC · Gold Operations & Karigar Management" },
      {
        property: "og:description",
        content: "Gold inventory and karigar management for jewellery workshops.",
      },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const me = await context.queryClient.ensureQueryData(meQuery);
    throw redirect({ to: me?.role === "finance_head" ? "/dashboard" : "/karigars" });
  },
  component: () => null,
});
