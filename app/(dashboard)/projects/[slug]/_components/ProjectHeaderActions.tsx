"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, ChevronDown, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { setProjectStatusAction } from "@/lib/actions/projects";

type Status = "running" | "warning" | "paused";
type UploadType = "facebook" | "bitrix" | "cost";

const STATUS_LABELS: Record<Status, string> = {
  running: "Đang hoạt động",
  warning: "Cảnh báo",
  paused: "Tạm dừng",
};

interface Props {
  slug: string;
  projectId: string;
  current: Status;
}

export function ProjectHeaderActions({ slug, projectId, current }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openType, setOpenType] = useState<UploadType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  function changeStatus(next: Status) {
    if (next === current) return;
    startTransition(async () => {
      try {
        await setProjectStatusAction(slug, next);
        toast.success(`Đã đổi trạng thái: ${STATUS_LABELS[next]}`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Đổi trạng thái thất bại",
        );
      }
    });
  }

  async function handleConfirmUpload() {
    if (!selectedFile || !openType) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("projectId", projectId);
    formData.append("type", openType);

    try {
      const res = await fetch("/api/upload/csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload thất bại");
      }
      const data = (await res.json()) as {
        uploadId: string;
        status: string;
        summary?: { inserted: number; conflicts: number };
      };

      if (data.status === "done" && data.summary) {
        toast.success(
          `Hoàn tất: ${data.summary.inserted} lead, ${data.summary.conflicts} conflict`,
        );
      } else {
        toast.success("Upload thành công, đang xử lý...");
      }

      setOpenType(null);
      setSelectedFile(null);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload thất bại",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleCloseDialog() {
    setOpenType(null);
    setSelectedFile(null);
  }

  const uploadLabel: Record<UploadType, string> = {
    facebook: "Facebook",
    bitrix: "Bitrix24",
    cost: "Chi phí",
  };

  const uploadDesc: Record<UploadType, string> = {
    facebook:
      "File CSV xuất từ Facebook Ads Manager. Yêu cầu cột: Created Time, Full Name, Phone, Campaign, Lead ID...",
    bitrix:
      "File CSV từ Bitrix24. Yêu cầu cột: Lead, Stage, Responsible, Updated Time, Comment.",
    cost: "File CSV báo cáo ngân sách. Yêu cầu cột: NGÀY (dd/MM/yyyy) + CHI TIÊU. Mỗi ngày 1 dòng.",
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 3 nút Upload */}
        <Button
          size="sm"
          onClick={() => setOpenType("facebook")}
          disabled={pending}
        >
          <Upload className="mr-1 h-4 w-4" />
          Upload FB
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpenType("bitrix")}
          disabled={pending}
        >
          <Upload className="mr-1 h-4 w-4" />
          Upload Bitrix
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpenType("cost")}
          disabled={pending}
        >
          <Upload className="mr-1 h-4 w-4" />
          Chi phí
        </Button>

        {/* Chỉnh sửa */}
        <Link
          href={`/projects/${slug}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Pencil className="h-4 w-4" />
          Chỉnh sửa
        </Link>

        {/* Đổi trạng thái */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
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

      {/* Upload Dialog — 2 bước: chọn file → confirm */}
      <Dialog open={openType !== null} onOpenChange={(o) => !o && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Upload CSV {openType ? uploadLabel[openType] : ""}
            </DialogTitle>
            <DialogDescription>
              {openType ? uploadDesc[openType] : ""}
            </DialogDescription>
          </DialogHeader>

          {/* Bước 1: Chọn file */}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-md border border-input p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />

          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Max 4MB. File sẽ được parse + match async.
          </p>

          {/* Bước 2: Nút xác nhận */}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={handleCloseDialog}>
              Huỷ
            </Button>
            <Button
              onClick={handleConfirmUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Đang tải lên..." : "Tải lên"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
