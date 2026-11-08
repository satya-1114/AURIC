import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/auric/app-shell";
import { Panel, StatusBadge } from "@/components/auric/primitives";
import { DataTable } from "@/components/auric/data-table";
import { QueryState } from "@/components/auric/query-state";
import { ConfirmDialog, SummaryRow } from "@/components/auric/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { allCategoriesQuery, categoryAuditQuery } from "@/lib/queries";
import { fmtDate, fmtPurity } from "@/lib/format";
import { wastageField } from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/_finance/categories")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      { name: "description", content: "Agreed wastage limits per jewellery category." },
      { property: "og:title", content: "Item Categories · AURIC" },
      { property: "og:description", content: "Agreed wastage limits per jewellery category." },
    ],
  }),
  component: Page,
});

type Cat = Tables<"item_categories">;

function Page() {
  const q = useQuery(allCategoriesQuery);
  const audit = useQuery(categoryAuditQuery);
  const [editing, setEditing] = useState<Cat | "new" | null>(null);
  return (
    <>
      <PageHeader
        title="Item Categories"
        description="Agreed wastage limits. New issues copy the limit at the time of issue; changes never alter past issues."
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add category
          </Button>
        }
      />
      <p className="mb-4 rounded-md border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-foreground">
        The starting percentages are illustrative demo values, not confirmed workshop agreements.
        Review them before live use.
      </p>
      <Panel>
        <QueryState q={q}>
          {(rows) => (
            <DataTable
              rows={rows}
              columns={[
                {
                  key: "n",
                  header: "Category",
                  primary: true,
                  render: (r) => <span className="font-medium">{r.category_name}</span>,
                },
                {
                  key: "w",
                  header: "Allowed wastage",
                  numeric: true,
                  emphasis: true,
                  render: (r) => (
                    <span className="font-semibold">{fmtPurity(r.allowed_wastage_percent)}%</span>
                  ),
                },
                {
                  key: "s",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge tone={r.is_active ? "success" : "neutral"}>
                      {r.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  ),
                },
                {
                  key: "a",
                  header: "",
                  numeric: true,
                  render: (r) => (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Panel>
      <Panel className="mt-6" title="Change history" subtitle="Every category change is recorded.">
        <QueryState q={audit}>
          {(rows) => (
            <DataTable
              rows={rows}
              emptyTitle="No changes yet"
              emptyBody="Edits to categories will be listed here."
              columns={[
                { key: "d", header: "When", primary: true, render: (r) => fmtDate(r.created_at) },
                {
                  key: "a",
                  header: "Action",
                  render: (r) => <span className="capitalize">{r.action}</span>,
                },
                { key: "c", header: "Change", render: (r) => <AuditChange details={r.details} /> },
              ]}
            />
          )}
        </QueryState>
      </Panel>
      {editing && (
        <CategoryDialog cat={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function AuditChange({ details }: { details: unknown }) {
  const d = details as {
    before?: Cat;
    after?: Cat;
    category_name?: string;
    allowed_wastage_percent?: number;
  } | null;
  if (d?.before && d.after) {
    return (
      <span className="num">
        {d.after.category_name}: {fmtPurity(d.before.allowed_wastage_percent)}% →{" "}
        {fmtPurity(d.after.allowed_wastage_percent)}%
        {d.before.is_active !== d.after.is_active
          ? d.after.is_active
            ? " · activated"
            : " · deactivated"
          : ""}
      </span>
    );
  }
  return (
    <span className="num">
      {d?.category_name} · {fmtPurity(d?.allowed_wastage_percent ?? 0)}%
    </span>
  );
}

function CategoryDialog({ cat, onClose }: { cat: Cat | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(cat?.category_name ?? "");
  const [pct, setPct] = useState(cat ? fmtPurity(cat.allowed_wastage_percent) : "");
  const [active, setActive] = useState(cat?.is_active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("save_item_category", {
        _id: cat?.id ?? (null as unknown as string),
        _category_name: name.trim(),
        _allowed_wastage_percent: Number(pct),
        _is_active: active,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`${d.category_name} saved`);
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      onClose();
    },
    onError: (e) => toast.error("Could not save category", { description: e.message }),
  });

  function review(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Category name is required");
    const p = wastageField.safeParse(pct);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? "Invalid wastage");
    setErr(null);
    setConfirm(true);
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{cat ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>
              Existing gold issues keep the wastage limit agreed when they were issued.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={review} className="grid gap-4" noValidate>
            <div className="space-y-1.5">
              <Label>Category name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label>Allowed wastage (%)</Label>
              <Input
                inputMode="decimal"
                className="num text-right"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="cat-active">Active</Label>
              <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Review change</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save category change?"
        confirmLabel={save.isPending ? "Saving…" : "Save"}
        onConfirm={() => save.mutate()}
      >
        <p>This change is recorded in the audit log and applies to new issues only.</p>
        <div className="mt-3 rounded-md border px-3 py-1">
          <SummaryRow label="Category" value={name} />
          {cat && (
            <SummaryRow
              label="Current limit"
              value={`${fmtPurity(cat.allowed_wastage_percent)}%`}
            />
          )}
          <SummaryRow label="New limit" value={`${Number(pct).toFixed(2)}%`} />
          <SummaryRow label="Status" value={active ? "Active" : "Inactive"} />
        </div>
      </ConfirmDialog>
    </>
  );
}
