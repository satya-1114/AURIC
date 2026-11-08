import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DemoBadge } from "@/components/auric/app-shell";
import { Panel } from "@/components/auric/primitives";
import { DataTable } from "@/components/auric/data-table";
import { QueryState } from "@/components/auric/query-state";
import { ConfirmDialog, SummaryRow } from "@/components/auric/confirm";
import { Button } from "@/components/ui/button";
import { balancesQuery, issuesQuery, receiptsQuery } from "@/lib/queries";
import { fmtDate, fmtGrams, fmtPurity } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_finance/balances")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      { name: "description", content: "Outstanding fine gold for each karigar and open issue." },
      { property: "og:title", content: "Balances · AURIC" },
      {
        property: "og:description",
        content: "Outstanding fine gold for each karigar and open issue.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const balances = useQuery(balancesQuery);
  const issues = useQuery(issuesQuery);
  const receipts = useQuery(receiptsQuery);
  const qc = useQueryClient();
  const [closing, setClosing] = useState<string | null>(null);

  // Display only; the server recomputes the outstanding balance when closing.
  const received = (id: string) =>
    (receipts.data ?? [])
      .filter((r) => r.issue_id === id)
      .reduce((a, r) => a + Math.round(Number(r.fine_weight) * 1000), 0);
  const openIssues = (issues.data ?? [])
    .filter((i) => i.status === "open")
    .map((i) => ({
      ...i,
      out: (Math.round(Number(i.fine_weight) * 1000) - received(i.id)) / 1000,
    }));
  const target = openIssues.find((i) => i.id === closing);

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("close_gold_issue", { _issue_id: id });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`${d.transaction_number} closed`);
      qc.invalidateQueries();
    },
    onError: (e) => toast.error("Could not close issue", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Balances"
        description="Fine gold held by each karigar."
        badge={<DemoBadge show={!!balances.data?.some((b) => b.is_demo)} />}
      />
      <Panel title="By karigar">
        <QueryState q={balances}>
          {(rows) => (
            <DataTable
              rows={rows}
              columns={[
                {
                  key: "code",
                  header: "Code",
                  render: (r) => (
                    <span className="num text-muted-foreground">{r.karigar_code}</span>
                  ),
                },
                {
                  key: "name",
                  header: "Karigar",
                  primary: true,
                  render: (r) => <span className="font-medium">{r.full_name}</span>,
                },
                { key: "jobs", header: "Open jobs", numeric: true, render: (r) => r.open_jobs },
                {
                  key: "iss",
                  header: "Issued",
                  numeric: true,
                  render: (r) => fmtGrams(r.fine_issued),
                },
                {
                  key: "ret",
                  header: "Returned",
                  numeric: true,
                  render: (r) => fmtGrams(r.fine_returned),
                },
                {
                  key: "adj",
                  header: "Adjustments",
                  numeric: true,
                  render: (r) => fmtGrams(r.fine_adjusted),
                },
                {
                  key: "out",
                  header: "Outstanding",
                  numeric: true,
                  emphasis: true,
                  render: (r) => (
                    <span
                      className={
                        Number(r.outstanding) > 0
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {fmtGrams(r.outstanding)}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>
      <Panel
        className="mt-6"
        title="Open issues"
        subtitle="Closing an issue books the remaining balance as wastage and raises an alert if it exceeds the agreed limit."
      >
        <QueryState q={issues}>
          {() => (
            <DataTable
              rows={openIssues}
              emptyTitle="No open issues"
              columns={[
                {
                  key: "tx",
                  header: "Transaction",
                  render: (r) => <span className="num font-medium">{r.transaction_number}</span>,
                },
                { key: "k", header: "Karigar", render: (r) => r.karigars?.full_name },
                { key: "d", header: "Issued", render: (r) => fmtDate(r.issue_date) },
                {
                  key: "fine",
                  header: "Fine issued",
                  numeric: true,
                  render: (r) => fmtGrams(r.fine_weight),
                },
                {
                  key: "allow",
                  header: "Allowed %",
                  numeric: true,
                  render: (r) => fmtPurity(r.allowed_wastage_percent),
                },
                {
                  key: "out",
                  header: "Outstanding",
                  numeric: true,
                  emphasis: true,
                  render: (r) => <span className="font-semibold">{fmtGrams(r.out)}</span>,
                },
                {
                  key: "a",
                  header: "",
                  numeric: true,
                  render: (r) => (
                    <Button size="sm" variant="outline" onClick={() => setClosing(r.id)}>
                      Close
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>
      <ConfirmDialog
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        title="Close this issue?"
        confirmLabel="Close issue"
        onConfirm={() => {
          if (closing) close.mutate(closing);
          setClosing(null);
        }}
      >
        <p>
          No further receipts can be recorded against it. The outstanding balance becomes wastage.
        </p>
        {target && (
          <div className="mt-3 rounded-md border px-3 py-1">
            <SummaryRow label="Issue" value={target.transaction_number} />
            <SummaryRow label="Karigar" value={target.karigars?.full_name} />
            <SummaryRow label="Outstanding" value={fmtGrams(target.out)} />
            <SummaryRow
              label="Allowed"
              value={fmtGrams(
                Math.round(
                  Number(target.fine_weight) * Number(target.allowed_wastage_percent) * 10,
                ) / 1000,
              )}
            />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
