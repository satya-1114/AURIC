import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, DemoBadge } from "@/components/auric/app-shell";
import { KpiCard, Panel, AlertCard, StatusBadge, EmptyState } from "@/components/auric/primitives";
import { DataTable } from "@/components/auric/data-table";
import { QueryState } from "@/components/auric/query-state";
import { Button } from "@/components/ui/button";
import { alertsQuery, balancesQuery, issuesQuery, meQuery, stockQuery } from "@/lib/queries";
import { daysAgoISO, fmtDate, fmtGrams, fmtPct, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_finance/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      {
        name: "description",
        content: "Daily gold position, karigar performance and alerts for your jewellery workshop.",
      },
      { property: "og:title", content: "Dashboard · AURIC Gold Operations" },
      {
        property: "og:description",
        content: "Daily gold position, karigar performance and alerts for your jewellery workshop.",
      },
    ],
  }),
  component: Dashboard,
});

const OVERDUE_DAYS = 14;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const me = useQuery(meQuery);
  const from = daysAgoISO(13);
  const to = todayISO();
  const balances = useQuery(balancesQuery);
  const stock = useQuery(stockQuery(from, to));
  const alerts = useQuery(alertsQuery);
  const issues = useQuery(issuesQuery);

  const sum = (rows: Record<string, unknown>[] | undefined, k: string) =>
    (rows ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const outstanding = sum(balances.data, "outstanding");
  const issued = sum(stock.data, "issued");
  const received =
    sum(stock.data, "received_jewellery") +
    sum(stock.data, "received_scrap") +
    sum(stock.data, "received_filings");
  const openAlerts = (alerts.data ?? []).filter((a) => a.status === "open");
  const overdue = (issues.data ?? []).filter(
    (i) => i.status === "open" && i.issue_date < daysAgoISO(OVERDUE_DAYS),
  );
  const hasDemo = !!balances.data?.some((b) => b.is_demo);
  const chart = (stock.data ?? []).map((d) => ({
    day: fmtDate(d.day).slice(0, 6),
    issued: Number(d.issued),
    received: Number(d.received_jewellery) + Number(d.received_scrap) + Number(d.received_filings),
    net: Number(d.net_movement),
  }));
  const kpiLoading = balances.isPending || stock.isPending || alerts.isPending;

  return (
    <>
      <PageHeader
        title={`${greeting()}${me.data?.fullName ? `, ${me.data.fullName.split(" ")[0]}` : ""}`}
        description="Here's your workshop's gold position today."
        badge={<DemoBadge show={hasDemo} />}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/stock-statement">Stock statement</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Gold with Karigars"
          value={outstanding}
          delta="Open issues, fine gold"
          tone="gold"
          loading={kpiLoading}
        />
        <KpiCard
          label="Issued · 14 days"
          value={issued}
          delta="Fine gold issued"
          loading={kpiLoading}
        />
        <KpiCard
          label="Received · 14 days"
          value={received}
          delta="Jewellery, scrap and filings"
          loading={kpiLoading}
        />
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <p className="label-caps">Open loss alerts</p>
          <p className="num mt-3 text-[1.75rem] font-semibold leading-none tracking-tight">
            {alerts.isPending ? "—" : openAlerts.length}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Excess wastage on closed issues</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Gold movement"
          subtitle="Fine gold issued vs received · last 14 days"
        >
          <QueryState q={stock} skeleton={<div className="h-72 animate-pulse bg-muted/40" />}>
            {() =>
              chart.every((c) => c.issued === 0 && c.received === 0) ? (
                <EmptyState
                  title="No movement in this period"
                  body="Issues and receipts will chart here."
                />
              ) : (
                <div className="h-72 px-2 py-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                        }}
                        formatter={(v: number, n: string) => [fmtGrams(v), n]}
                      />
                      <Bar
                        dataKey="issued"
                        name="Issued"
                        fill="var(--primary)"
                        radius={[3, 3, 0, 0]}
                        barSize={12}
                      />
                      <Bar
                        dataKey="received"
                        name="Received"
                        fill="var(--gold)"
                        radius={[3, 3, 0, 0]}
                        barSize={12}
                      />
                      <Line
                        dataKey="net"
                        name="Net movement"
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                        dot={false}
                        strokeWidth={1.5}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )
            }
          </QueryState>
        </Panel>
        <Panel
          title="Requires attention"
          subtitle={`${openAlerts.length + overdue.length} open items`}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/loss-alerts">View all alerts</Link>
            </Button>
          }
        >
          {openAlerts.length + overdue.length === 0 && !alerts.isPending ? (
            <EmptyState title="All clear" body="No wastage breaches or overdue returns." />
          ) : (
            <div className="divide-y">
              {openAlerts.slice(0, 4).map((a) => (
                <AlertCard
                  key={a.id}
                  tone={a.severity === "high" ? "danger" : "warning"}
                  title={
                    a.alert_type === "rising_trend"
                      ? "Review: recent wastage rising"
                      : "Review: wastage above agreed limit"
                  }
                  body={
                    a.alert_type === "rising_trend"
                      ? `${a.karigars?.full_name}: recent ${fmtPct(a.recent_loss_percent)} vs earlier ${fmtPct(a.historical_loss_percent)}`
                      : `${a.karigars?.full_name}: ${fmtGrams(a.actual_loss)} vs ${fmtGrams(a.expected_loss)} allowed`
                  }
                  meta={`${a.gold_issues?.transaction_number ?? "Trend"} · excess ${fmtGrams(a.excess_loss)}`}
                />
              ))}
              {overdue.slice(0, 3).map((i) => (
                <AlertCard
                  key={i.id}
                  tone="neutral"
                  title="Return overdue"
                  body={`${i.transaction_number} · ${fmtGrams(i.fine_weight)} issued ${fmtDate(i.issue_date)}`}
                  meta={`${i.karigars?.full_name} · open > ${OVERDUE_DAYS} days`}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Karigar performance"
        subtitle="Fine gold · loss % from closed issues"
      >
        <QueryState q={balances}>
          {(rows) => (
            <DataTable
              rows={rows}
              emptyTitle="No karigars yet"
              columns={[
                {
                  key: "name",
                  header: "Karigar",
                  primary: true,
                  render: (r) => <span className="font-medium">{r.full_name}</span>,
                },
                {
                  key: "jobs",
                  header: "Jobs in progress",
                  numeric: true,
                  render: (r) => r.open_jobs,
                },
                {
                  key: "issued",
                  header: "Fine gold issued",
                  numeric: true,
                  render: (r) => fmtGrams(r.fine_issued),
                },
                {
                  key: "ret",
                  header: "Fine gold returned",
                  numeric: true,
                  render: (r) => fmtGrams(r.fine_returned),
                },
                {
                  key: "out",
                  header: "Outstanding",
                  emphasis: true,
                  numeric: true,
                  render: (r) => <span className="font-semibold">{fmtGrams(r.outstanding)}</span>,
                },
                {
                  key: "w",
                  header: "Wastage %",
                  numeric: true,
                  render: (r) =>
                    r.closed_loss_percent === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <StatusBadge tone="neutral">{fmtPct(r.closed_loss_percent)}</StatusBadge>
                    ),
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>
    </>
  );
}
