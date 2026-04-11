"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { toggleCampaignStatusAction } from "@/lib/actions/campaign-actions";

interface CampaignStatusToggleProps {
  campaignId: string;
  statusLabel: "on" | "off";
}

export function CampaignStatusToggle({
  campaignId,
  statusLabel,
}: CampaignStatusToggleProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleCampaignStatusAction(campaignId);
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className="cursor-pointer transition-opacity hover:opacity-70 disabled:cursor-wait disabled:opacity-50"
      title={`Click để ${statusLabel === "on" ? "tạm dừng" : "bật lại"} chiến dịch`}
    >
      <Badge
        className={
          statusLabel === "on"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-zinc-100 text-zinc-600"
        }
      >
        {pending ? "..." : statusLabel.toUpperCase()}
      </Badge>
    </button>
  );
}
