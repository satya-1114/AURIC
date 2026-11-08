import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Pencil, Power, Trash2 } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { karigarsQuery, meQuery, outstandingQuery } from "@/lib/queries";
import { fmtGrams } from "@/lib/format";
import { karigarSchema } from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/karigars")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      {
        name: "description",
        content: "Workshop artisans, their status and outstanding fine gold.",
      },
      { property: "og:title", content: "Karigars · AURIC" },
      {
        property: "og:description",
        content: "Workshop artisans, their status and outstanding fine gold.",
      },
    ],
  }),
  component: Page,
});

type Karigar = Tables<"karigars">;
type Filter = "all" | "active" | "inactive";

function Page() {
  const q = useQuery(karigarsQuery);
  const out = useQuery(outstandingQuery);
  const me = useQuery(meQuery);
  const canManage = me.data?.role === "finance_head";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<Karigar | "new" | null>(null);
  const [toggling, setToggling] = useState<Karigar | null>(null);
  const [deleting, setDeleting] = useState<Karigar | null>(null);

  const outMap = useMemo(
    () => new Map((out.data ?? []).map((o) => [o.karigar_id, o.outstanding])),
    [out.data],
  );
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (k) =>
        (filter === "all" || (filter === "active") === k.is_active) &&
        (!s || k.full_name.toLowerCase().includes(s) || k.karigar_code.toLowerCase().includes(s)),
    );
  }, [q.data, search, filter]);

  const toggle = useMutation({
    mutationFn: async (k: Karigar) => {
      const { data, error } = await supabase.rpc("set_karigar_active", {
        _id: k.id,
        _active: !k.is_active,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (d) => {
      toast.success(`${d.full_name} ${d.is_active ? "activated" : "deactivated"}`);
      qc.invalidateQueries({ queryKey: ["karigars"] });
    },
    onError: (e) => toast.error("Could not change status", { description: e.message }),
  });
  const remove = useMutation({
    mutationFn: async (k: Karigar) => {
      const { error } = await supabase.rpc("delete_karigar", { _id: k.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Karigar removed");
      qc.invalidateQueries({ queryKey: ["karigars"] });
    },
    onError: (e) => toast.error("Could not delete", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Karigars"
        description="Workshop artisans registered for gold issues."
        badge={<DemoBadge show={!!q.data?.some((k) => k.is_demo)} />}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Add karigar
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search karigars"
            placeholder="Search name or code"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          className="justify-start"
        >
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
          <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Panel>
        <QueryState q={q}>
          {() => (
            <DataTable
              rows={rows}
              emptyTitle={search || filter !== "all" ? "No matching karigars" : "No karigars yet"}
              emptyBody={
                search ? "Try a different name or code." : "Karigars will appear here once added."
              }
              columns={[
                {
                  key: "name",
                  header: "Name",
                  primary: true,
                  render: (r) => (
                    <span className="font-medium">
                      {r.full_name}{" "}
                      <span className="num ml-1 text-muted-foreground md:hidden">
                        {r.karigar_code}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "code",
                  header: "Code",
                  hideOnMobile: true,
                  render: (r) => (
                    <span className="num text-muted-foreground">{r.karigar_code}</span>
                  ),
                },
                {
                  key: "phone",
                  header: "Phone",
                  render: (r) => <span className="num">{r.phone ?? "—"}</span>,
                },
                { key: "lang", header: "Language", render: (r) => r.preferred_language ?? "—" },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge tone={r.is_active ? "success" : "neutral"}>
                      {r.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  ),
                },
                {
                  key: "out",
                  header: "Outstanding",
                  numeric: true,
                  emphasis: true,
                  render: (r) =>
                    out.isPending ? (
                      "…"
                    ) : (
                      <span
                        className={
                          Number(outMap.get(r.id) ?? 0) > 0
                            ? "font-semibold"
                            : "text-muted-foreground"
                        }
                      >
                        {fmtGrams(outMap.get(r.id) ?? 0)}
                      </span>
                    ),
                },
                ...(canManage
                  ? [
                      {
                        key: "act",
                        header: "",
                        numeric: true,
                        hideOnMobile: false,
                        render: (r: Karigar) => (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${r.full_name}`}
                              onClick={() => setEditing(r)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={
                                r.is_active
                                  ? `Deactivate ${r.full_name}`
                                  : `Activate ${r.full_name}`
                              }
                              onClick={() => setToggling(r)}
                            >
                              <Power className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${r.full_name}`}
                              onClick={() => setDeleting(r)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </QueryState>
      </Panel>
      {editing && (
        <KarigarDialog
          karigar={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.is_active ? "Deactivate karigar?" : "Activate karigar?"}
        confirmLabel={toggling?.is_active ? "Deactivate" : "Activate"}
        onConfirm={() => {
          if (toggling) toggle.mutate(toggling);
          setToggling(null);
        }}
      >
        <p>
          {toggling?.is_active
            ? "Inactive karigars cannot receive new gold issues. Their history and balances are kept."
            : "The karigar will be available for new gold issues again."}
        </p>
        {toggling && (
          <div className="mt-3 rounded-md border px-3 py-1">
            <SummaryRow
              label="Karigar"
              value={`${toggling.full_name} · ${toggling.karigar_code}`}
            />
            <SummaryRow label="Outstanding" value={fmtGrams(outMap.get(toggling.id) ?? 0)} />
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete karigar?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
          setDeleting(null);
        }}
      >
        <p>
          Only karigars with no transaction history can be deleted. Anyone with history must be
          deactivated instead.
        </p>
      </ConfirmDialog>
    </>
  );
}

function KarigarDialog({ karigar, onClose }: { karigar: Karigar | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    karigar_code: karigar?.karigar_code ?? "",
    full_name: karigar?.full_name ?? "",
    phone: karigar?.phone ?? "",
    preferred_language: karigar?.preferred_language ?? "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<"karigar_code" | "full_name" | "phone" | "preferred_language", string>>
  >({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const p = karigarSchema.parse(form);
      const { data, error } = await supabase.rpc("save_karigar", {
        _id: karigar?.id ?? (null as unknown as string),
        _karigar_code: p.karigar_code,
        _full_name: p.full_name,
        _phone: p.phone,
        _preferred_language: p.preferred_language,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (d) => {
      toast.success(karigar ? `${d.full_name} updated` : `${d.full_name} added`);
      qc.invalidateQueries({ queryKey: ["karigars"] });
      qc.invalidateQueries({ queryKey: ["outstanding"] });
      onClose();
    },
    onError: (e) => toast.error("Could not save karigar", { description: e.message }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = karigarSchema.safeParse(form);
    if (!p.success) {
      setErrors(Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    save.mutate();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{karigar ? "Edit karigar" : "Add karigar"}</DialogTitle>
          <DialogDescription>
            {karigar
              ? "The karigar code is fixed because it identifies past transactions."
              : "Codes must be unique."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Fld label="Karigar code" error={errors.karigar_code}>
            <Input
              value={form.karigar_code}
              onChange={set("karigar_code")}
              disabled={!!karigar}
              className="num uppercase"
              placeholder="KG-006"
            />
          </Fld>
          <Fld label="Full name" error={errors.full_name}>
            <Input value={form.full_name} onChange={set("full_name")} maxLength={100} />
          </Fld>
          <div className="grid gap-4 sm:grid-cols-2">
            <Fld label="Phone" error={errors.phone}>
              <Input
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={set("phone")}
                className="num"
              />
            </Fld>
            <Fld label="Preferred language" error={errors.preferred_language}>
              <Input
                value={form.preferred_language}
                onChange={set("preferred_language")}
                placeholder="Tamil"
              />
            </Fld>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Fld({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
