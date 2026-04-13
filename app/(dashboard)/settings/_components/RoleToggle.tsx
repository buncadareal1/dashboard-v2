"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { changeRoleAction } from "@/lib/actions/users";

const ROLES = ["digital", "gdda", "admin"] as const;
type Role = (typeof ROLES)[number];

const ROLE_STYLE: Record<Role, string> = {
  admin: "bg-purple-100 text-purple-700",
  digital: "bg-blue-100 text-blue-700",
  gdda: "bg-emerald-100 text-emerald-700",
};

interface RoleToggleProps {
  userId: string;
  currentRole: string;
  userName: string;
}

export function RoleToggle({ userId, currentRole, userName }: RoleToggleProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const currentIdx = ROLES.indexOf(currentRole as Role);
    const nextRole = ROLES[(currentIdx + 1) % ROLES.length];

    startTransition(async () => {
      try {
        await changeRoleAction(userId, nextRole);
        toast.success(`${userName}: ${currentRole.toUpperCase()} → ${nextRole.toUpperCase()}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi đổi role");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="cursor-pointer transition-opacity hover:opacity-70 disabled:cursor-wait disabled:opacity-50"
      title={`Click để đổi role cho ${userName}`}
    >
      <Badge className={ROLE_STYLE[currentRole as Role] ?? ROLE_STYLE.digital}>
        {pending ? "..." : currentRole.toUpperCase()}
      </Badge>
    </button>
  );
}
