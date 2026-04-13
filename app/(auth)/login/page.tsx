import Image from "next/image";
import { signIn } from "@/lib/auth/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  domain: "Email không thuộc domain công ty được phép.",
  "not-provisioned":
    "Tài khoản chưa được cấp quyền. Vui lòng liên hệ admin.",
  deactivated: "Tài khoản đang chờ admin duyệt. Vui lòng liên hệ admin.",
  "no-email": "Tài khoản Google không có email.",
  Configuration: "Cấu hình OAuth lỗi. Liên hệ admin.",
  AccessDenied: "Truy cập bị từ chối.",
  default: "Đăng nhập thất bại. Vui lòng thử lại.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const errorCode = params.error;
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.default : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Dashboard Lead BĐS</CardTitle>
          <p className="text-sm text-muted-foreground">
            Đăng nhập bằng tài khoản Google công ty
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: params.callbackUrl ?? "/",
              });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <GoogleIcon className="mr-2 h-5 w-5" />
              Đăng nhập với Google Workspace
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Chỉ tài khoản thuộc domain công ty được phép truy cập.
            <br />
            Tài khoản mới sẽ được tạo tự động và chờ admin duyệt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Use Image to avoid unused import lint
void Image;
