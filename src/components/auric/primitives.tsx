import type { ReactNode } from "react";
import { AlertTriangle, AlertOctagon, Info, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtGrams } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export type Tone = "neutral" | "success" | "warning" | "danger" | "gold";

const toneBadge: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  gold: "bg-gold-soft text-gold",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        toneBadge[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)}>
      {title && (
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: number;
  delta?: string;
  tone?: "neutral" | "gold";
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card p-5 shadow-card",
        tone === "gold" && "border-gold/40",
      )}
    >
      {tone === "gold" && <span className="absolute inset-x-0 top-0 h-0.5 bg-gold" />}
      <p className="label-caps">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-36" />
      ) : (
        <p className="num mt-3 text-[1.75rem] font-semibold leading-none tracking-tight">
          {fmtGrams(value).replace(" g", "")}
          <span className="ml-1 text-base font-medium text-muted-foreground">g</span>
        </p>
      )}
      {delta && (
        <p className={cn("mt-3 text-xs", tone === "gold" ? "text-gold" : "text-muted-foreground")}>
          {delta}
        </p>
      )}
    </div>
  );
}

const alertIcon = { warning: AlertTriangle, danger: AlertOctagon, neutral: Info };
const alertTone = {
  warning: "text-warning bg-warning-soft",
  danger: "text-destructive bg-destructive-soft",
  neutral: "text-muted-foreground bg-muted",
};

export function AlertCard({
  tone,
  title,
  body,
  meta,
}: {
  tone: "warning" | "danger" | "neutral";
  title: string;
  body: string;
  meta: string;
}) {
  const Icon = alertIcon[tone];
  return (
    <div className="flex gap-3 px-5 py-4">
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
          alertTone[tone],
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="num mt-0.5 text-sm text-muted-foreground">{body}</p>
        <p className="mt-1 text-xs text-muted-foreground/80">{meta}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  icon: Icon = Inbox,
}: {
  title: string;
  body: string;
  icon?: typeof Inbox;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-full border bg-background">
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function ErrorState({
  onRetry,
  message,
}: {
  onRetry?: () => void;
  message?: string | undefined;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <AlertOctagon className="size-5 text-destructive" />
      <p className="mt-3 text-sm font-medium">Couldn't load this data</p>
      {message && <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-foreground underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}
