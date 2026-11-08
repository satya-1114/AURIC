import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
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
import { categoriesQuery, issuesQuery, karigarsQuery } from "@/lib/queries";
import { fmtDate, fmtGrams, fmtPurity, todayISO } from "@/lib/format";
import { previewFineWeight } from "@/lib/gold-math";
import { purityField, weightField } from "@/lib/validation";
import { PhotoReader } from "@/components/auric/photo-reader";

export const Route = createFileRoute("/_authenticated/gold-issues")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      { name: "description", content: "Fine gold issued to karigars against job orders." },
      { property: "og:title", content: "Gold Issues · AURIC" },
      { property: "og:description", content: "Fine gold issued to karigars against job orders." },
    ],
  }),
  component: Page,
});

const schema = z.object({
  karigar_id: z.string().uuid("Select a karigar"),
  item_category_id: z.string().uuid("Select a category"),
  job_number: z.string().trim().min(1, "Job number is required").max(40),
  gross_weight: weightField,
  purity_percent: purityField,
  issue_date: z.string().refine((v) => v <= todayISO(), "Cannot be in the future"),
});
type Form = z.infer<typeof schema>;

function Page() {
  const q = useQuery(issuesQuery);
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Gold Issues"
        description="Fine gold issued to karigars. Records are permanent; corrections are logged as adjustments."
        badge={<DemoBadge show={!!q.data?.some((r) => r.is_demo)} />}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New issue
          </Button>
        }
      />
      <Panel>
        <QueryState q={q}>
          {(rows) => (
            <DataTable
              rows={rows}
              emptyTitle="No gold issued yet"
              emptyBody="Create the first issue to start tracking."
              columns={[
                {
                  key: "tx",
                  header: "Transaction",
                  render: (r) => <span className="num font-medium">{r.transaction_number}</span>,
                },
                { key: "date", header: "Date", render: (r) => fmtDate(r.issue_date) },
                { key: "k", header: "Karigar", render: (r) => r.karigars?.full_name },
                {
                  key: "job",
                  header: "Job / Item",
                  render: (r) => (
                    <span>
                      {r.job_number}{" "}
                      <span className="text-muted-foreground">
                        · {r.item_categories?.category_name}
                      </span>
                    </span>
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
                  key: "st",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge tone={r.status === "open" ? "gold" : "neutral"}>
                      {r.status === "open" ? "Open" : "Closed"}
                    </StatusBadge>
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>
      <IssueDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

const empty = (): Form => ({
  karigar_id: "",
  item_category_id: "",
  job_number: "",
  gross_weight: "",
  purity_percent: "91.60",
  issue_date: todayISO(),
});

function IssueDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const karigars = useQuery(karigarsQuery);
  const cats = useQuery(categoriesQuery);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [confirm, setConfirm] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [photoBlocked, setPhotoBlocked] = useState(false);
  const fine = previewFineWeight(form.gross_weight, form.purity_percent);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const m = useMutation({
    mutationFn: async (f: Form) => {
      if (photoBlocked) throw new Error("Resolve the photo reading before recording.");
      const { data, error } = await supabase.rpc("create_gold_issue", {
        _karigar_id: f.karigar_id,
        _item_category_id: f.item_category_id,
        _job_number: f.job_number,
        _gross_weight: Number(f.gross_weight),
        _purity_percent: Number(f.purity_percent),
        _issue_date: f.issue_date,
        _client_request_id: requestId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Issue ${d.transaction_number} recorded`, {
        description: `${fmtGrams(d.fine_weight)} fine gold`,
      });
      qc.invalidateQueries();
      setForm(empty());
      setRequestId(crypto.randomUUID());
      onOpenChange(false);
    },
    onError: (e) => toast.error("Could not record issue", { description: e.message }),
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
  const kName = karigars.data?.find((k) => k.id === form.karigar_id)?.full_name;
  const cat = cats.data?.find((c) => c.id === form.item_category_id);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New gold issue</DialogTitle>
            <DialogDescription>
              Fine weight is calculated and stored by the server.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={review} className="grid gap-4 sm:grid-cols-2" noValidate>
            <PhotoReader
              key={requestId}
              requestId={requestId}
              operation="issue"
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
            <Field label="Karigar" error={errors.karigar_id} className="sm:col-span-2">
              <Select value={form.karigar_id} onValueChange={set("karigar_id")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select karigar" />
                </SelectTrigger>
                <SelectContent>
                  {karigars.data
                    ?.filter((k) => k.is_active)
                    .map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.full_name} · {k.karigar_code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Item category" error={errors.item_category_id}>
              <Select value={form.item_category_id} onValueChange={set("item_category_id")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {cats.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.category_name} · {fmtPurity(c.allowed_wastage_percent)}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Job number" error={errors.job_number}>
              <Input
                value={form.job_number}
                onChange={(e) => set("job_number")(e.target.value)}
                maxLength={40}
              />
            </Field>
            <Field label="Gross weight (g)" error={errors.gross_weight}>
              <Input
                inputMode="decimal"
                className="num text-right"
                value={form.gross_weight}
                onChange={(e) => set("gross_weight")(e.target.value)}
                placeholder="0.000"
              />
            </Field>
            <Field label="Purity (%)" error={errors.purity_percent}>
              <Input
                inputMode="decimal"
                className="num text-right"
                value={form.purity_percent}
                onChange={(e) => set("purity_percent")(e.target.value)}
              />
            </Field>
            <Field label="Issue date" error={errors.issue_date}>
              <Input
                type="date"
                max={todayISO()}
                value={form.issue_date}
                onChange={(e) => set("issue_date")(e.target.value)}
              />
            </Field>
            <div className="rounded-md border bg-muted/50 px-3 py-2">
              <p className="label-caps">Fine weight (preview)</p>
              <p className="num mt-1 text-lg font-semibold">{fine ? `${fine} g` : "—"}</p>
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={photoBlocked || m.isPending}>
                Review issue
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Confirm gold issue"
        confirmLabel={m.isPending ? "Recording…" : "Record issue"}
        onConfirm={() => m.mutate(form)}
      >
        <p>This creates a permanent record. It cannot be edited or deleted.</p>
        <div className="mt-3 rounded-md border px-3 py-1">
          <SummaryRow label="Karigar" value={kName} />
          <SummaryRow label="Item" value={`${cat?.category_name ?? ""} · ${form.job_number}`} />
          <SummaryRow label="Gross" value={`${form.gross_weight} g`} />
          <SummaryRow label="Purity" value={`${form.purity_percent}%`} />
          <SummaryRow label="Fine (preview)" value={`${fine} g`} />
        </div>
      </ConfirmDialog>
      {m.isPending && (
        <span className="sr-only">
          <Loader2 />
        </span>
      )}
    </>
  );
}

export function Field({
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
