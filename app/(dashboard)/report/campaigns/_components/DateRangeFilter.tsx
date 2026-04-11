"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PRESETS = [
  { label: "7 ngày", value: "7d" },
  { label: "30 ngày", value: "30d" },
  { label: "90 ngày", value: "90d" },
  { label: "Tháng này", value: "thisMonth" },
  { label: "Tháng trước", value: "lastMonth" },
  { label: "Tất cả", value: "" },
] as const;

interface DateRangeFilterProps {
  currentPeriod?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
}

export function DateRangeFilter({
  currentPeriod,
  currentDateFrom,
  currentDateTo,
}: DateRangeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams(searchParams.toString());
      // Clear old date params
      sp.delete("period");
      sp.delete("dateFrom");
      sp.delete("dateTo");
      // Set new ones
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
      }
      router.push(`?${sp.toString()}`);
    },
    [router, searchParams],
  );

  const activePeriod = currentPeriod || (!currentDateFrom ? "" : "custom");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">Thời gian:</span>

      {/* Preset buttons */}
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setFilter(p.value ? { period: p.value } : {})}
            className={[
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              activePeriod === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={currentDateFrom ?? ""}
          onChange={(e) =>
            setFilter({
              dateFrom: e.target.value,
              dateTo: currentDateTo ?? "",
            })
          }
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-muted-foreground">→</span>
        <input
          type="date"
          value={currentDateTo ?? ""}
          onChange={(e) =>
            setFilter({
              dateFrom: currentDateFrom ?? "",
              dateTo: e.target.value,
            })
          }
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
