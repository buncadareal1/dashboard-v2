"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserAction } from "@/lib/actions/users";

export function UserFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input = {
      name: (formData.get("name") as string)?.trim(),
      email: (formData.get("email") as string)?.trim().toLowerCase(),
      role: formData.get("role") as "admin" | "digital" | "gdda",
    };

    startTransition(async () => {
      try {
        await createUserAction(input);
        toast.success(`Tạo user ${input.email} thành công`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tạo user thất bại");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            Thêm user
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm user mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Họ và tên *</Label>
            <Input id="name" name="name" required placeholder="Nguyễn Văn A" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="user@smartland.vn"
            />
            <p className="text-xs text-muted-foreground">
              Phải thuộc domain công ty đã whitelist
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Vai trò *</Label>
            <select
              id="role"
              name="role"
              required
              defaultValue="digital"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="digital">Digital</option>
              <option value="gdda">GDDA</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang tạo..." : "Tạo user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
