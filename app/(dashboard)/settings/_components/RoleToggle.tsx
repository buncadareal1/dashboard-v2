"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { changeRoleAction } from "@/lib/actions/users";

const ROLES = [
  { value: "digital", label: "DIGITAL", style: "bg-blue-100 text-blue-700" },
  { value: "gdda", label: "GDDA", style: "bg-emerald-100 text-emerald-700" },
  { value: "admin", label: "ADMIN", style: "bg-purple-100 text-purple-700" },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

interface RoleToggleProps {
  userId: string;
  currentRole: string;
  userName: string;
}

export function RoleToggle({ userId, currentRole, userName }: RoleToggleProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(role: RoleValue) {
    if (role === currentRole) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      try {
        await changeRoleAction(userId, role);
        toast.success(`${userName}: ${currentRole.toUpperCase()} → ${role.toUpperCase()}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi đổi role");
      }
    });
  }

  const current = ROLES.find((r) => r.value === currentRole) ?? ROLES[0];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={pending}
        className="cursor-pointer transition-opacity hover:opacity-70 disabled:cursor-wait disabled:opacity-50"
        title={`Click để đổi role cho ${userName}`}
      >
        <Badge className={current.style}>
          {pending ? "..." : current.label}
        </Badge>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-md border bg-white py-1 shadow-lg">
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => handleSelect(r.value)}
              className={[
                "flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                r.value === currentRole ? "bg-muted/50" : "",
              ].join(" ")}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${r.style.split(" ")[0]}`} />
              {r.label}
              {r.value === currentRole && <span className="ml-auto text-muted-foreground">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
