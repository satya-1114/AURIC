import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./primitives";

export type Column<T> = {
  key: string;
  header: string;
  numeric?: boolean;
  /** Shown as the card title on mobile. */
  primary?: boolean;
  /** Emphasised (larger) value on mobile cards, e.g. balances. */
  emphasis?: boolean;
  /** Hide on mobile cards. */
  hideOnMobile?: boolean;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyTitle = "No records yet",
  emptyBody = "Records will appear here once added.",
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (!loading && rows.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
  return (
    <>
      {/* Mobile: stacked cards, no horizontal scrolling */}
      <ul className="divide-y md:hidden">
        {loading
          ? [0, 1, 2].map((i) => (
              <li key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </li>
            ))
          : rows.map((r, i) => (
              <li key={i} className="p-4">
                <div className="text-sm font-medium">{primary?.render(r)}</div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  {rest.map((c) => (
                    <div
                      key={c.key}
                      className={cn(
                        "min-w-0",
                        c.emphasis &&
                          "col-span-2 flex items-baseline justify-between rounded-md bg-muted/60 px-3 py-2",
                      )}
                    >
                      <dt className="label-caps truncate">{c.header}</dt>
                      <dd
                        className={cn(
                          "mt-0.5 min-w-0 break-words text-sm",
                          c.numeric && "num",
                          c.emphasis && "mt-0 text-base font-semibold",
                        )}
                      >
                        {c.render(r)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
      </ul>
      {/* Tablet & desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "label-caps whitespace-nowrap px-4 py-3 font-semibold lg:px-5",
                    c.numeric ? "text-right" : "text-left",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3.5 lg:px-5">
                        <Skeleton className={cn("h-4", c.numeric ? "ml-auto w-16" : "w-28")} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b transition-colors last:border-0 hover:bg-muted/50"
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "whitespace-nowrap px-4 py-3.5 lg:px-5",
                          c.numeric && "num text-right",
                        )}
                      >
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
