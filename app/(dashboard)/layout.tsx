import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";
import { Toaster } from "@/components/ui/sonner";

/**
 * Dashboard layout — bảo vệ tất cả routes con bằng auth check Server Component.
 *
 * GDDA login lần đầu vào "/" sẽ redirect tới /report (theo plan).
 * Auth check ở layout = đúng pattern Next.js (không phải proxy.ts).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <Toaster richColors />
    </div>
  );
}
