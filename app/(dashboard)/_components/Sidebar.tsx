"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserRole } from "@/db/schema";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  visibleFor: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    visibleFor: ["admin", "digital"],
  },
  {
    label: "Quản lý dự án",
    href: "/projects",
    icon: FolderKanban,
    visibleFor: ["admin", "digital"],
  },
  {
    label: "Report Data",
    href: "/report",
    icon: BarChart3,
    visibleFor: ["admin", "digital", "gdda"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    visibleFor: ["admin", "digital", "gdda"],
  },
];

type SidebarProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
    role: UserRole;
  };
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.visibleFor.includes(user.role),
  );

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            S
          </div>
          <span>Smartland</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md p-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback>
              {(user.name ?? user.email)?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user.name ?? user.email.split("@")[0]}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
