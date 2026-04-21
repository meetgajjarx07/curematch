"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, ArrowUp, Sparkles, Loader2, Trash2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

interface Profile {
  age?: number;
  gender?: string;
  conditions?: string[];
  medications?: string[];
}

interface TrialChatPanelProps {
  nctId: string;
  trialTitle: string;
}

const SUGGESTED_QUESTIONS = [
  "Am I eligible for this trial?",
  "What would I have to do?",
  "How often would I visit the clinic?",
  "What are the main exclusion criteria?",
];

const STORAGE_KEY_PREFIX = "trialChat:";

export default function TrialChatPanel({ nctId, trialTitle }: TrialChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [backend, setBackend] = useState<{ provider: string; model: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate messages from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + nctId);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, [nctId]);

  // Persist messages
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (messages.length === 0) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + nctId);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + nctId, JSON.stringify(messages));
    } catch {}
  }, [messages, nctId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const getProfile = useCallback((): Profile | undefined => {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = sessionStorage.getItem("patientProfile");
      if (!raw) return undefined;
      const form = JSON.parse(raw);
      return {
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender,
        conditions: form.conditions,
        medications: form.medications,
      };
    } catch {
      return undefined;
    }
  }, []);

  const send = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || streaming) return;

      const next: ChatMessage[] = [
        ...messages,
        { role: "user", content: trimmed },
        { role: "assistant", content: "", pending: true },
      ];
      setMessages(next);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/chat/${nctId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.slice(0, -1).map(({ role, content }) => ({ role, content })),
            profile: getProfile(),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat API returned ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistant = "";
        let metaParsed = false;

        // Stream and update the last (pending) message incrementally
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          let chunk = decoder.decode(value, { stream: true });

          if (!metaParsed && chunk.startsWith("::meta ")) {
            const newlineIdx = chunk.indexOf("\n");
            if (newlineIdx >= 0) {
              const metaLine = chunk.slice(7, newlineIdx);
              try {
                setBackend(JSON.parse(metaLine));
              } catch {}
              chunk = chunk.slice(newlineIdx + 1);
              metaParsed = true;
            }
          }

          assistant += chunk;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: assistant, pending: true };
            return copy;
          });
        }

        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant, pending: false };
          return copy;
        });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = {
              role: "assistant",
              content: isAbort
                ? "(stopped)"
                : `Sorry — couldn't reach the assistant. ${err instanceof Error ? err.message : ""}`,
              pending: false,
            };
          }
          return copy;
        });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, nctId, streaming, getProfile]
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const clear = () => {
    setMessages([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask about this trial"
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/40 transition-all active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[14px] font-medium">Ask about this trial</span>
        </button>
      )}

      {/* Panel + backdrop */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <aside
            role="dialog"
            aria-label="Trial assistant chat"
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white border-l border-line-soft shadow-2xl flex flex-col"
            style={{ animation: "slideInRight 0.3s cubic-bezier(0.22, 1, 0.36, 1)" }}
          >
            {/* Header */}
            <header className="flex items-start gap-3 px-5 py-4 border-b border-line-soft">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-accent" strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-fg leading-tight">
                  Ask about this trial
                </p>
                <p className="text-[11px] text-fg-faint truncate leading-tight mt-0.5">
                  {trialTitle}
                </p>
                {backend && (
                  <p className="text-[10px] text-fg-faint mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-success mr-1" />
                    {backend.provider} · {backend.model}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clear}
                    aria-label="Clear conversation"
                    className="w-8 h-8 rounded-full hover:bg-paper-alt flex items-center justify-center text-fg-faint hover:text-fg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full hover:bg-paper-alt flex items-center justify-center text-fg-faint hover:text-fg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-paper-alt">
                    <p className="text-[13px] text-fg-soft leading-relaxed">
                      I&apos;m a clinical trial assistant. Ask me anything about this
                      specific trial — I&apos;ll answer only from its published eligibility
                      text. I won&apos;t make up medical details.
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint mb-2">
                      Try asking
                    </p>
                    <div className="space-y-1.5">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="w-full text-left px-3 py-2 rounded-lg bg-paper-alt hover:bg-line-soft text-[13px] text-fg transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-accent text-white rounded-br-md"
                        : "bg-paper-alt text-fg rounded-bl-md"
                    }`}
                  >
                    {msg.content ? (
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1.5 py-1">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="w-1.5 h-1.5 rounded-full bg-fg-faint"
                            style={{ animation: `pulse 1.2s ease-in-out ${d * 0.15}s infinite` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="px-5 py-2 border-t border-line-soft bg-paper-alt/50">
              <p className="text-[10px] text-fg-faint leading-snug">
                Not medical advice. Answers are grounded in this trial&apos;s public text only.
                Verify with the trial&apos;s investigators before acting.
              </p>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-line-soft">
              <div className="flex items-end gap-2 px-3 py-2 bg-paper-alt rounded-2xl focus-within:ring-2 focus-within:ring-accent/30 transition-all">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask about this trial…"
                  rows={1}
                  disabled={streaming}
                  className="flex-1 bg-transparent text-[14px] outline-none resize-none max-h-32 leading-relaxed py-1 disabled:opacity-50"
                />
                {streaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop"
                    className="w-8 h-8 rounded-full bg-fg text-white flex items-center justify-center hover:bg-dark transition-colors"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send"
                    className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </form>
          </aside>

          <style jsx>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(0.85); }
              50% { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </>
      )}
    </>
  );
}
