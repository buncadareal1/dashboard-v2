"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Plus,
  History,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  saveConversationAction,
  getConversationsAction,
  getConversationMessagesAction,
  deleteConversationAction,
} from "@/lib/actions/chat";

type ConversationItem = {
  id: string;
  title: string;
  updatedAt: Date;
};

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevStatusRef = useRef<string>("ready");

  const [input, setInput] = useState("");
  const { messages, sendMessage, status, setMessages } = useChat();

  const isActive = status === "streaming" || status === "submitted";

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    if (open && !showHistory) inputRef.current?.focus();
  }, [open, showHistory]);

  // Auto-save khi stream xong (status chuyển từ streaming → ready)
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (prev === "streaming" && status === "ready" && messages.length > 0) {
      const textMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content:
            m.parts
              ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("") ?? "",
        }))
        .filter((m) => m.content.length > 0);

      if (textMessages.length > 0) {
        const title =
          textMessages.find((m) => m.role === "user")?.content ??
          "Cuộc trò chuyện mới";

        saveConversationAction({
          conversationId,
          title,
          messages: textMessages,
        }).then((result) => {
          if (!conversationId) {
            setConversationId(result.conversationId);
          }
        });
      }
    }
  }, [status, messages, conversationId]);

  // Load conversations khi mở history
  const loadConversations = useCallback(async () => {
    const convos = await getConversationsAction();
    setConversations(
      convos.map((c) => ({
        ...c,
        updatedAt: new Date(c.updatedAt),
      })),
    );
  }, []);

  function handleOpenHistory() {
    setShowHistory(true);
    loadConversations();
  }

  async function handleLoadConversation(id: string) {
    const data = await getConversationMessagesAction(id);
    setConversationId(id);
    // Convert DB messages → useChat UIMessage format
    setMessages(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: m.content }],
        createdAt: new Date(m.createdAt),
      })),
    );
    setShowHistory(false);
  }

  async function handleDeleteConversation(id: string) {
    await deleteConversationAction(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (conversationId === id) {
      handleNewChat();
    }
  }

  function handleNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setShowHistory(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isActive) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Mở AI Chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[540px] w-[400px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold">AI Analyst</p>
                <p className="text-xs opacity-80">Phân tích dữ liệu marketing</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleNewChat}
                className="rounded p-1 hover:bg-white/20"
                aria-label="Cuộc trò chuyện mới"
                title="Cuộc trò chuyện mới"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={handleOpenHistory}
                className="rounded p-1 hover:bg-white/20"
                aria-label="Lịch sử"
                title="Lịch sử trò chuyện"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-white/20"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* History panel */}
          {showHistory ? (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Lịch sử trò chuyện</p>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-xs text-primary hover:underline"
                >
                  Quay lại
                </button>
              </div>
              {conversations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có cuộc trò chuyện nào.
                </p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className="group flex items-center justify-between rounded-md border p-2.5 hover:bg-muted"
                    >
                      <button
                        onClick={() => handleLoadConversation(c.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium">
                          {c.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.updatedAt.toLocaleDateString("vi-VN")}
                        </p>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(c.id);
                        }}
                        className="ml-2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Xoá"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto p-4"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Bot className="h-12 w-12 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">
                      Xin chào! Tôi là AI Analyst
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Hỏi tôi về hiệu quả campaign, lead, nhân viên, chi phí...
                    </p>
                    <div className="mt-4 space-y-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage({ text: s })}
                          className="block w-full rounded-md border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {m.role !== "user" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      {m.parts?.map((part, i) => {
                        if (part.type === "text") {
                          return (
                            <span key={i} className="whitespace-pre-wrap">
                              {part.text}
                            </span>
                          );
                        }
                        if (part.type.startsWith("tool-")) {
                          return (
                            <div
                              key={i}
                              className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Đang truy vấn: {part.type.replace("tool-", "")}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                    {m.role === "user" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-700">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isActive &&
                  messages[messages.length - 1]?.role !== "assistant" && (
                    <div className="flex gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 border-t p-3"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Hỏi về lead, campaign, nhân viên..."
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  disabled={isActive}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isActive || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

const SUGGESTIONS = [
  "Tổng quan hiệu quả các dự án",
  "Phân tích campaign nào kém hiệu quả nhất",
  "Nhân viên nào có tỉ lệ F1 cao nhất",
  "Chi phí CPL trung bình là bao nhiêu",
];
