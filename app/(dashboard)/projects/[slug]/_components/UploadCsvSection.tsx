"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import { deleteUploadAction } from "@/lib/actions/uploads";
import type { UploadHistoryRow } from "@/lib/queries/uploads";

interface UploadCsvSectionProps {
  projectId: string;
  history: UploadHistoryRow[];
  canEdit: boolean;
}

export function UploadCsvSection({
  history,
  canEdit,
}: UploadCsvSectionProps) {
  if (!canEdit) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Lịch sử Upload CSV</h2>
        <p className="text-sm text-muted-foreground">
          10 lần upload gần nhất. Upload file mới bằng các nút phía trên.
        </p>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có upload nào. Dùng nút Upload FB / Bitrix / Chi phí ở header.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((u) => (
              <UploadRow key={u.id} upload={u} canEdit={canEdit} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UploadRow({
  upload,
  canEdit,
}: {
  upload: UploadHistoryRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [deleting, startTransition] = useTransition();

  const statusConfig = {
    pending: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />,
      label: "Đang chờ",
      className: "bg-zinc-100 text-zinc-700",
    },
    processing: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
      label: "Đang xử lý",
      className: "bg-blue-100 text-blue-700",
    },
    done: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
      label: "Hoàn tất",
      className: "bg-green-100 text-green-700",
    },
    failed: {
      icon: <XCircle className="h-4 w-4 text-red-600" />,
      label: "Thất bại",
      className: "bg-red-100 text-red-700",
    },
  };
  const cfg = statusConfig[upload.status];

  function handleDelete() {
    if (!confirm(`Xoá upload "${upload.filename}" và dữ liệu liên quan?`)) return;
    startTransition(async () => {
      try {
        await deleteUploadAction(upload.id);
        toast.success(`Đã xoá upload "${upload.filename}"`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Xoá thất bại",
        );
      }
    });
  }

  return (
    <div className="group flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{upload.filename}</p>
          <p className="text-xs text-muted-foreground">
            {upload.type === "facebook"
              ? "Facebook"
              : upload.type === "bitrix"
                ? "Bitrix"
                : "Chi phí"}{" "}
            · {formatDateTime(upload.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {upload.status === "done" && (
          <p className="text-xs text-muted-foreground">
            {upload.parsedCount} lead
            {upload.errorCount > 0 && (
              <span className="ml-1 text-orange-600">
                · {upload.errorCount} conflict
              </span>
            )}
          </p>
        )}
        <Badge className={cfg.className}>
          {cfg.icon}
          <span className="ml-1">{cfg.label}</span>
        </Badge>
        {canEdit && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            title="Xoá upload + data"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
