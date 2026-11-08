import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, roleLabel } from "@/lib/queries";
import {
  LayoutDashboard,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  BellRing,
  FileSpreadsheet,
  LogOut,
  Bell,
  Tags,
  Menu,
  ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const nav = [
  {
    group: "Overview",
    items: [{ title: "Dashboard", to: "/dashboard", icon: LayoutDashboard, finance: true }],
  },
  {
    group: "Workshop",
    items: [
      { title: "Karigars", to: "/karigars", icon: Users, finance: false },
      { title: "Gold Issues", to: "/gold-issues", icon: ArrowUpRight, finance: false },
      { title: "Gold Receipts", to: "/gold-receipts", icon: ArrowDownLeft, finance: false },
      { title: "Balances", to: "/balances", icon: Scale, finance: true },
    ],
  },
  {
    group: "Control",
    items: [
      { title: "Loss Alerts", to: "/loss-alerts", icon: BellRing, finance: true },
      { title: "Stock Statement", to: "/stock-statement", icon: FileSpreadsheet, finance: true },
      { title: "Item Categories", to: "/categories", icon: Tags, finance: true },
    ],
  },
] as const;

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useQuery(meQuery);
  const isFinance = me?.role === "finance_head";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initials = (me?.fullName || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-gold">
          Au
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-[0.18em]">AURIC</p>
          <p className="max-w-36 text-[10px] leading-4 text-muted-foreground">
            Gold Operations &amp; Karigar Management System
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {nav
          .map((g) => ({ ...g, items: g.items.filter((i) => isFinance || !i.finance) }))
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <div key={g.group}>
              <p className="label-caps px-2 pb-2">{g.group}</p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = path === it.to;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        onClick={onNavigate}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        )}
                      >
                        {active && (
                          <span className="absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-full bg-gold" />
                        )}
                        <it.icon className="size-4" />
                        {it.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{me?.fullName ?? "…"}</p>
            <p className="text-xs text-gold">{roleLabel(me?.role ?? null)}</p>
          </div>
          <button
            aria-label="Log out"
            onClick={signOut}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useQuery(meQuery);
  const current = nav
    .flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })))
    .find((i) => i.to === path);
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-8">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 hover:bg-secondary lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{current?.group ?? "AURIC"}</span>
            <ChevronRight className="hidden size-3.5 sm:inline" />
            <span className="font-medium text-foreground">{current?.title ?? "Page"}</span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span
              className="num hidden text-sm text-muted-foreground md:inline"
              suppressHydrationWarning
            >
              {today}
            </span>
            {me?.role === "finance_head" ? (
              <Link
                to="/loss-alerts"
                aria-label="Loss alerts"
                className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Bell className="size-4" />
              </Link>
            ) : (
              <span className="rounded-md p-2 text-muted-foreground">
                <Bell className="size-4" />
              </span>
            )}
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {(me?.fullName || "?")
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span
      title="Includes seeded demo records"
      className="inline-flex items-center rounded-full border border-gold/40 bg-gold-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-gold"
    >
      Demo data
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
