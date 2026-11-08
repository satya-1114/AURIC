import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/auric/app-shell";
import { Panel } from "@/components/auric/primitives";
import { DataTable } from "@/components/auric/data-table";
import { QueryState } from "@/components/auric/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stockQuery } from "@/lib/queries";
import { daysAgoISO, fmtDate, fmtGrams, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_finance/stock-statement")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      {
        name: "description",
        content: "Daily fine gold movement and closing balance with karigars.",
      },
      { property: "og:title", content: "Stock Statement · AURIC" },
      {
        property: "og:description",
        content: "Daily fine gold movement and closing balance with karigars.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const [from, setFrom] = useState(daysAgoISO(13));
  const [to, setTo] = useState(todayISO());
  const valid = from <= to;
  const q = useQuery({ ...stockQuery(from, to), enabled: valid });

  function exportCsv() {
    if (!q.data) return;
    const head = [
      "Date",
      "Issued",
      "Jewellery",
      "Scrap",
      "Filings",
      "Adjustments",
      "Net",
      "Closing with karigars",
    ];
    // Values come straight from the database NUMERIC strings/numbers; no float arithmetic.
    const lines = q.data.map((d) =>
      [
        d.day,
        d.issued,
        d.received_jewellery,
        d.received_scrap,
        d.received_filings,
        d.adjustments,
        d.net_movement,
        d.closing_with_karigars,
      ]
        .map((v) => (typeof v === "number" ? v.toFixed(3) : v))
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auric-stock-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Stock statement exported");
  }

  return (
    <>
      <PageHeader
        title="Stock Statement"
        description="Daily fine gold movement through the workshop."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!q.data}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>From</Label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>To</Label>
          <Input type="date" value={to} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
        </div>
        {!valid && (
          <p className="pb-2 text-sm text-destructive">Start date must be before end date.</p>
        )}
      </div>
      <Panel>
        <QueryState q={q}>
          {(rows) => (
            <DataTable
              rows={[...rows].reverse()}
              columns={[
                { key: "d", header: "Date", render: (r) => fmtDate(r.day) },
                { key: "i", header: "Issued", numeric: true, render: (r) => fmtGrams(r.issued) },
                {
                  key: "j",
                  header: "Jewellery",
                  numeric: true,
                  render: (r) => fmtGrams(r.received_jewellery),
                },
                {
                  key: "s",
                  header: "Scrap",
                  numeric: true,
                  render: (r) => fmtGrams(r.received_scrap),
                },
                {
                  key: "f",
                  header: "Filings",
                  numeric: true,
                  render: (r) => fmtGrams(r.received_filings),
                },
                {
                  key: "a",
                  header: "Adjust.",
                  numeric: true,
                  render: (r) => fmtGrams(r.adjustments),
                },
                {
                  key: "n",
                  header: "Net",
                  numeric: true,
                  render: (r) => (
                    <span className={Number(r.net_movement) < 0 ? "text-success" : ""}>
                      {fmtGrams(r.net_movement)}
                    </span>
                  ),
                },
                {
                  key: "c",
                  header: "With karigars",
                  numeric: true,
                  render: (r) => (
                    <span className="font-semibold">{fmtGrams(r.closing_with_karigars)}</span>
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
