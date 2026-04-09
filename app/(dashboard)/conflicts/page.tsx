import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getUnresolvedConflicts } from "@/lib/queries/conflicts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConflictResolveButton } from "./_components/ConflictResolveButton";
import { formatDateTime } from "@/lib/utils/format";

export default async function ConflictsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "gdda") redirect("/report");

  const conflicts = await getUnresolvedConflicts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Match Conflicts</h1>
        <p className="text-sm text-muted-foreground">
          Lead trùng tên cần admin xử lý thủ công
        </p>
      </div>

      {conflicts.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Không có xung đột"
          description="Mọi lead đều đã được khớp tự động — không cần xử lý thủ công."
        />
      ) : (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">
              {conflicts.length} conflict pending
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-orange-200 bg-orange-50/40 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.reason}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{c.projectName}</Badge>
                      <span>·</span>
                      <span>{c.csvFilename}</span>
                      <Badge variant="outline">
                        {c.csvType === "facebook" ? "FB" : "Bitrix"}
                      </Badge>
                      <span>·</span>
                      <span>{formatDateTime(c.createdAt)}</span>
                    </div>
                    {Array.isArray(c.candidates) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Candidates: {c.candidates.length} lead trùng
                      </p>
                    )}
                  </div>
                  <ConflictResolveButton conflictId={c.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
