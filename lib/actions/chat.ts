"use server";

import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { chatConversations, chatMessages } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

/**
 * Tạo conversation mới hoặc lưu messages vào conversation hiện có.
 */
export async function saveConversationAction(input: {
  conversationId?: string;
  title: string;
  messages: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
  }>;
}) {
  const user = await requireSession();

  if (input.messages.length > 200) throw new Error("Too many messages");
  if (input.title.length > 100) throw new Error("Title too long");
  if (input.messages.some((m) => m.content.length > 50000))
    throw new Error("Message content too long");

  let conversationId = input.conversationId;

  if (!conversationId) {
    // Tạo conversation mới
    const [conv] = await db
      .insert(chatConversations)
      .values({
        userId: user.id,
        title:
          input.title.length > 60
            ? input.title.slice(0, 57) + "..."
            : input.title,
      })
      .returning({ id: chatConversations.id });
    conversationId = conv.id;
  } else {
    // Update timestamp
    await db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));
  }

  // Xoá messages cũ rồi insert lại (idempotent — useChat rebuild full list)
  await db
    .delete(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId));

  if (input.messages.length > 0) {
    await db.insert(chatMessages).values(
      input.messages.map((m) => ({
        conversationId: conversationId!,
        role: m.role,
        content: m.content,
      })),
    );
  }

  return { conversationId };
}

/**
 * Load danh sách conversations gần nhất của user.
 */
export async function getConversationsAction() {
  const user = await requireSession();

  const conversations = await db
    .select({
      id: chatConversations.id,
      title: chatConversations.title,
      updatedAt: chatConversations.updatedAt,
    })
    .from(chatConversations)
    .where(eq(chatConversations.userId, user.id))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(20);

  return conversations;
}

/**
 * Load messages của 1 conversation.
 */
export async function getConversationMessagesAction(conversationId: string) {
  const user = await requireSession();

  // Verify ownership
  const conv = await db.query.chatConversations.findFirst({
    where: and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, user.id),
    ),
  });
  if (!conv) throw new Error("Conversation not found");

  const messages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt);

  return { conversation: conv, messages };
}

/**
 * Xoá conversation.
 */
export async function deleteConversationAction(conversationId: string) {
  const user = await requireSession();

  await db
    .delete(chatConversations)
    .where(
      and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.userId, user.id),
      ),
    );
}
