import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, and, isNull } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/db";
import {
  users,
  projects,
  projectUsers,
  projectFanpages,
  fanpages,
} from "@/db/schema";
import { ProjectForm, type ProjectFormDefaults } from "../../_components/ProjectForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MultiSelectOption } from "@/components/ui/multi-select";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditProjectPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await params;

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), isNull(projects.deletedAt)),
  });
  if (!project) notFound();

  // Authorize: admin OR digital can_edit in this project
  let canEdit = user.role === "admin";
  if (!canEdit) {
    const pu = await db.query.projectUsers.findFirst({
      where: and(
        eq(projectUsers.projectId, project.id),
        eq(projectUsers.userId, user.id),
        eq(projectUsers.canEdit, true),
      ),
    });
    canEdit = !!pu;
  }
  if (!canEdit) redirect(`/projects/${slug}`);

  // Load assignments + options in parallel
  const [currentAssignments, fpLinks, digitalUsers, gddaUsers] =
    await Promise.all([
      db
        .select({
          userId: projectUsers.userId,
          roleInProject: projectUsers.roleInProject,
        })
        .from(projectUsers)
        .where(eq(projectUsers.projectId, project.id)),
      db
        .select({ name: fanpages.name })
        .from(projectFanpages)
        .innerJoin(fanpages, eq(projectFanpages.fanpageId, fanpages.id))
        .where(eq(projectFanpages.projectId, project.id)),
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

  const digitalUserIds = currentAssignments
    .filter(
      (a: { userId: string; roleInProject: "digital" | "gdda" }) =>
        a.roleInProject === "digital",
    )
    .map((a: { userId: string }) => a.userId);
  const gddaUserIds = currentAssignments
    .filter(
      (a: { userId: string; roleInProject: "digital" | "gdda" }) =>
        a.roleInProject === "gdda",
    )
    .map((a: { userId: string }) => a.userId);

  const toOption = (u: {
    id: string;
    name: string | null;
    email: string;
  }): MultiSelectOption => ({
    value: u.id,
    label: u.name ?? u.email,
    description: u.name ? u.email : undefined,
  });

  const defaults: ProjectFormDefaults = {
    slug: project.slug,
    name: project.name,
    location: project.location ?? "",
    fbAdAccountId: project.fbAdAccountId ?? "",
    googleAdsId: project.googleAdsId ?? "",
    fanpageNames: fpLinks.map((f: { name: string }) => f.name).join(", "),
    digitalUserIds,
    gddaUserIds,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/projects/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại dự án
      </Link>

      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Chỉnh sửa dự án</h1>
          <p className="text-sm text-muted-foreground">
            Cập nhật thông tin và phân quyền team cho dự án.
          </p>
        </CardHeader>
        <CardContent>
          <ProjectForm
            mode="edit"
            defaultValues={defaults}
            digitalOptions={digitalUsers.map(toOption)}
            gddaOptions={gddaUsers.map(toOption)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
