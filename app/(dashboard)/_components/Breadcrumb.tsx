"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

/**
 * Auto breadcrumb từ pathname. Mapping route → label tiếng Việt.
 */
const LABELS: Record<string, string> = {
  "": "Dashboard",
  projects: "Quản lý dự án",
  new: "Đăng dự án mới",
  edit: "Chỉnh sửa",
  report: "Report Data",
  settings: "Settings",
  conflicts: "Xung đột",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null; // trang Dashboard không cần breadcrumb

  const crumbs: Array<{ label: string; href: string }> = [
    { label: "Dashboard", href: "/" },
  ];

  let currentPath = "";
  for (const seg of segments) {
    currentPath += `/${seg}`;
    const label = LABELS[seg] ?? decodeURIComponent(seg).replace(/-/g, " ");
    crumbs.push({ label, href: currentPath });
  }

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i === 0 && <Home className="h-3.5 w-3.5" />}
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            )}
            {isLast ? (
              <span className="font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
