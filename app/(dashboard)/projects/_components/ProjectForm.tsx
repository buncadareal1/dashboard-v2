"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProjectAction } from "@/lib/actions/projects";

/**
 * Form đăng dự án mới — không dùng react-hook-form (form đơn giản, dùng native).
 * Gọi server action createProjectAction.
 */
export function ProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);

    const fanpageNamesRaw = (formData.get("fanpageNames") as string) ?? "";
    const fanpageNames = fanpageNamesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const input = {
      name: (formData.get("name") as string)?.trim() ?? "",
      location: (formData.get("location") as string)?.trim() || undefined,
      budget: parseFloat((formData.get("budget") as string) ?? "0"),
      fbAdAccountId:
        (formData.get("fbAdAccountId") as string)?.trim() || undefined,
      googleAdsId:
        (formData.get("googleAdsId") as string)?.trim() || undefined,
      fanpageNames,
    };

    startTransition(async () => {
      try {
        await createProjectAction(input);
        // Server action redirects on success — code below chỉ chạy khi error.
      } catch (err) {
        // Rethrow NEXT_REDIRECT cho Next.js xử lý
        if (err && typeof err === "object" && "digest" in err) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : "Tạo dự án thất bại";
        toast.error(msg);
        setErrors({ form: msg });
      }
    });
    void router; // suppress unused warning, kept for future routing
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label="Tên dự án"
        name="name"
        required
        placeholder="VD: Vinhomes Grand Park"
        error={errors.name}
      />
      <Field
        label="Vị trí"
        name="location"
        placeholder="VD: Quận 9, TP.HCM"
      />
      <Field
        label="Ngân sách (VND)"
        name="budget"
        type="number"
        required
        placeholder="850000000"
      />
      <Field
        label="Facebook Ad Account ID"
        name="fbAdAccountId"
        placeholder="VD: act_1234567890"
      />
      <Field
        label="Google Ads Account (optional)"
        name="googleAdsId"
        placeholder="VD: 123-456-7890"
      />
      <Field
        label="Fanpages (phân tách bằng dấu phẩy)"
        name="fanpageNames"
        placeholder="FB Vinhomes, FB Sun Group"
      />

      {errors.form && (
        <p className="text-sm text-destructive">{errors.form}</p>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/projects")}
        >
          Huỷ
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang tạo..." : "Tạo dự án"}
        </Button>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  error,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
