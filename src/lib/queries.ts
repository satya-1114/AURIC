import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "issue_clerk" | "finance_head";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const meQuery = queryOptions({
  queryKey: ["me"],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [profile, roles] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const roleList = (roles.data ?? []).map((r) => r.role as Role);
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      fullName: profile.data?.full_name || u.user.email || "",
      roles: roleList,
      role: (roleList.includes("finance_head")
        ? "finance_head"
        : (roleList[0] ?? null)) as Role | null,
    };
  },
});

export const roleLabel = (r: Role | null) =>
  r === "finance_head" ? "Finance Head" : r === "issue_clerk" ? "Issue Clerk" : "No role assigned";

export const karigarsQuery = queryOptions({
  queryKey: ["karigars"],
  queryFn: async () => unwrap(await supabase.from("karigars").select("*").order("full_name")),
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("item_categories")
        .select("*")
        .eq("is_active", true)
        .order("category_name"),
    ),
});

export const issuesQuery = queryOptions({
  queryKey: ["issues"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("gold_issues")
        .select("*, karigars(full_name), item_categories(category_name)")
        .order("created_at", { ascending: false })
        .limit(500),
    ),
});

export const receiptsQuery = queryOptions({
  queryKey: ["receipts"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("gold_receipts")
        .select("*, karigars(full_name), gold_issues(transaction_number)")
        .order("created_at", { ascending: false })
        .limit(500),
    ),
});

export const balancesQuery = queryOptions({
  queryKey: ["balances"],
  queryFn: async () => unwrap(await supabase.rpc("get_karigar_balances")),
});

export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("loss_alerts")
        .select("*, karigars(full_name), gold_issues(transaction_number)")
        .order("created_at", { ascending: false }),
    ),
});

export const stockQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["stock", from, to],
    queryFn: async () =>
      unwrap(await supabase.rpc("get_stock_statement", { _from: from, _to: to })),
  });

export const outstandingQuery = queryOptions({
  queryKey: ["outstanding"],
  queryFn: async () => unwrap(await supabase.rpc("get_karigar_outstanding")),
});

export const allCategoriesQuery = queryOptions({
  queryKey: ["categories", "all"],
  queryFn: async () =>
    unwrap(await supabase.from("item_categories").select("*").order("category_name")),
});

export const trendsQuery = queryOptions({
  queryKey: ["trends"],
  queryFn: async () => unwrap(await supabase.rpc("get_wastage_trends")),
});

export const lossSettingsQuery = queryOptions({
  queryKey: ["loss-settings"],
  queryFn: async () => unwrap(await supabase.from("loss_settings").select("*").single()),
});

export const categoryAuditQuery = queryOptions({
  queryKey: ["audit", "item_category"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "item_category")
        .order("created_at", { ascending: false })
        .limit(50),
    ),
});
