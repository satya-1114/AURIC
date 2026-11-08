import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { meQuery } from "@/lib/queries";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AURIC" },
      { name: "description", content: "Sign in to AURIC Gold Operations." },
      { property: "og:title", content: "Sign in · AURIC" },
      { property: "og:description", content: "Sign in to AURIC Gold Operations." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password is required").max(128),
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setBusy(false);
      toast.error("Sign-in failed", { description: error.message });
      return;
    }
    queryClient.removeQueries({ queryKey: ["me"] });
    const me = await queryClient.fetchQuery(meQuery);
    setBusy(false);
    if (!me?.role) {
      toast.error("No role assigned", { description: "Ask the finance head to grant you access." });
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: me.role === "finance_head" ? "/dashboard" : "/karigars", replace: true });
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md border border-gold/40 text-sm font-semibold text-gold">
            Au
          </span>
          <span className="text-sm font-semibold tracking-[0.22em]">AURIC</span>
        </div>
        <div>
          <p className="label-caps text-gold">Gold Operations &amp; Karigar Management System</p>
          <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Every gram issued, accounted for.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-primary-foreground/60">
            Karigar issues, receipts, wastage and daily stock — one ledger for the whole workshop.
          </p>
        </div>
        <p className="num text-xs text-primary-foreground/40">
          Fine weight = Gross × Purity ÷ 100 · 3 dp
        </p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm" noValidate>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/auric-mark.svg" alt="" className="size-9" />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-[0.18em]">AURIC</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                Gold Operations &amp; Karigar Management System
              </p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the account issued by your administrator.
          </p>
          <div className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}Sign in
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
