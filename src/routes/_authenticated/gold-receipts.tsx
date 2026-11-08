import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DemoBadge } from "@/components/auric/app-shell";
import { Panel, StatusBadge } from "@/components/auric/primitives";
import { DataTable } from "@/components/auric/data-table";
import { QueryState } from "@/components/auric/query-state";
import { ConfirmDialog, SummaryRow } from "@/components/auric/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { issuesQuery, receiptsQuery } from "@/lib/queries";
import { fmtDate, fmtGrams, fmtPurity, todayISO } from "@/lib/format";
import { previewFineWeight } from "@/lib/gold-math";
import { purityField, weightField } from "@/lib/validation";
import { PhotoReader } from "@/components/auric/photo-reader";

export const Route = createFileRoute("/_authenticated/gold-receipts")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      {
        name: "description",
        content: "Finished jewellery, scrap and filings received from karigars.",
      },
      { property: "og:title", content: "Gold Receipts · AURIC" },
      {
        property: "og:description",
        content: "Finished jewellery, scrap and filings received from karigars.",
      },
    ],
  }),
  component: Page,
});

const TYPES = { jewellery: "Jewellery", scrap: "Scrap", filings: "Filings" } as const;
type RType = keyof typeof TYPES;

const schema = z.object({
  issue_id: z.string().uuid("Select an open issue"),
  receipt_type: z.enum(["jewellery", "scrap", "filings"]),
  gross_weight: weightField,
  purity_percent: purityField,
  huid: z
    .string()
    .trim()
    .regex(/^([A-Za-z0-9]{6})?$/, "HUID is 6 letters/digits")
    .optional(),
  receipt_date: z.string().refine((v) => v <= todayISO(), "Cannot be in the future"),
});
type Form = z.infer<typeof schema>;

function Page() {
  const q = useQuery(receiptsQuery);
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Gold Receipts"
        description="Gold returned by karigars against open issues."
        badge={<DemoBadge show={!!q.data?.some((r) => r.is_demo)} />}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New receipt
          </Button>
        }
      />
      <Panel>
        <QueryState q={q}>
          {(rows) => (
            <DataTable
              rows={rows}
              emptyTitle="No receipts yet"
              columns={[
                {
                  key: "tx",
                  header: "Transaction",
                  render: (r) => <span className="num font-medium">{r.transaction_number}</span>,
                },
                { key: "date", header: "Date", render: (r) => fmtDate(r.receipt_date) },
                { key: "k", header: "Karigar", render: (r) => r.karigars?.full_name },
                {
                  key: "iss",
                  header: "Against",
                  render: (r) => (
                    <span className="num text-muted-foreground">
                      {r.gold_issues?.transaction_number}
                    </span>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  render: (r) => (
                    <StatusBadge tone={r.receipt_type === "jewellery" ? "gold" : "neutral"}>
                      {TYPES[r.receipt_type as RType]}
                    </StatusBadge>
                  ),
                },
                {
                  key: "gross",
                  header: "Gross",
                  numeric: true,
                  render: (r) => fmtGrams(r.gross_weight),
                },
                {
                  key: "purity",
                  header: "Purity %",
                  numeric: true,
                  render: (r) => fmtPurity(r.purity_percent),
                },
                {
                  key: "fine",
                  header: "Fine",
                  emphasis: true,
                  numeric: true,
                  render: (r) => <span className="font-semibold">{fmtGrams(r.fine_weight)}</span>,
                },
                {
                  key: "huid",
                  header: "HUID",
                  render: (r) => <span className="num">{r.huid ?? "—"}</span>,
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>
      <ReceiptDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

const empty = (): Form => ({
  issue_id: "",
  receipt_type: "jewellery",
  gross_weight: "",
  purity_percent: "91.60",
  huid: "",
  receipt_date: todayISO(),
});

function ReceiptDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const issues = useQuery(issuesQuery);
  const openIssues = issues.data?.filter((i) => i.status === "open") ?? [];
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [confirm, setConfirm] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [photoBlocked, setPhotoBlocked] = useState(false);
  const fine = previewFineWeight(form.gross_weight, form.purity_percent);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const iss = openIssues.find((i) => i.id === form.issue_id);

  const m = useMutation({
    mutationFn: async (f: Form) => {
      if (photoBlocked) throw new Error("Resolve the photo reading before recording.");
      const { data, error } = await supabase.rpc("create_gold_receipt", {
        _issue_id: f.issue_id,
        _receipt_type: f.receipt_type,
        _gross_weight: Number(f.gross_weight),
        _purity_percent: Number(f.purity_percent),
        _huid: f.huid ?? "",
        _receipt_date: f.receipt_date,
        _client_request_id: requestId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Receipt ${d.transaction_number} recorded`, {
        description: `${fmtGrams(d.fine_weight)} fine gold`,
      });
      qc.invalidateQueries();
      setForm(empty());
      setRequestId(crypto.randomUUID());
      onOpenChange(false);
    },
    onError: (e) => toast.error("Could not record receipt", { description: e.message }),
  });

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (photoBlocked) {
      toast.error("Confirm, reject or resolve the photo reading first.");
      return;
    }
    const p = schema.safeParse(form);
    if (!p.success) {
      setErrors(Object.fromEntries(p.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setConfirm(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New gold receipt</DialogTitle>
            <DialogDescription>
              The server rejects receipts that exceed the issue's outstanding fine gold.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={review} className="grid gap-4 sm:grid-cols-2" noValidate>
            <PhotoReader
              key={requestId}
              requestId={requestId}
              operation="receipt"
              weight={form.gross_weight}
              purity={form.purity_percent}
              onBlocked={setPhotoBlocked}
              onApply={(weight, purity) =>
                setForm((f) => ({
                  ...f,
                  gross_weight: weight ? Number(weight).toFixed(3) : f.gross_weight,
                  purity_percent: purity ? Number(purity).toFixed(2) : f.purity_percent,
                }))
              }
            />
            <F label="Against issue" error={errors.issue_id} className="sm:col-span-2">
              <Select value={form.issue_id} onValueChange={set("issue_id")}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={openIssues.length ? "Select open issue" : "No open issues"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {openIssues.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.transaction_number} · {i.karigars?.full_name} · {fmtGrams(i.fine_weight)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </F>
            <F label="Receipt type" error={errors.receipt_type}>
              <Select value={form.receipt_type} onValueChange={set("receipt_type")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPES).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </F>
            <F label="Receipt date" error={errors.receipt_date}>
              <Input
                type="date"
                max={todayISO()}
                value={form.receipt_date}
                onChange={(e) => set("receipt_date")(e.target.value)}
              />
            </F>
            <F label="Gross weight (g)" error={errors.gross_weight}>
              <Input
                inputMode="decimal"
                className="num text-right"
                value={form.gross_weight}
                onChange={(e) => set("gross_weight")(e.target.value)}
                placeholder="0.000"
              />
            </F>
            <F label="Purity (%)" error={errors.purity_percent}>
              <Input
                inputMode="decimal"
                className="num text-right"
                value={form.purity_percent}
                onChange={(e) => set("purity_percent")(e.target.value)}
              />
            </F>
            <F label="HUID (optional)" error={errors.huid}>
              <Input
                className="num uppercase"
                maxLength={6}
                value={form.huid}
                onChange={(e) => set("huid")(e.target.value)}
              />
            </F>
            <div className="rounded-md border bg-muted/50 px-3 py-2">
              <p className="label-caps">Fine weight (preview)</p>
              <p className="num mt-1 text-lg font-semibold">{fine ? `${fine} g` : "—"}</p>
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={photoBlocked || m.isPending}>
                Review receipt
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Confirm gold receipt"
        confirmLabel={m.isPending ? "Recording…" : "Record receipt"}
        onConfirm={() => m.mutate(form)}
      >
        <p>This creates a permanent record. It cannot be edited or deleted.</p>
        <div className="mt-3 rounded-md border px-3 py-1">
          <SummaryRow
            label="Issue"
            value={`${iss?.transaction_number ?? ""} · ${iss?.karigars?.full_name ?? ""}`}
          />
          <SummaryRow label="Type" value={TYPES[form.receipt_type]} />
          <SummaryRow label="Gross" value={`${form.gross_weight} g`} />
          <SummaryRow label="Purity" value={`${form.purity_percent}%`} />
          <SummaryRow label="Fine (preview)" value={`${fine} g`} />
        </div>
      </ConfirmDialog>
    </>
  );
}

function F({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
