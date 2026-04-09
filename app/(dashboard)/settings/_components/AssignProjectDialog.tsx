"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderKanban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { assignUserToProjectsAction } from "@/lib/actions/users";

interface ProjectOption {
  id: string;
  name: string;
  location: string | null;
}

interface ExistingAssignment {
  projectId: string;
  canView: boolean;
  canEdit: boolean;
  roleInProject: "digital" | "gdda";
}

interface AssignProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name: string | null; email: string; role: string };
  projects: ProjectOption[];
  existingAssignments: ExistingAssignment[];
}

interface AssignmentState {
  projectId: string;
  canView: boolean;
  canEdit: boolean;
  roleInProject: "digital" | "gdda";
}

export function AssignProjectDialog({
  open,
  onOpenChange,
  user,
  projects,
  existingAssignments,
}: AssignProjectDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Init state từ existing
  const [state, setState] = useState<Map<string, AssignmentState>>(() => {
    const m = new Map<string, AssignmentState>();
    for (const a of existingAssignments) {
      m.set(a.projectId, { ...a });
    }
    return m;
  });

  function toggleView(projectId: string, value: boolean) {
    setState((prev) => {
      const next = new Map(prev);
      const cur = next.get(projectId) ?? {
        projectId,
        canView: false,
        canEdit: false,
        roleInProject: (user.role === "gdda" ? "gdda" : "digital") as
          | "digital"
          | "gdda",
      };
      next.set(projectId, {
        ...cur,
        canView: value,
        canEdit: value ? cur.canEdit : false,
      });
      return next;
    });
  }

  function toggleEdit(projectId: string, value: boolean) {
    setState((prev) => {
      const next = new Map(prev);
      const cur = next.get(projectId) ?? {
        projectId,
        canView: true,
        canEdit: false,
        roleInProject: (user.role === "gdda" ? "gdda" : "digital") as
          | "digital"
          | "gdda",
      };
      next.set(projectId, {
        ...cur,
        canEdit: value,
        canView: value ? true : cur.canView,
      });
      return next;
    });
  }

  function handleSave() {
    const assignments = Array.from(state.values()).filter(
      (a) => a.canView || a.canEdit,
    );

    startTransition(async () => {
      try {
        await assignUserToProjectsAction({
          userId: user.id,
          assignments,
        });
        toast.success(`Đã gán ${assignments.length} dự án cho ${user.email}`);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gán dự án thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gán dự án cho {user.name ?? user.email}</DialogTitle>
          <DialogDescription>
            Chọn quyền view/edit cho từng dự án. Save sẽ overwrite assignment cũ.
          </DialogDescription>
        </DialogHeader>

        {projects.length === 0 ? (
          <div className="py-12 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Chưa có dự án nào. Tạo dự án mới trước.
            </p>
          </div>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {projects.map((p) => {
              const cur = state.get(p.id);
              const hasView = cur?.canView ?? false;
              const hasEdit = cur?.canEdit ?? false;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.location && (
                      <p className="truncate text-xs text-muted-foreground">
                        {p.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={hasView}
                        onCheckedChange={(v) =>
                          toggleView(p.id, v === true)
                        }
                      />
                      View
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={hasEdit}
                        onCheckedChange={(v) =>
                          toggleEdit(p.id, v === true)
                        }
                      />
                      Edit
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
