import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrendingUp, Minus, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DemoBadge } from "@/components/auric/app-shell";
import { Panel, StatusBadge } from "@/components/auric/primitives";
import { DataTable } from "@/components/auric/data-table";
import { QueryState } from "@/components/auric/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { alertsQuery, lossSettingsQuery, trendsQuery } from "@/lib/queries";
import { fmtDate, fmtGrams, fmtPct } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/_finance/loss-alerts")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      { name: "description", content: "Closed-job wastage, trends and items for finance review." },
      { property: "og:title", content: "Loss Review · AURIC" },
      {
        property: "og:description",
        content: "Closed-job wastage, trends and items for finance review.",
      },
    ],
  }),
  component: Page,
});

type Alert = Awaited<ReturnType<NonNullable<typeof alertsQuery.queryFn>>>[number];

const TYPE_LABEL: Record<string, string> = {
  excess_wastage: "Wastage above agreed limit",
  rising_trend: "Recent wastage above usual level",
};

function Page() {
  const alerts = useQuery(alertsQuery);
  const trends = useQuery(trendsQuery);
  const [reviewing, setReviewing] = useState<Alert | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const open = (alerts.data ?? []).filter((a) => a.status === "open");
  const done = (alerts.data ?? []).filter((a) => a.status !== "open");

  return (
    <>
      <PageHeader
        title="Loss Review"
        description="Items worth a closer look. These are prompts for review with the karigar, not findings of fault."
        badge={<DemoBadge show={!!alerts.data?.some((a) => a.is_demo)} />}
        actions={
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" />
            Thresholds
          </Button>
        }
      />

      <Panel title="Review items" subtitle={`${open.length} awaiting review`}>
        <QueryState q={alerts}>
          {() => (
            <DataTable
              rows={open}
              emptyTitle="Nothing to review"
              emptyBody="Items appear when a closed job exceeds its agreed wastage or recent wastage rises above a karigar's usual level."
              columns={[
                {
                  key: "k",
                  header: "Karigar",
                  primary: true,
                  render: (r) => <span className="font-medium">{r.karigars?.full_name}</span>,
                },
                {
                  key: "t",
                  header: "Reason",
                  render: (r) => TYPE_LABEL[r.alert_type] ?? r.alert_type,
                },
                {
                  key: "i",
                  header: "Reference",
                  render: (r) => (
                    <span className="num">
                      {r.gold_issues?.transaction_number ??
                        (r.recent_loss_percent !== null
                          ? `${fmtPct(r.recent_loss_percent)} vs ${fmtPct(r.historical_loss_percent)}`
                          : "—")}
                    </span>
                  ),
                },
                {
                  key: "ex",
                  header: "Excess fine",
                  numeric: true,
                  emphasis: true,
                  render: (r) => <span className="font-semibold">{fmtGrams(r.excess_loss)}</span>,
                },
                { key: "d", header: "Raised", render: (r) => fmtDate(r.created_at) },
                {
                  key: "a",
                  header: "",
                  numeric: true,
                  render: (r) => (
                    <Button size="sm" variant="outline" onClick={() => setReviewing(r)}>
                      Review
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>

      <Panel
        className="mt-6"
        title="Closed-job wastage by karigar"
        subtitle="Recent jobs compared with the same karigar's earlier closed jobs. Only real closed jobs are counted."
      >
        <QueryState q={trends}>
          {(rows) => (
            <DataTable
              rows={rows}
              columns={[
                {
                  key: "k",
                  header: "Karigar",
                  primary: true,
                  render: (r) => <span className="font-medium">{r.full_name}</span>,
                },
                { key: "n", header: "Closed jobs", numeric: true, render: (r) => r.closed_jobs },
                {
                  key: "r",
                  header: "Recent %",
                  numeric: true,
                  render: (r) => (r.recent_percent === null ? "—" : fmtPct(r.recent_percent)),
                },
                {
                  key: "h",
                  header: "Earlier %",
                  numeric: true,
                  render: (r) =>
                    r.historical_percent === null ? (
                      <span className="text-muted-foreground">Not enough history</span>
                    ) : (
                      fmtPct(r.historical_percent)
                    ),
                },
                {
                  key: "x",
                  header: "Recent excess",
                  numeric: true,
                  emphasis: true,
                  render: (r) => fmtGrams(r.recent_excess),
                },
                {
                  key: "t",
                  header: "Trend",
                  render: (r) =>
                    r.is_rising ? (
                      <StatusBadge tone="warning">
                        <TrendingUp className="size-3" />
                        Rising
                      </StatusBadge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Minus className="size-3" />
                        {Number(r.closed_jobs) === 0 ? "No closed jobs" : "Steady"}
                      </span>
                    ),
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>

      {done.length > 0 && (
        <Panel className="mt-6" title="Reviewed">
          <DataTable
            rows={done}
            columns={[
              { key: "k", header: "Karigar", primary: true, render: (r) => r.karigars?.full_name },
              {
                key: "t",
                header: "Reason",
                render: (r) => TYPE_LABEL[r.alert_type] ?? r.alert_type,
              },
              {
                key: "ex",
                header: "Excess fine",
                numeric: true,
                render: (r) => fmtGrams(r.excess_loss),
              },
              {
                key: "s",
                header: "Outcome",
                render: (r) => <StatusBadge tone="neutral">{r.status}</StatusBadge>,
              },
              {
                key: "n",
                header: "Note",
                render: (r) => (
                  <span className="whitespace-normal text-muted-foreground">
                    {r.review_note ?? "—"}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      )}

      {reviewing && <ReviewDialog alert={reviewing} onClose={() => setReviewing(null)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

function ReviewDialog({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: async (status: "acknowledged" | "resolved") => {
      const { error } = await supabase.rpc("review_loss_alert", {
        _id: alert.id,
        _status: status,
        _note: note,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Review recorded");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      onClose();
    },
    onError: (e) => toast.error("Could not save review", { description: e.message }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review: {alert.karigars?.full_name}</DialogTitle>
          <DialogDescription>
            {TYPE_LABEL[alert.alert_type]}. Record the outcome of your conversation or check.
          </DialogDescription>
        </DialogHeader>
        <dl className="num grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
          <div>
            <dt className="label-caps">Allowed</dt>
            <dd>{fmtGrams(alert.expected_loss)}</dd>
          </div>
          <div>
            <dt className="label-caps">Actual</dt>
            <dd>{fmtGrams(alert.actual_loss)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="label-caps">Excess fine</dt>
            <dd className="text-lg font-semibold">{fmtGrams(alert.excess_loss)}</dd>
          </div>
        </dl>
        <div className="space-y-1.5">
          <Label>Note</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. Intricate filigree; agreed with karigar"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => m.mutate("acknowledged")} disabled={m.isPending}>
            Acknowledge
          </Button>
          <Button onClick={() => m.mutate("resolved")} disabled={m.isPending}>
            Mark resolved
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const s = useQuery(lossSettingsQuery);
  const d = s.data as Tables<"loss_settings"> | undefined;
  const [f, setF] = useState<Record<string, string> | null>(null);
  const v =
    f ??
    (d
      ? {
          recent_window: String(d.recent_window),
          min_history_jobs: String(d.min_history_jobs),
          trend_ratio: Number(d.trend_ratio).toFixed(2),
          min_excess_points: Number(d.min_excess_points).toFixed(2),
        }
      : null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...(v ?? {}), [k]: e.target.value });
  const m = useMutation({
    mutationFn: async () => {
      if (!v) return;
      const { error } = await supabase.rpc("save_loss_settings", {
        _recent_window: parseInt(v["recent_window"] ?? "", 10),
        _min_history_jobs: parseInt(v["min_history_jobs"] ?? "", 10),
        _trend_ratio: Number(v["trend_ratio"]),
        _min_excess_points: Number(v["min_excess_points"]),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Thresholds saved");
      qc.invalidateQueries({ queryKey: ["loss-settings"] });
      qc.invalidateQueries({ queryKey: ["trends"] });
      onClose();
    },
    onError: (e) => toast.error("Could not save thresholds", { description: e.message }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review thresholds</DialogTitle>
          <DialogDescription>
            A karigar is flagged when recent wastage is at least the ratio × their earlier average
            and higher by the minimum points.
          </DialogDescription>
        </DialogHeader>
        {!v ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Recent jobs compared</Label>
              <Input
                inputMode="numeric"
                className="num text-right"
                value={v["recent_window"]}
                onChange={set("recent_window")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min. earlier jobs</Label>
              <Input
                inputMode="numeric"
                className="num text-right"
                value={v["min_history_jobs"]}
                onChange={set("min_history_jobs")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Trend ratio (×)</Label>
              <Input
                inputMode="decimal"
                className="num text-right"
                value={v["trend_ratio"]}
                onChange={set("trend_ratio")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min. increase (% points)</Label>
              <Input
                inputMode="decimal"
                className="num text-right"
                value={v["min_excess_points"]}
                onChange={set("min_excess_points")}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={m.isPending}>
                Save thresholds
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
