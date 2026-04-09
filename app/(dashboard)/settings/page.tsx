import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/db";
import { users, projectUsers, projects } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { UserFormDialog } from "./_components/UserFormDialog";
import { UserActionsMenu } from "./_components/UserActionsMenu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isAdmin = user.role === "admin";

  // Load users + project assignments cho Quản lý team (admin only)
  const teamData = isAdmin
    ? await loadTeamData()
    : {
        users: [],
        assignmentCounts: new Map<string, number>(),
        allProjects: [],
        assignmentsByUser: new Map(),
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý cài đặt hệ thống và tài khoản
        </p>
      </div>

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Thông tin tài khoản</TabsTrigger>
          {isAdmin && <TabsTrigger value="team">Quản lý team</TabsTrigger>}
          <TabsTrigger value="notifications">Thông báo</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="integrations">Tích hợp</TabsTrigger>
          )}
          <TabsTrigger value="security">Bảo mật</TabsTrigger>
        </TabsList>

        {/* Sub-tab 1: Thông tin tài khoản */}
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Thông tin cá nhân</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {(user.name ?? user.email)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user.name ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Badge className="mt-1">{user.role.toUpperCase()}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Họ và tên" defaultValue={user.name ?? ""} />
                <Field
                  label="Email"
                  defaultValue={user.email}
                  disabled
                  hint="Email không thể đổi (auth qua Google)"
                />
                <Field label="Số điện thoại" placeholder="0901234567" />
                <Field label="Vai trò" defaultValue={user.role} disabled />
              </div>
              <p className="text-xs text-muted-foreground">
                Cập nhật profile sẽ khả dụng ở Phase 4 (server action).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-tab 2: Quản lý team (admin only) */}
        {isAdmin && (
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Quản lý team</h2>
                    <p className="text-sm text-muted-foreground">
                      Quản lý user và phân quyền dự án
                    </p>
                  </div>
                  <UserFormDialog />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Dự án được gán</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Last login</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamData.users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              u.role === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : u.role === "digital"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-emerald-100 text-emerald-700"
                            }
                          >
                            {u.role.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {teamData.assignmentCounts.get(u.id) ?? 0} dự án
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              u.active
                                ? "bg-green-100 text-green-700"
                                : "bg-zinc-100 text-zinc-600"
                            }
                          >
                            {u.active ? "Active" : "Vô hiệu"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleString("vi-VN")
                            : "Chưa login"}
                        </TableCell>
                        <TableCell>
                          <UserActionsMenu
                            user={{
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              role: u.role,
                              active: u.active,
                            }}
                            projects={teamData.allProjects}
                            existingAssignments={
                              teamData.assignmentsByUser.get(u.id) ?? []
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Sub-tab 3: Thông báo */}
        <TabsContent value="notifications">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-base font-medium">🔔 Thông báo</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Hệ thống notification sẽ khả dụng ở Phase 2.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                (CSV upload done/fail, match conflict, lead mới realtime)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sub-tab 4: Tích hợp quảng cáo */}
        {isAdmin && (
          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">Tích hợp quảng cáo</h2>
                <p className="text-sm text-muted-foreground">
                  Kết nối API platform — sẽ khả dụng ở Phase 2 sau khi Meta
                  duyệt App Review.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <IntegrationItem
                  name="Facebook Ads"
                  icon="f"
                  iconBg="bg-blue-600"
                />
                <IntegrationItem
                  name="Google Ads"
                  icon="G"
                  iconBg="bg-red-500"
                />
                <IntegrationItem
                  name="TikTok Ads"
                  icon="T"
                  iconBg="bg-black"
                />
                <IntegrationItem name="Zalo Ads" icon="Z" iconBg="bg-sky-500" />
                <IntegrationItem
                  name="YouTube Ads"
                  icon="Y"
                  iconBg="bg-red-600"
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Sub-tab 5: Bảo mật */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Bảo mật</h2>
              <p className="text-sm text-muted-foreground">
                Quản lý phiên đăng nhập và bảo mật tài khoản
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                ✅ Đăng nhập an toàn qua Google Workspace OAuth.
                <br />
                Domain whitelist: <code>{process.env.ALLOWED_EMAIL_DOMAIN}</code>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                2FA, active sessions list, login history — Phase 4.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface FieldProps {
  label: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}

function Field({
  label,
  defaultValue,
  placeholder,
  disabled,
  hint,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface IntegrationItemProps {
  name: string;
  icon: string;
  iconBg: string;
}

function IntegrationItem({ name, icon, iconBg }: IntegrationItemProps) {
  return (
    <div className="flex items-center justify-between rounded-md border p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded ${iconBg} font-bold text-white`}
        >
          {icon}
        </div>
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">Chưa kết nối</p>
        </div>
      </div>
      <button
        disabled
        className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
        title="Khả dụng ở Phase 2 — đang chờ Meta App Review"
      >
        Kết nối (Phase 2)
      </button>
    </div>
  );
}

async function loadTeamData() {
  const allUsers = await db.select().from(users).orderBy(users.createdAt);

  const counts = await db
    .select({
      userId: projectUsers.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(projectUsers)
    .innerJoin(
      projects,
      and(
        eq(projects.id, projectUsers.projectId),
        isNull(projects.deletedAt),
      ),
    )
    .groupBy(projectUsers.userId);

  const assignmentCounts = new Map<string, number>(
    counts.map((c: { userId: string; count: number }) => [c.userId, c.count]),
  );

  // All projects để show trong AssignDialog
  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      location: projects.location,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(projects.name);

  // Existing assignments per user
  const allAssignments = await db
    .select({
      userId: projectUsers.userId,
      projectId: projectUsers.projectId,
      canView: projectUsers.canView,
      canEdit: projectUsers.canEdit,
      roleInProject: projectUsers.roleInProject,
    })
    .from(projectUsers)
    .innerJoin(
      projects,
      and(
        eq(projects.id, projectUsers.projectId),
        isNull(projects.deletedAt),
      ),
    );
  const assignmentsByUser = new Map<
    string,
    Array<{
      projectId: string;
      canView: boolean;
      canEdit: boolean;
      roleInProject: "digital" | "gdda";
    }>
  >();
  for (const a of allAssignments as Array<{
    userId: string;
    projectId: string;
    canView: boolean;
    canEdit: boolean;
    roleInProject: "digital" | "gdda";
  }>) {
    const arr = assignmentsByUser.get(a.userId) ?? [];
    arr.push({
      projectId: a.projectId,
      canView: a.canView,
      canEdit: a.canEdit,
      roleInProject: a.roleInProject,
    });
    assignmentsByUser.set(a.userId, arr);
  }

  return {
    users: allUsers,
    assignmentCounts,
    allProjects,
    assignmentsByUser,
  };
}
