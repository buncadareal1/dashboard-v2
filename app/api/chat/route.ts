import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { getSessionUser } from "@/lib/auth/session";
import { getAccessibleProjectIds } from "@/lib/auth/guards";
import { createDashboardTools } from "@/lib/ai/tools";
import { rateLimit } from "@/lib/utils/rate-limit";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ok, remaining } = rateLimit(`chat:${user.id}`, 20, 3600000);
    if (!ok) {
      return Response.json(
        { error: "Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau." },
        { status: 429 },
      );
    }

    const { messages }: { messages: UIMessage[] } = await req.json();

    const accessibleProjectIds = await getAccessibleProjectIds(
      user.id,
      user.role,
    );

    const tools = createDashboardTools(accessibleProjectIds);

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: `Bạn là AI analyst cho dashboard quản lý lead bất động sản của công ty Smartland.

Vai trò: phân tích dữ liệu marketing lead, campaign, nhân viên sale, chi phí.

Quy tắc:
- Trả lời bằng tiếng Việt, ngắn gọn, có số liệu cụ thể.
- Luôn dùng tools để query data thật trước khi trả lời — KHÔNG bịa số.
- Nếu user hỏi về dự án không thuộc scope quyền của họ, nói "Bạn không có quyền xem dự án này".
- Format số tiền VN: dùng M (triệu), B (tỷ), K (nghìn). VD: 850M, 1.2B.
- Khi phân tích, đưa ra insight + đề xuất hành động cụ thể.

User hiện tại: ${user.name ?? user.email} (role: ${user.role})`,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (err) {
    console.error("[chat]", err);
    return Response.json(
      { error: "AI tạm thời không khả dụng. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}
