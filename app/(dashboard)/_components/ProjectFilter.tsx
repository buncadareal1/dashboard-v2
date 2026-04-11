"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

interface ProjectOption {
  value: string;
  label: string;
}

interface ProjectFilterProps {
  projects: ProjectOption[];
}

export function ProjectFilter({ projects }: ProjectFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("project") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete("project");
    } else {
      params.set("project", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  if (projects.length <= 1) return null;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
      </div>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 appearance-none rounded-md border bg-background pl-8 pr-8 text-sm font-medium outline-none transition-colors hover:bg-muted focus:ring-1 focus:ring-primary"
      >
        <option value="">Tất cả dự án</option>
        {projects.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
