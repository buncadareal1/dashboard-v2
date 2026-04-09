"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { updateAccountAction } from "@/lib/actions/users";

interface Props {
  defaultValues: {
    name: string;
    email: string;
    image: string;
    role: string;
  };
}

export function AccountForm({ defaultValues }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = ((fd.get("name") as string) ?? "").trim();
    const image = ((fd.get("image") as string) ?? "").trim();

    startTransition(async () => {
      try {
        await updateAccountAction({ name, image: image || undefined });
        toast.success("Đã cập nhật thông tin tài khoản");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cập nhật thất bại";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const initial = (defaultValues.name || defaultValues.email)[0]?.toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-xl">{initial}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{defaultValues.name || "—"}</p>
          <p className="text-sm text-muted-foreground">{defaultValues.email}</p>
          <Badge className="mt-1">{defaultValues.role.toUpperCase()}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Họ và tên</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={defaultValues.name}
            placeholder="Nguyễn Văn A"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" defaultValue={defaultValues.email} disabled />
          <p className="text-xs text-muted-foreground">
            Email không thể đổi (auth qua Google)
          </p>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="image">Ảnh đại diện (URL)</Label>
          <Input
            id="image"
            name="image"
            type="url"
            defaultValue={defaultValues.image}
            placeholder="https://..."
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
