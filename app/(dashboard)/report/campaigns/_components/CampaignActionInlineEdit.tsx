"use client";

import { useState, useTransition } from "react";
import { upsertCampaignActionAction } from "@/lib/actions/campaign-actions";
import type { UpsertCampaignActionInput } from "@/lib/actions/campaign-actions";

type Priority = "urgent" | "today" | "week" | "none";

interface InitialData {
  priority: Priority;
  plan: string | null;
  contentNote: string | null;
  todayAction: string | null;
  actionDetail: string | null;
  assignee: string | null;
  deadline: string | null;
}

interface CampaignActionInlineEditProps {
  campaignId: string;
  campaignName: string;
  initialData: InitialData;
  canEdit: boolean;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "🔴 Khẩn",
  today: "🟠 Hôm nay",
  week: "🟡 Tuần này",
  none: "— Chưa",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  urgent: "text-red-600 font-semibold",
  today: "text-orange-600 font-semibold",
  week: "text-yellow-600",
  none: "text-muted-foreground",
};

export function CampaignActionInlineEdit({
  campaignId,
  campaignName,
  initialData,
  canEdit,
}: CampaignActionInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);

  // Form state — mirrors InitialData
  const [priority, setPriority] = useState<Priority>(initialData.priority);
  const [plan, setPlan] = useState(initialData.plan ?? "");
  const [contentNote, setContentNote] = useState(initialData.contentNote ?? "");
  const [todayAction, setTodayAction] = useState(initialData.todayAction ?? "");
  const [actionDetail, setActionDetail] = useState(initialData.actionDetail ?? "");
  const [assignee, setAssignee] = useState(initialData.assignee ?? "");
  const [deadline, setDeadline] = useState(initialData.deadline ?? "");

  function handleCancel() {
    // Reset to initial
    setPriority(initialData.priority);
    setPlan(initialData.plan ?? "");
    setContentNote(initialData.contentNote ?? "");
    setTodayAction(initialData.todayAction ?? "");
    setActionDetail(initialData.actionDetail ?? "");
    setAssignee(initialData.assignee ?? "");
    setDeadline(initialData.deadline ?? "");
    setErrorMsg(null);
    setIsEditing(false);
  }

  function handleSave() {
    setErrorMsg(null);
    const input: UpsertCampaignActionInput = {
      campaignId,
      priority,
      plan: plan.trim() || null,
      contentNote: contentNote.trim() || null,
      todayAction: todayAction.trim() || null,
      actionDetail: actionDetail.trim() || null,
      assignee: assignee.trim() || null,
      deadline: deadline || null,
    };

    startTransition(async () => {
      const result = await upsertCampaignActionAction(input);
      if (result.success) {
        setSuccessFlash(true);
        setIsEditing(false);
        setTimeout(() => setSuccessFlash(false), 2000);
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  // Read-only view
  if (!isEditing) {
    const hasAnyData =
      priority !== "none" || plan || todayAction || assignee || deadline;

    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {/* Priority */}
        <span className={["text-xs", PRIORITY_CLASS[priority]].join(" ")}>
          {PRIORITY_LABELS[priority]}
        </span>

        {/* Plan */}
        {plan ? (
          <span className="text-xs text-foreground">
            <span className="font-medium text-muted-foreground">Kế hoạch: </span>
            {plan}
          </span>
        ) : null}

        {/* Today action */}
        {todayAction ? (
          <span className="text-xs text-foreground">
            <span className="font-medium text-muted-foreground">Hành động: </span>
            {todayAction}
          </span>
        ) : null}

        {/* Assignee */}
        {assignee ? (
          <span className="text-xs text-foreground">
            <span className="font-medium text-muted-foreground">Người: </span>
            {assignee}
          </span>
        ) : null}

        {/* Deadline */}
        {deadline ? (
          <span className="text-xs text-foreground">
            <span className="font-medium text-muted-foreground">Deadline: </span>
            {deadline}
          </span>
        ) : null}

        {!hasAnyData && (
          <span className="text-xs text-muted-foreground italic">Chưa có kế hoạch</span>
        )}

        {/* Success flash */}
        {successFlash && (
          <span className="text-xs font-medium text-green-600">Đã lưu</span>
        )}

        {/* Edit button */}
        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="ml-auto rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Sửa
          </button>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Kế hoạch: <span className="text-foreground">{campaignName}</span>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Ưu tiên</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="none">— Chưa</option>
            <option value="urgent">🔴 Khẩn</option>
            <option value="today">🟠 Hôm nay</option>
            <option value="week">🟡 Tuần này</option>
          </select>
        </div>

        {/* Plan */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Kế hoạch</label>
          <input
            type="text"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="VD: Tăng budget +20%"
            maxLength={500}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Today action */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Hành động hôm nay</label>
          <input
            type="text"
            value={todayAction}
            onChange={(e) => setTodayAction(e.target.value)}
            placeholder="VD: Tăng adset ×1.2"
            maxLength={500}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Content note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Nhận xét content</label>
          <input
            type="text"
            value={contentNote}
            onChange={(e) => setContentNote(e.target.value)}
            placeholder="VD: Ảnh lifestyle tốt hơn"
            maxLength={500}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Action detail */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Chi tiết thực hiện</label>
          <input
            type="text"
            value={actionDetail}
            onChange={(e) => setActionDetail(e.target.value)}
            placeholder="VD: Vào Ads Manager → ..."
            maxLength={500}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Assignee */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Người thực hiện</label>
          <input
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="VD: MBuyer"
            maxLength={100}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Deadline */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Deadline</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Đang lưu..." : "Lưu"}
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
