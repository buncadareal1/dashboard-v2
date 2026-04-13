import { Clock, LogOut } from "lucide-react";
import Link from "next/link";

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-zinc-50">
      <div className="mx-auto max-w-md space-y-6 rounded-xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <Clock className="h-8 w-8 text-amber-500" />
        </div>

        <div>
          <h1 className="text-xl font-semibold">Tài khoản đang chờ duyệt</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tài khoản của bạn đã được tạo thành công. Vui lòng chờ Admin duyệt
            và gán quyền truy cập.
          </p>
        </div>

        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Bước tiếp theo:</p>
          <ul className="mt-2 space-y-1 text-left">
            <li>1. Liên hệ Admin để được duyệt tài khoản</li>
            <li>2. Admin sẽ gán vai trò (Digital / GDDA) cho bạn</li>
            <li>3. Sau khi duyệt, đăng nhập lại để sử dụng</li>
          </ul>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          <LogOut className="h-4 w-4" />
          Quay lại trang đăng nhập
        </Link>
      </div>
    </div>
  );
}
