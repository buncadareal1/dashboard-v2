import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";
import { Toaster } from "@/components/ui/sonner";
import { AiChatWidget } from "./_components/AiChatWidget";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/db/schema";

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

  // DEV ONLY: load active users để widget switch user
  const isDev = process.env.NODE_ENV !== "production";
  const devUsers = isDev
    ? (
        await db
          .select({
            email: users.email,
            name: users.name,
            role: users.role,
          })
          .from(users)
          .where(eq(users.active, true))
      ).map(
        (u: { email: string; name: string | null; role: UserRole }) => ({
          email: u.email,
          name: u.name ?? u.email,
          role: u.role,
        }),
      )
    : undefined;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} devUsers={devUsers} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <Toaster richColors />
      <AiChatWidget />
    </div>
  );
}
