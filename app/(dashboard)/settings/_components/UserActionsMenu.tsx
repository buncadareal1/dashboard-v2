"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, FolderPlus, UserX, UserCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  deactivateUserAction,
  activateUserAction,
} from "@/lib/actions/users";
import { AssignProjectDialog } from "./AssignProjectDialog";

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

interface UserActionsMenuProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    active: boolean;
  };
  projects: ProjectOption[];
  existingAssignments: ExistingAssignment[];
}

export function UserActionsMenu({
  user,
  projects,
  existingAssignments,
}: UserActionsMenuProps) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleToggleActive() {
    startTransition(async () => {
      try {
        if (user.active) {
          await deactivateUserAction(user.id);
          toast.success(`Đã vô hiệu hoá ${user.email}`);
        } else {
          await activateUserAction(user.id);
          toast.success(`Đã kích hoạt ${user.email}`);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" disabled={pending}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setAssignOpen(true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Gán dự án
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleActive}>
            {user.active ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                Vô hiệu hoá
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                Kích hoạt
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AssignProjectDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        user={user}
        projects={projects}
        existingAssignments={existingAssignments}
      />
    </>
  );
}
