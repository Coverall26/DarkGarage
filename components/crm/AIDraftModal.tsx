"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  X,
  Copy,
  Send,
  Pencil,
  RefreshCw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmailPurpose =
  | "follow_up"
  | "introduction"
  | "commitment_check"
  | "thank_you"
  | "update"
  | "re_engagement";

interface AIDraftModalProps {
  contactId: string;
  contactName: string;
  contactEmail: string;
  onClose: () => void;
  /** Populate EmailCompose with the drafted content */
  onUseInCompose?: (subject: string, body: string) => void;
  /** Send directly */
  onSend?: (subject: string, body: string) => void;
}

const PURPOSE_OPTIONS: { value: EmailPurpose; label: string; desc: string }[] = [
  { value: "follow_up", label: "Follow-up", desc: "Continue an existing conversation" },
  { value: "introduction", label: "Introduction", desc: "First contact with a prospect" },
  { value: "commitment_check", label: "Commitment Check", desc: "Check investment commitment status" },
  { value: "thank_you", label: "Thank You", desc: "Express gratitude for an action" },
  { value: "update", label: "Fund Update", desc: "Share fund progress or milestones" },
  { value: "re_engagement", label: "Re-engagement", desc: "Reconnect with an inactive contact" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIDraftModal({
  contactId,
  contactName,
  contactEmail,
  onClose,
  onUseInCompose,
  onSend,
}: AIDraftModalProps) {
  const [purpose, setPurpose] = useState<EmailPurpose>("follow_up");
  const [additionalContext, setAdditionalContext] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          purpose,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to generate draft");
        return;
      }

      const data = await res.json();
      setSubject(data.subject || "");
      setBody(data.body || "");
      setHasDraft(true);
    } catch {
      setError("Failed to connect to AI service");
    } finally {
      setLoading(false);
    }
  }, [contactId, purpose, additionalContext]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Fallback for clipboard failure
      },
    );
  }, [subject, body]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xl mx-4 bg-background rounded-lg border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" aria-hidden="true" />
            <h3 className="text-base font-semibold">AI Email Draft</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Recipient */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <div className="mt-0.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm">
              {contactName} &lt;{contactEmail}&gt;
            </div>
          </div>

          {/* Purpose Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email Purpose</label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as EmailPurpose)}>
              <SelectTrigger className="mt-0.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PURPOSE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{opt.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Context */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Additional Context <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="E.g., They viewed the PPM twice last week, mentioned interest in Q4..."
              rows={3}
              maxLength={500}
              className="mt-0.5 text-sm"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">{additionalContext.length}/500</p>
          </div>

          {/* Generate Button */}
          {!hasDraft && (
            <Button
              onClick={generateDraft}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {loading ? "Generating..." : "Generate Draft"}
            </Button>
          )}

          {/* Error */}
          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2" role="alert">
              {error}
            </div>
          )}

          {/* Draft Preview */}
          {hasDraft && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                  Generated Draft
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateDraft}
                  disabled={loading}
                  className="h-7 px-2 text-xs"
                >
                  <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                  Regenerate
                </Button>
              </div>

              {/* Subject Preview */}
              <div className="rounded-md border border-border p-3 bg-muted/30">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Subject
                </p>
                <p className="text-sm font-medium">{subject}</p>
              </div>

              {/* Body Preview */}
              <div className="rounded-md border border-border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Body
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{body}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {hasDraft && (
          <div className="p-4 border-t border-border flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 text-xs"
            >
              {copied ? (
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              ) : (
                <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copied ? "Copied!" : "Copy"}
            </Button>

            {onUseInCompose && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUseInCompose(subject, body)}
                className="h-8 text-xs"
              >
                <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Edit in Compose
              </Button>
            )}

            {onSend && (
              <Button
                size="sm"
                onClick={() => onSend(subject, body)}
                className="h-8 text-xs ml-auto"
              >
                <Send className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Send
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
