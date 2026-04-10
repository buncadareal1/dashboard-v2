"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Building2, ListFilter } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface ReportFiltersProps {
  projects: FilterOption[];
  stages: FilterOption[];
}

export function ReportFilters({ projects, stages }: ReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.replace(`/report?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">LỌC:</span>

      <FilterSelect
        icon={<CalendarDays className="h-3.5 w-3.5" />}
        label="Thời gian"
        value={searchParams.get("period") ?? ""}
        onChange={(v) => updateParam("period", v)}
        options={[
          { value: "7d", label: "7 ngày qua" },
          { value: "30d", label: "30 ngày qua" },
          { value: "90d", label: "90 ngày qua" },
          { value: "all", label: "Tất cả" },
        ]}
      />

      <FilterSelect
        icon={<Building2 className="h-3.5 w-3.5" />}
        label="Dự án"
        value={searchParams.get("project") ?? ""}
        onChange={(v) => updateParam("project", v)}
        options={projects}
      />

      <FilterSelect
        icon={<ListFilter className="h-3.5 w-3.5" />}
        label="Tình trạng"
        value={searchParams.get("stage") ?? ""}
        onChange={(v) => updateParam("stage", v)}
        options={stages}
      />
    </div>
  );
}

interface FilterSelectProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string | null) => void;
  options: FilterOption[];
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: FilterSelectProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 appearance-none rounded-md border bg-background pl-8 pr-8 text-sm font-medium outline-none transition-colors hover:bg-muted focus:ring-1 focus:ring-primary"
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
