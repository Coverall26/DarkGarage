"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Minimize2,
  Paperclip,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTier } from "@/lib/hooks/use-tier";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "lara";
  content: string;
  timestamp: Date;
  followUps?: string[];
}

// ---------------------------------------------------------------------------
// Session storage key for conversation persistence
// ---------------------------------------------------------------------------

const SESSION_KEY = "lara-chat-messages";

function loadPersistedMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m: Record<string, unknown>) => ({
      id: m.id as string,
      role: m.role as "user" | "lara",
      content: m.content as string,
      timestamp: new Date(m.timestamp as string),
      ...(m.followUps ? { followUps: m.followUps as string[] } : {}),
    }));
  } catch {
    return [];
  }
}

function persistMessages(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage full — silently ignore
  }
}

interface SuiteContext {
  suite: string;
  page: string;
  greeting: string;
  quickActions: string[];
}

// ---------------------------------------------------------------------------
// Context-aware greetings and quick actions
// ---------------------------------------------------------------------------

function getSuiteContext(pathname: string, userName?: string): SuiteContext {
  const name = userName || "there";

  if (pathname.startsWith("/admin/dashboard") || pathname === "/admin") {
    return {
      suite: "fundroom",
      page: "dashboard",
      greeting: `Hey ${name}! I can help you manage your raise, send documents, or check on your pipeline. What would you like to do?`,
      quickActions: [
        "Summarize my pending actions",
        "Draft a fund update email",
        "Remind me about upcoming deadlines",
      ],
    };
  }

  if (pathname.startsWith("/admin/signsuite")) {
    return {
      suite: "signsuite",
      page: "signsuite",
      greeting: `Need help with a signature? I can draft documents, set up templates, or check on pending envelopes.`,
      quickActions: [
        "Check pending signatures",
        "Help me create a template",
        "Remind me about expiring envelopes",
      ],
    };
  }

  if (pathname.startsWith("/admin/raiseroom") || pathname.startsWith("/admin/fund") || pathname.startsWith("/admin/offering")) {
    return {
      suite: "raiseroom",
      page: "raiseroom",
      greeting: `I can help you set up your raise room, analyze viewer engagement, or draft investor outreach.`,
      quickActions: [
        "Summarize viewer activity",
        "Draft investor outreach",
        "Check raise progress",
      ],
    };
  }

  if (
    pathname.startsWith("/admin/raise-crm") ||
    pathname.startsWith("/admin/outreach")
  ) {
    return {
      suite: "pipelineiq",
      page: "pipelineiq",
      greeting: `Want me to draft an outreach email, score your pipeline, or summarize investor activity?`,
      quickActions: [
        "Draft investor outreach",
        "Score my pipeline",
        "Summarize contact activity",
      ],
    };
  }

  if (
    pathname.startsWith("/admin/dataroom") ||
    pathname.startsWith("/datarooms") ||
    pathname.startsWith("/documents")
  ) {
    return {
      suite: "dataroom",
      page: "dataroom",
      greeting: `I can help organize your documents, set up sharing, or find specific files.`,
      quickActions: [
        "Find a document",
        "Set up sharing permissions",
        "Summarize viewer activity",
      ],
    };
  }

  if (
    pathname.startsWith("/admin/investors") ||
    pathname.startsWith("/admin/transactions") ||
    pathname.startsWith("/admin/approvals") ||
    pathname.startsWith("/admin/compliance")
  ) {
    return {
      suite: "fundroom",
      page: "fundroom",
      greeting: `Need help with capital calls, distributions, or compliance? I'm here.`,
      quickActions: [
        "Check pending approvals",
        "Summarize compliance status",
        "Remind me about upcoming deadlines",
      ],
    };
  }

  if (pathname.startsWith("/admin/analytics") || pathname.startsWith("/admin/reports")) {
    return {
      suite: "fundroom",
      page: "analytics",
      greeting: `I can help you generate reports, analyze trends, or compare performance.`,
      quickActions: [
        "Generate a pipeline summary",
        "What's my conversion rate?",
        "Compare monthly commitments",
      ],
    };
  }

  if (pathname.startsWith("/admin/settings")) {
    return {
      suite: "fundroom",
      page: "settings",
      greeting: `I can help you configure settings, manage team access, or set up integrations.`,
      quickActions: [
        "How do I configure email notifications?",
        "Help me set up custom branding",
        "Manage team permissions",
      ],
    };
  }

  return {
    suite: "fundroom",
    page: "general",
    greeting: `Hey ${name}! I'm Lara, your AI concierge. How can I help you today?`,
    quickActions: [
      "What can you help me with?",
      "Summarize my dashboard",
      "Draft an investor update email",
    ],
  };
}

// ---------------------------------------------------------------------------
// Lara Chat Component
// ---------------------------------------------------------------------------

export function LaraChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedMessages());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasShownGreeting, setHasShownGreeting] = useState(() => loadPersistedMessages().length > 0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const { tier } = useTier();

  const suiteContext = getSuiteContext(pathname);

  // Tier-based feature access
  const isFreeTier = tier === "FREE";
  const hasFullLara = tier === "FUNDROOM";

  // Persist messages to sessionStorage on every update
  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  // Listen for toggle event from header button
  useEffect(() => {
    function handleToggle() {
      setIsOpen((prev) => !prev);
    }
    window.addEventListener("toggle-ai-assistant", handleToggle);
    return () => window.removeEventListener("toggle-ai-assistant", handleToggle);
  }, []);

  // Show greeting when panel opens (only if no persisted history)
  useEffect(() => {
    if (isOpen && !hasShownGreeting) {
      const greetingMessage: ChatMessage = {
        id: `lara-greeting-${Date.now()}`,
        role: "lara",
        content: suiteContext.greeting,
        timestamp: new Date(),
        followUps: suiteContext.quickActions,
      };
      setMessages([greetingMessage]);
      setHasShownGreeting(true);
    }
  }, [isOpen, hasShownGreeting, suiteContext.greeting, suiteContext.quickActions]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Return focus to FAB when panel closes
  const closePanel = useCallback(() => {
    setIsOpen(false);
    // Return focus to the FAB button for keyboard users
    setTimeout(() => fabRef.current?.focus(), 50);
  }, []);

  // Escape closes panel and returns focus to FAB
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        closePanel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text || input.trim();
      if (!messageText || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/lara/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            context: {
              suite: suiteContext.suite,
              page: suiteContext.page,
              pathname,
              tier,
            },
          }),
        });

        let laraContent: string;
        let followUps: string[] | undefined;
        if (res.ok) {
          const data = await res.json();
          laraContent =
            data.response ||
            data.content ||
            data.message ||
            "I processed your request. Let me know if you need anything else.";
          followUps = data.followUps;
        } else if (res.status === 402) {
          const tierMessages: Record<string, string> = {
            FREE: "This feature is available on the Pro plan ($29/mo) or FundRoom plan ($79/mo). [Upgrade →](/admin/settings?tab=billing)",
            CRM_PRO: "This feature is available on the FundRoom plan ($79/mo). [Upgrade →](/admin/settings?tab=billing)",
            FUNDROOM: "Something went wrong. You should have access to this feature. Please contact support.",
          };
          laraContent = tierMessages[tier] || tierMessages.FREE;
        } else {
          laraContent =
            "I wasn't able to process that right now. Please try again.";
        }

        const laraMessage: ChatMessage = {
          id: `lara-${Date.now()}`,
          role: "lara",
          content: laraContent,
          timestamp: new Date(),
          followUps,
        };
        setMessages((prev) => [...prev, laraMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          id: `lara-error-${Date.now()}`,
          role: "lara",
          content: "Something went wrong. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, suiteContext.suite, suiteContext.page, pathname, tier],
  );

  // Find the last Lara message with follow-ups (for rendering after messages)
  const lastLaraFollowUps = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "lara" && messages[i].followUps?.length) {
        return messages[i].followUps;
      }
    }
    return undefined;
  })();

  return (
    <>
      {/* FAB Button — persistent bottom-right, purple Lara branding */}
      <button
        ref={fabRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white hover:scale-105",
          isOpen && "bg-[#7C3AED] scale-95",
        )}
        aria-label={isOpen ? "Close Lara AI assistant" : "Open Lara AI assistant"}
        aria-expanded={isOpen}
        aria-controls="lara-chat-panel"
        aria-haspopup="dialog"
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          id="lara-chat-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Lara AI assistant"
          className={cn(
            "fixed z-50 bg-background border border-border rounded-xl shadow-2xl flex flex-col transition-all duration-200",
            // Mobile: full screen overlay
            "bottom-0 right-0 left-0 top-0 sm:bottom-[88px] sm:right-6 sm:left-auto sm:top-auto sm:w-[380px] sm:h-[500px] sm:rounded-xl",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-gradient-to-r from-[#8B5CF6]/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-[#8B5CF6]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">Lara</p>
                <p className="text-xs text-muted-foreground">
                  Your AI Concierge
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={closePanel}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors sm:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close Lara"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={closePanel}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors hidden sm:flex"
                aria-label="Minimize Lara"
              >
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages — live region for screen readers */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-[#2563EB] text-white"
                      : "bg-[#8B5CF6]/10 text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      msg.role === "user"
                        ? "text-white/60"
                        : "text-muted-foreground",
                    )}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start" role="status" aria-label="Lara is typing">
                <div className="bg-[#8B5CF6]/10 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#8B5CF6]/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[#8B5CF6]/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[#8B5CF6]/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Follow-up suggestions — shown after Lara's last response */}
          {lastLaraFollowUps && !isLoading && messages.length > 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">
              {lastLaraFollowUps
                .slice(0, isFreeTier ? 2 : 3)
                .map((action) => (
                  <button
                    key={action}
                    onClick={() => handleSend(action)}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors min-h-[32px]"
                  >
                    {action}
                  </button>
                ))}
            </div>
          )}

          {/* Quick Actions — shown when no user messages yet */}
          {messages.length <= 1 && !isLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5" aria-label="Quick actions">
              {suiteContext.quickActions
                .slice(0, isFreeTier ? 2 : undefined)
                .map((action) => (
                  <button
                    key={action}
                    onClick={() => handleSend(action)}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors min-h-[32px]"
                  >
                    {action}
                  </button>
                ))}
              {isFreeTier && (
                <Link
                  href="/admin/settings?tab=billing"
                  className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] self-center ml-1 underline-offset-2 hover:underline transition-colors"
                >
                  Upgrade for more
                </Link>
              )}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              {!isFreeTier && (
                <button
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Attach file"
                  title={hasFullLara ? "Upload a document to ask about" : "Available on FundRoom tier"}
                  disabled={!hasFullLara}
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <label htmlFor="lara-chat-input" className="sr-only">Message Lara</label>
              <input
                id="lara-chat-input"
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Lara anything..."
                className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-[#8B5CF6] placeholder:text-muted-foreground/60"
                disabled={isLoading}
              />
              <Button
                size="sm"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="h-9 w-9 p-0 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          {/* Disclaimer footer */}
          <div className="px-4 pb-2 pt-0 flex-shrink-0">
            <p className="text-xs text-muted-foreground/60 text-center flex items-center justify-center gap-1">
              <ShieldAlert className="h-3 w-3 inline-block flex-shrink-0" aria-hidden="true" />
              <span>Lara is an AI assistant. Not investment, legal, or tax advice.</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
