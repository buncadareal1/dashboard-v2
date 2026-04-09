"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setProjectStatusAction } from "@/lib/actions/projects";

type Status = "running" | "warning" | "paused";

const STATUS_LABELS: Record<Status, string> = {
  running: "Đang hoạt động",
  warning: "Cảnh báo",
  paused: "Tạm dừng",
};

interface Props {
  slug: string;
  current: Status;
}

export function ProjectHeaderActions({ slug, current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(next: Status) {
    if (next === current) return;
    startTransition(async () => {
      try {
        await setProjectStatusAction(slug, next);
        toast.success(`Đã đổi trạng thái: ${STATUS_LABELS[next]}`);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Đổi trạng thái thất bại";
        toast.error(msg);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/projects/${slug}/edit`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Pencil className="h-4 w-4" />
        Chỉnh sửa
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Đổi trạng thái
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => changeStatus(s)}
              disabled={s === current}
            >
              {STATUS_LABELS[s]}
              {s === current && (
                <span className="ml-auto text-xs text-muted-foreground">
                  hiện tại
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
