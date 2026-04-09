"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveConflictAction } from "@/lib/actions/conflicts";

export function ConflictResolveButton({
  conflictId,
}: {
  conflictId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDismiss() {
    startTransition(async () => {
      try {
        await resolveConflictAction({
          conflictId,
          action: "dismiss",
        });
        toast.success("Đã xử lý conflict");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDismiss}
      disabled={pending}
    >
      <Check className="mr-1 h-4 w-4" />
      {pending ? "Đang xử lý..." : "Đánh dấu xử lý"}
    </Button>
  );
}
