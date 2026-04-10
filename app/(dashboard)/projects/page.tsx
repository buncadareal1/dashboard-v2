import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getProjectsForUser } from "@/lib/queries/projects";
import { ProjectCard } from "./_components/ProjectCard";
import { ProjectListFilters } from "./_components/ProjectListFilters";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  searchParams: Promise<{
    status?: "running" | "warning" | "paused";
    search?: string;
  }>;
}

export default async function ProjectsListPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "gdda") redirect("/report");

  const params = await searchParams;

  // Query TẤT CẢ projects (không filter status) để tính counts đúng
  const allProjects = await getProjectsForUser({
    userId: user.id,
    role: user.role,
    search: params.search,
  });

  const counts = {
    all: allProjects.length,
    running: allProjects.filter((p) => p.status === "running").length,
    warning: allProjects.filter((p) => p.status === "warning").length,
    paused: allProjects.filter((p) => p.status === "paused").length,
  };

  // Filter display list theo status tab đang chọn
  const projects = params.status
    ? allProjects.filter((p) => p.status === params.status)
    : allProjects;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Quản lý dự án</h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi và quản lý tất cả dự án bất động sản
          </p>
        </div>
        <Link href="/projects/new" className={buttonVariants()}>
          + Thêm dự án mới
        </Link>
      </div>

      <ProjectListFilters counts={counts} />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title="Chưa có dự án nào"
          description="Tạo dự án mới từ nút phía trên hoặc dropdown “Tạo mới”."
          action={
            <Link href="/projects/new" className={buttonVariants()}>
              + Tạo dự án đầu tiên
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
