import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ProjectForm } from "../_components/ProjectForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MultiSelectOption } from "@/components/ui/multi-select";

export default async function NewProjectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "gdda") redirect("/report"); // gdda không được tạo

  const [digitalUsers, gddaUsers] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, "digital"), eq(users.active, true)))
      .orderBy(users.name),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, "gdda"), eq(users.active, true)))
      .orderBy(users.name),
  ]);

  const digitalOptions: MultiSelectOption[] = digitalUsers.map(
    (u: { id: string; name: string | null; email: string }) => ({
      value: u.id,
      label: u.name ?? u.email,
      description: u.name ? u.email : undefined,
    }),
  );
  const gddaOptions: MultiSelectOption[] = gddaUsers.map(
    (u: { id: string; name: string | null; email: string }) => ({
      value: u.id,
      label: u.name ?? u.email,
      description: u.name ? u.email : undefined,
    }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách
      </Link>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Đăng dự án mới</h1>
          <p className="text-sm text-muted-foreground">
            Tạo dự án mới để bắt đầu quản lý lead và đồng bộ với Facebook/Bitrix.
          </p>
        </CardHeader>
        <CardContent>
          <ProjectForm
            digitalOptions={digitalOptions}
            gddaOptions={gddaOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
