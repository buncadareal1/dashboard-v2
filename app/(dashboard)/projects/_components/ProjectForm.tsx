"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import {
  createProjectAction,
  updateProjectAction,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/lib/actions/projects";

export interface ProjectFormDefaults {
  slug?: string;
  name: string;
  location: string;
  fbAdAccountId: string;
  googleAdsId: string;
  fanpageNames: string;
  digitalUserIds: string[];
  gddaUserIds: string[];
}

interface ProjectFormProps {
  mode?: "create" | "edit";
  defaultValues?: ProjectFormDefaults;
  digitalOptions: MultiSelectOption[];
  gddaOptions: MultiSelectOption[];
}

const EMPTY_DEFAULTS: ProjectFormDefaults = {
  name: "",
  location: "",
  fbAdAccountId: "",
  googleAdsId: "",
  fanpageNames: "",
  digitalUserIds: [],
  gddaUserIds: [],
};

/**
 * Form tạo + sửa dự án — native form + server action.
 */
export function ProjectForm({
  mode = "create",
  defaultValues,
  digitalOptions,
  gddaOptions,
}: ProjectFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const initial = defaultValues ?? EMPTY_DEFAULTS;
  const [digitalIds, setDigitalIds] = useState<string[]>(initial.digitalUserIds);
  const [gddaIds, setGddaIds] = useState<string[]>(initial.gddaUserIds);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);

    const fanpageNamesRaw = (formData.get("fanpageNames") as string) ?? "";
    const fanpageNames = fanpageNamesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const base = {
      name: (formData.get("name") as string)?.trim() ?? "",
      location: (formData.get("location") as string)?.trim() || undefined,
      fbAdAccountId:
        (formData.get("fbAdAccountId") as string)?.trim() || undefined,
      googleAdsId:
        (formData.get("googleAdsId") as string)?.trim() || undefined,
      fanpageNames,
      digitalUserIds: digitalIds,
      gddaUserIds: gddaIds,
    } satisfies CreateProjectInput & UpdateProjectInput;

    startTransition(async () => {
      try {
        if (mode === "edit") {
          if (!initial.slug) throw new Error("Thiếu slug để cập nhật");
          await updateProjectAction(initial.slug, base);
          toast.success("Đã lưu thay đổi");
          router.push(`/projects/${initial.slug}`);
          router.refresh();
        } else {
          await createProjectAction(base);
        }
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) {
          throw err;
        }
        const msg =
          err instanceof Error
            ? err.message
            : mode === "edit"
              ? "Lưu thay đổi thất bại"
              : "Tạo dự án thất bại";
        toast.error(msg);
        setErrors({ form: msg });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field
        label="Tên dự án"
        name="name"
        required
        placeholder="VD: Vinhomes Grand Park"
        defaultValue={initial.name}
        error={errors.name}
      />
      <Field
        label="Vị trí"
        name="location"
        placeholder="VD: Quận 9, TP.HCM"
        defaultValue={initial.location}
      />
      <Field
        label="Facebook Ad Account ID"
        name="fbAdAccountId"
        placeholder="VD: act_1234567890"
        defaultValue={initial.fbAdAccountId}
      />
      <Field
        label="Google Ads Account (optional)"
        name="googleAdsId"
        placeholder="VD: 123-456-7890"
        defaultValue={initial.googleAdsId}
      />
      <Field
        label="Fanpages (phân tách bằng dấu phẩy)"
        name="fanpageNames"
        placeholder="FB Vinhomes, FB Sun Group"
        defaultValue={initial.fanpageNames}
      />

      <div className="space-y-1.5">
        <Label>Digital phụ trách</Label>
        <MultiSelect
          name="digitalUserIds"
          options={digitalOptions}
          value={digitalIds}
          onChange={setDigitalIds}
          placeholder="Chọn digital..."
        />
      </div>

      <div className="space-y-1.5">
        <Label>GĐ Dự án (GDDA)</Label>
        <MultiSelect
          name="gddaUserIds"
          options={gddaOptions}
          value={gddaIds}
          onChange={setGddaIds}
          placeholder="Chọn GDDA..."
        />
      </div>

      {errors.form && (
        <p className="text-sm text-destructive">{errors.form}</p>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              mode === "edit" && initial.slug
                ? `/projects/${initial.slug}`
                : "/projects",
            )
          }
        >
          Huỷ
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === "edit"
              ? "Đang lưu..."
              : "Đang tạo..."
            : mode === "edit"
              ? "Lưu thay đổi"
              : "Tạo dự án"}
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
  defaultValue?: string;
  error?: string;
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
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
        defaultValue={defaultValue}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
