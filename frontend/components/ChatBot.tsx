"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Bot, Minimize2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function callChatAPI(
  token: string | null,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Server error ${response.status}`);
  }

  const data = await response.json();
  return data.reply ?? "Sorry, I couldn't generate a response.";
}

export default function ChatBot() {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi${user?.full_name ? ` ${user.full_name.split(" ")[0]}` : ""}! 👋 I'm **Vertex AI**, your personal career assistant.\n\nI can help you with:\n- 📄 CV tips & optimisation\n- 🎯 Job search strategies\n- 💬 Interview preparation\n- 🚀 Career growth advice\n\nWhat can I help you with today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && !minimised) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, minimised]);

  useEffect(() => {
    if (open && !minimised) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimised]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build history for the API (exclude the welcome message from history)
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg].map(
        (m) => ({ role: m.role, content: m.content })
      );

      const reply = await callChatAPI(token, history);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          detail.includes("HF_TOKEN")
            ? "⚠️ The AI assistant isn't configured yet. Please add your `HF_TOKEN` to the `.env` file and restart the backend."
            : detail.includes("503") || detail.includes("502")
            ? "⚠️ The AI service is currently unavailable. Please check your `HF_TOKEN` and `HF_MODEL` settings in `.env`."
            : "Sorry, I ran into an issue. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, errorMsg]);
      console.error("[ChatBot]", err);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, token]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Simple markdown renderer (bold, bullets, line breaks)
  function renderContent(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Bold: **text**
      const boldLine = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      // Bullet points
      if (/^[-•]\s/.test(line)) {
        return (
          <div key={i} className="flex gap-2">
            <span className="mt-1 text-[#9b8cff] shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: boldLine.replace(/^[-•]\s/, "") }} />
          </div>
        );
      }
      if (line === "") return <div key={i} className="h-1" />;
      return (
        <div key={i} dangerouslySetInnerHTML={{ __html: boldLine }} />
      );
    });
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #6366f1)",
            boxShadow: "0 8px 32px rgba(124, 58, 237, 0.45)",
          }}
          aria-label="Open AI chat assistant"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all duration-300",
            minimised ? "bottom-6 h-14 w-72" : "bottom-6 h-[520px] w-[360px]"
          )}
          style={{
            background: "rgba(15, 14, 26, 0.97)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 24px 80px rgba(124, 58, 237, 0.3), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          {/* Header */}
          <div
            className="flex shrink-0 cursor-pointer items-center gap-3 px-4 py-3"
            style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
            onClick={() => minimised && setMinimised(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Vertex AI</p>
              {!minimised && (
                <p className="text-xs text-white/70">Career Assistant</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setMinimised((v) => !v); }}
                className="rounded p-1 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                aria-label={minimised ? "Expand chat" : "Minimise chat"}
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                className="rounded p-1 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!minimised && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-1"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
                      >
                        <Bot className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "rounded-tr-sm text-white"
                          : "rounded-tl-sm text-white/90"
                      )}
                      style={
                        msg.role === "user"
                          ? { background: "linear-gradient(135deg, #7c3aed, #6366f1)" }
                          : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      <div className="space-y-0.5">{renderContent(msg.content)}</div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
                    >
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div
                      className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-3 py-2.5"
                      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-[#9b8cff] animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div
                className="shrink-0 p-3 border-t border-white/10"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div
                  className="flex items-end gap-2 rounded-xl px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about your career…"
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none disabled:opacity-50 max-h-24"
                    style={{ lineHeight: "1.5" }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}
                    aria-label="Send message"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-white/25">
                  Powered by Claude · Press Enter to send
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
