import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { ProjectForm } from "../_components/ProjectForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function NewProjectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "gdda") redirect("/report"); // gdda không được tạo

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
          <ProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
