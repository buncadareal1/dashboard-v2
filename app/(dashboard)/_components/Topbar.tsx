import Link from "next/link";
import { Search, Plus, Bell, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/db/schema";

type TopbarProps = {
  user: { role: UserRole };
};

export function Topbar({ user }: TopbarProps) {
  const canCreate = user.role === "admin" || user.role === "digital";

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Tìm kiếm dự án, chiến dịch, lead..."
          className="pl-9"
        />
      </div>

      <div className="flex-1" />

      {/* Tạo mới dropdown — chỉ admin/digital */}
      {canCreate && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                Tạo mới
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href="/projects/new" />}>
              Dự án mới
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Notification bell */}
      <Button variant="ghost" size="icon" aria-label="Thông báo">
        <Bell className="h-5 w-5" />
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Tài khoản">
              <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                U
              </span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/settings" />}>
            Cài đặt
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button type="submit" className="flex w-full items-center">
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </button>
              </form>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
