import { Hono } from "hono";
import { z } from "zod";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { getAccessibleProjectIds } from "../middleware/rbac.js";
import { rateLimit } from "../middleware/rate-limit.js";
import type { AuthUser } from "../middleware/auth.js";

import { createDashboardTools } from "../services/ai-tools.js";

type Env = { Variables: { user: AuthUser } };
const app = new Hono<Env>();

const ChatBodySchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    role: z.string(),
  }).passthrough()).min(1).max(50),
});

/**
 * POST /api/chat — AI analyst streaming
 */
app.post("/", async (c) => {
  const user = c.get("user");

  const { ok } = rateLimit(`chat:${user.id}`, 20, 3600000);
  if (!ok) {
    return c.json({ error: "Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau." }, 429);
  }

  const body = ChatBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
  const messages = body.data.messages as unknown as UIMessage[];
  const accessibleProjectIds = await getAccessibleProjectIds(user.id, user.role);

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
});

export default app;
