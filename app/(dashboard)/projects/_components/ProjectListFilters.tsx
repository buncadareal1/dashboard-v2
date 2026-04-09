"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterStatus = "all" | "running" | "warning" | "paused";

interface ProjectListFiltersProps {
  counts: {
    all: number;
    running: number;
    warning: number;
    paused: number;
  };
}

const FILTERS: Array<{ key: FilterStatus; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "running", label: "Đang chạy" },
  { key: "warning", label: "Cảnh báo" },
  { key: "paused", label: "Tạm dừng" },
];

export function ProjectListFilters({ counts }: ProjectListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = (searchParams.get("status") ?? "all") as FilterStatus;
  const currentSearch = searchParams.get("search") ?? "";

  const updateParams = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.replace(`/projects?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = currentStatus === f.key;
          const count = counts[f.key];
          return (
            <button
              key={f.key}
              onClick={() => updateParams({ status: f.key === "all" ? null : f.key })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Tìm dự án..."
          defaultValue={currentSearch}
          onChange={(e) => updateParams({ search: e.target.value || null })}
          className="pl-9"
        />
      </div>
    </div>
  );
}
