"use client";

import { useState, useTransition } from "react";
import { ChevronUp, FlaskConical } from "lucide-react";
import { devSwitchUser } from "@/lib/actions/dev-switch";

interface DevUser {
  email: string;
  name: string;
  role: "admin" | "digital" | "gdda";
}

interface SwitchUserWidgetProps {
  currentEmail: string;
  users: DevUser[];
}

const ROLE_BADGE: Record<
  DevUser["role"],
  { label: string; className: string }
> = {
  admin: { label: "ADMIN", className: "bg-purple-100 text-purple-700" },
  digital: { label: "DIGITAL", className: "bg-blue-100 text-blue-700" },
  gdda: { label: "GDDA", className: "bg-emerald-100 text-emerald-700" },
};

/**
 * DEV ONLY widget — switch user nhanh để test role.
 * Chỉ render nếu NODE_ENV !== 'production' (check ở Sidebar).
 */
export function SwitchUserWidget({
  currentEmail,
  users,
}: SwitchUserWidgetProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSwitch(email: string) {
    if (email === currentEmail) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        await devSwitchUser(email);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
        // eslint-disable-next-line no-console
        console.error("Switch user failed", err);
      }
    });
  }

  return (
    <div className="border-t border-amber-200 bg-amber-50 p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-amber-100"
      >
        <span className="flex items-center gap-1.5 font-medium text-amber-800">
          <FlaskConical className="h-3.5 w-3.5" />
          DEV: Switch User
        </span>
        <ChevronUp
          className={`h-3.5 w-3.5 text-amber-700 transition-transform ${
            open ? "" : "rotate-180"
          }`}
        />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {users.map((u) => {
            const isCurrent = u.email === currentEmail;
            const badge = ROLE_BADGE[u.role];
            return (
              <button
                key={u.email}
                type="button"
                disabled={pending || isCurrent}
                onClick={() => handleSwitch(u.email)}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                  isCurrent
                    ? "bg-amber-100 text-amber-900"
                    : "hover:bg-amber-100"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {u.email}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
