"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils/format";
import type { UploadHistoryRow } from "@/lib/queries/uploads";

interface UploadCsvSectionProps {
  projectId: string;
  history: UploadHistoryRow[];
  canEdit: boolean;
}

export function UploadCsvSection({
  projectId,
  history,
  canEdit,
}: UploadCsvSectionProps) {
  const router = useRouter();
  const [openType, setOpenType] = useState<"facebook" | "bitrix" | null>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Bạn không có quyền upload CSV cho dự án này.
        </CardContent>
      </Card>
    );
  }

  async function handleUpload(file: File, type: "facebook" | "bitrix") {
    setProgress("Đang upload...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);
    formData.append("type", type);

    try {
      const res = await fetch("/api/upload/csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }
      const data = (await res.json()) as { uploadId: string; status: string };
      toast.success(`Upload thành công, đang xử lý...`);
      setProgress(`Đang xử lý upload ${data.uploadId.slice(0, 8)}...`);

      // Poll status mỗi 2s
      const pollId = setInterval(async () => {
        try {
          const r = await fetch(`/api/uploads/${data.uploadId}`);
          if (!r.ok) return;
          const status = (await r.json()) as {
            status: string;
            parsedCount: number;
            errorCount: number;
          };
          if (status.status === "done") {
            clearInterval(pollId);
            toast.success(
              `Hoàn tất: ${status.parsedCount} lead, ${status.errorCount} conflict`,
            );
            setProgress(null);
            setOpenType(null);
            startTransition(() => router.refresh());
          } else if (status.status === "failed") {
            clearInterval(pollId);
            toast.error("Upload thất bại");
            setProgress(null);
          }
        } catch {
          // Ignore poll errors
        }
      }, 2000);

      // Stop polling sau 60s
      setTimeout(() => clearInterval(pollId), 60_000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload thất bại";
      toast.error(msg);
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Upload CSV</h2>
            <p className="text-sm text-muted-foreground">
              Đồng bộ lead từ Facebook Ads + Bitrix24 (giai đoạn 1)
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setOpenType("facebook")}
              disabled={pending}
            >
              <Upload className="mr-1 h-4 w-4" />
              Upload Facebook CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpenType("bitrix")}
              disabled={pending}
            >
              <Upload className="mr-1 h-4 w-4" />
              Upload Bitrix CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Lịch sử upload (10 gần nhất)
        </h3>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có upload nào.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((u) => (
              <UploadRow key={u.id} upload={u} />
            ))}
          </div>
        )}

        {progress && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress}
          </div>
        )}
      </CardContent>

      {/* Upload dialog */}
      <Dialog
        open={openType !== null}
        onOpenChange={(o) => !o && setOpenType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Upload CSV {openType === "facebook" ? "Facebook" : "Bitrix24"}
            </DialogTitle>
            <DialogDescription>
              {openType === "facebook"
                ? "File CSV xuất từ Facebook Ads Manager. Yêu cầu cột: Created Time, Full Name, Phone, Campaign, Lead ID..."
                : "File CSV chuyển từ Bitrix24. Yêu cầu cột: Lead, Stage, Responsible, Updated Time, Comment"}
            </DialogDescription>
          </DialogHeader>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && openType) {
                handleUpload(file, openType);
              }
            }}
            className="block w-full rounded-md border border-input p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />

          <p className="text-xs text-muted-foreground">
            Max 4MB. File sẽ được parse + match async qua Inngest.
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UploadRow({ upload }: { upload: UploadHistoryRow }) {
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

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{upload.filename}</p>
          <p className="text-xs text-muted-foreground">
            {upload.type === "facebook" ? "Facebook" : "Bitrix"} ·{" "}
            {formatDateTime(upload.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {upload.status === "done" && (
          <p className="text-xs text-muted-foreground">
            {upload.parsedCount} lead
            {upload.errorCount > 0 && (
              <span className="ml-2 text-orange-600">
                · {upload.errorCount} conflict
              </span>
            )}
          </p>
        )}
        <Badge className={cfg.className}>
          {cfg.icon}
          <span className="ml-1">{cfg.label}</span>
        </Badge>
      </div>
    </div>
  );
}
