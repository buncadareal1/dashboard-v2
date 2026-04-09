import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getProjectsForUser } from "@/lib/queries/projects";
import { ProjectCard } from "./_components/ProjectCard";
import { ProjectListFilters } from "./_components/ProjectListFilters";
import { buttonVariants } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{
    status?: "running" | "warning" | "paused";
    search?: string;
  }>;
}

export default async function ProjectsListPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const projects = await getProjectsForUser({
    userId: user.id,
    role: user.role,
    status: params.status,
    search: params.search,
  });

  const counts = {
    all: projects.length,
    running: projects.filter((p) => p.status === "running").length,
    warning: projects.filter((p) => p.status === "warning").length,
    paused: projects.filter((p) => p.status === "paused").length,
  };

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
        <EmptyState />
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <FolderKanban className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-base font-medium">Chưa có dự án nào</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Tạo dự án mới từ nút phía trên hoặc dropdown &ldquo;Tạo mới&rdquo;.
      </p>
      <Link
        href="/projects/new"
        className={buttonVariants({ className: "mt-4" })}
      >
        + Tạo dự án đầu tiên
      </Link>
    </div>
  );
}
