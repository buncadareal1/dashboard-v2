"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="mt-4 text-xl font-semibold">Đã có lỗi xảy ra</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {isDev
          ? error.message
          : "Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại."}
      </p>
      {isDev && error.digest && (
        <p className="mt-1 text-xs text-muted-foreground">
          Digest: <code>{error.digest}</code>
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>Thử lại</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
