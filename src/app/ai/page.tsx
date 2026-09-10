"use client";

import { useEffect, useRef, useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { PageShell, PageHeader } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";

/**
 * Mastra AI: a real Claude-backed chat assistant (see
 * /api/ai/chat/route.ts) grounded in Mastra's real architecture. Every
 * reply is a genuine model response — nothing here is scripted.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PRESET_QUESTIONS = [
  "What is Wayfinder and what does it do?",
  "How does KeeperHub actually execute my swap?",
  "What is the approval-hash security check?",
  "Why might my swap revert on-chain?",
  "Which tokens can I swap right now?",
];

export default function MastraAiPage() {
  const hydrated = useHydrated();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Mastra AI failed to respond.");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  if (!hydrated) return null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Real, Claude-backed"
        title="Mastra AI"
        description="Ask about how Wayfinder, KeeperHub, and Mastra's security model actually work. Real answers from Claude, grounded in this product's real architecture — not scripted, not a live data feed."
        action={<StatusPill tone="wayfinder" dot>Claude Opus 5</StatusPill>}
      />

      {messages.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-border-strong bg-surface px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent/50 hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="card flex min-h-[420px] flex-col p-4">
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {messages.length === 0 && !loading && (
            <div className="flex h-full min-h-[340px] items-center justify-center text-center text-sm text-text-muted">
              Ask a question, or pick one above.
            </div>
          )}

          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <ChatBubble key={i} message={m} />
            ))}

            {loading && (
              <div className="flex items-center gap-2 self-start rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-accent border-t-transparent spin-slow" />
                Thinking…
              </div>
            )}

            {error && (
              <div className="self-start rounded-2xl border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
          </div>
          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Mastra AI…"
            className="flex-1 rounded-lg border border-border-strong bg-transparent px-3 py-2.5 text-sm text-text-primary"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </PageShell>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser — non-fatal.
    }
  }

  if (isUser) {
    return (
      <div className="max-w-[75%] self-end rounded-2xl bg-accent px-4 py-2.5 text-sm text-white">
        {message.content}
      </div>
    );
  }

  return (
    <div className="group relative max-w-[75%] self-start rounded-2xl border border-border bg-surface px-4 py-2.5 pr-9 text-sm text-text-primary">
      <p className="whitespace-pre-wrap">{message.content}</p>
      <button
        onClick={handleCopy}
        title="Copy"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-surface-hover hover:text-text-primary group-hover:opacity-100"
      >
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 7.5L5.2 10.5L12 3" stroke="var(--success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="5" y="5" width="7.5" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 9V2.7A0.7 0.7 0 0 1 4.2 2h6.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
