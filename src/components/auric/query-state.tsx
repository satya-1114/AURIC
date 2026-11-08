import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "./primitives";

export function QueryState<T>({
  q,
  children,
  skeleton,
}: {
  q: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
}) {
  if (q.isPending)
    return (
      <>
        {skeleton ?? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        )}
      </>
    );
  if (q.isError)
    return (
      <ErrorState
        onRetry={() => q.refetch()}
        message={q.error instanceof Error ? q.error.message : undefined}
      />
    );
  return <>{children(q.data as T)}</>;
}
