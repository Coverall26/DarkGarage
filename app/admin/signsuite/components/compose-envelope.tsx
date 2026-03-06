"use client";

import { useState, useRef } from "react";
import {
  ArrowLeft,
  Upload,
  Plus,
  Trash2,
  Send,
  Save,
  FileText,
  X,
  Users,
  ArrowDownUp,
  Layers,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Recipient, SignatureTemplate, FieldPlacement } from "./signsuite-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComposeEnvelopeProps {
  onBack: () => void;
  onCreated: (envelopeId: string) => void;
  prefillTemplate?: SignatureTemplate | null;
}

type SigningMode = "SEQUENTIAL" | "PARALLEL" | "MIXED";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComposeEnvelope({
  onBack,
  onCreated,
  prefillTemplate,
}: ComposeEnvelopeProps) {
  // Form state
  const [title, setTitle] = useState(prefillTemplate?.name ?? "");
  const [signingMode, setSigningMode] = useState<SigningMode>("SEQUENTIAL");
  const [emailSubject, setEmailSubject] = useState(
    prefillTemplate?.defaultEmailSubject ?? "",
  );
  const [emailMessage, setEmailMessage] = useState(
    prefillTemplate?.defaultEmailMessage ?? "",
  );
  const [expirationDays, setExpirationDays] = useState<number | "">(
    prefillTemplate?.defaultExpirationDays ?? "",
  );
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);

  // File
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(
    prefillTemplate?.file ?? null,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recipients
  const defaultRecipients: Recipient[] = prefillTemplate?.defaultRecipients
    ? (prefillTemplate.defaultRecipients as Recipient[])
    : [{ name: "", email: "", role: "SIGNER", order: 1 }];
  const [recipients, setRecipients] = useState<Recipient[]>(defaultRecipients);

  // Scheduling
  const [scheduledSendAt, setScheduledSendAt] = useState<string>("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  // Submission
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // File upload
  // -------------------------------------------------------------------------

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const maxSize = 25 * 1024 * 1024;
    if (f.size > maxSize) {
      setError("File must be under 25 MB.");
      return;
    }

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(f.type)) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }

    setFile(f);
    setFileName(f.name);
    setError(null);

    // Upload to get a URL
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/file/browser-upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setFileUrl(data.url || data.blobUrl || null);
      } else {
        setError("Failed to upload file.");
      }
    } catch {
      setError("Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Recipients
  // -------------------------------------------------------------------------

  const addRecipient = () => {
    setRecipients((prev) => [
      ...prev,
      {
        name: "",
        email: "",
        role: "SIGNER",
        order: prev.length + 1,
      },
    ]);
  };

  const removeRecipient = (idx: number) => {
    setRecipients((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      if (signingMode === "MIXED") {
        // Preserve existing order values for MIXED mode (groups)
        return filtered;
      }
      // Re-number sequentially for SEQUENTIAL/PARALLEL
      return filtered.map((r, i) => ({ ...r, order: i + 1 }));
    });
  };

  const updateRecipient = (
    idx: number,
    field: keyof Recipient,
    value: string | number,
  ) => {
    setRecipients((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const handleSubmit = async (sendImmediately: boolean, scheduleDate?: string) => {
    setError(null);

    if (!title.trim()) {
      setError("Document title is required.");
      return;
    }
    if (!fileUrl) {
      setError("Please upload a document.");
      return;
    }

    const signers = recipients.filter((r) => r.role === "SIGNER");
    if (signers.length === 0) {
      setError("At least one signer is required.");
      return;
    }
    for (const r of recipients) {
      if (!r.email || !r.email.includes("@")) {
        setError(`Invalid email for recipient: ${r.name || "(unnamed)"}`);
        return;
      }
    }

    setSending(true);
    try {
      // Compute expiration
      let expiresAt: string | undefined;
      if (expirationDays && Number(expirationDays) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + Number(expirationDays));
        expiresAt = d.toISOString();
      }

      const body = {
        title: title.trim(),
        signingMode,
        emailSubject: emailSubject.trim() || undefined,
        emailMessage: emailMessage.trim() || undefined,
        expiresAt,
        reminderEnabled,
        reminderDays,
        maxReminders: 5,
        recipients: recipients.map((r) => ({
          name: r.name.trim(),
          email: r.email.trim().toLowerCase(),
          role: r.role,
          order: r.order,
        })),
        sourceFile: fileUrl,
        sourceFileName: fileName,
      };

      // Create envelope
      const res = await fetch("/api/esign/envelopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create envelope.");
        setSending(false);
        return;
      }

      const envelope = await res.json();

      // Send immediately or schedule
      if (sendImmediately || scheduleDate) {
        const sendBody = scheduleDate
          ? JSON.stringify({ scheduledSendAt: new Date(scheduleDate).toISOString() })
          : undefined;
        const sendRes = await fetch(
          `/api/esign/envelopes/${envelope.id}/send`,
          {
            method: "POST",
            headers: sendBody ? { "Content-Type": "application/json" } : undefined,
            body: sendBody,
          },
        );
        if (!sendRes.ok) {
          const data = await sendRes.json().catch(() => ({}));
          setError(data.error || (scheduleDate ? "Created but failed to schedule." : "Created but failed to send."));
        }
      }

      onCreated(envelope.id);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h2 className="text-lg font-semibold text-foreground">
          New Envelope
        </h2>
        {prefillTemplate && (
          <Badge variant="secondary" className="text-xs">
            From template: {prefillTemplate.name}
          </Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Document Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. NDA — Acme Capital"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
        />
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Document
        </label>
        {fileUrl && fileName ? (
          <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="text-sm truncate flex-1">{fileName}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                setFile(null);
                setFileUrl(null);
                setFileName(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {uploading
                ? "Uploading..."
                : "Drop PDF or DOCX here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max 25 MB
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Recipients */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Recipients
        </label>
        {signingMode === "MIXED" && (
          <p className="text-xs text-muted-foreground mb-2">
            Recipients with the same group number sign in parallel. Groups are
            processed in ascending order.
          </p>
        )}
        <div className="space-y-2">
          {(() => {
            // Group recipients by order for MIXED mode visual separators
            let lastOrder = -1;
            return recipients.map((r, idx) => {
              const showGroupDivider =
                signingMode === "MIXED" &&
                r.role === "SIGNER" &&
                r.order !== lastOrder &&
                idx > 0 &&
                recipients[idx - 1]?.role === "SIGNER";
              if (r.role === "SIGNER") lastOrder = r.order;
              return (
                <div key={idx}>
                  {showGroupDivider && (
                    <div className="flex items-center gap-2 my-1">
                      <div className="flex-1 border-t border-dashed border-border" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">
                        Group {r.order}
                      </span>
                      <div className="flex-1 border-t border-dashed border-border" />
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-2 p-3 border border-border rounded-md ${
                      signingMode === "MIXED" && r.role === "SIGNER"
                        ? "border-l-2 border-l-blue-400"
                        : ""
                    }`}
                  >
                    {signingMode === "MIXED" && r.role === "SIGNER" ? (
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={r.order}
                        onChange={(e) =>
                          updateRecipient(
                            idx,
                            "order",
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
                        className="w-10 px-1 py-1 text-xs font-mono text-center border border-border rounded bg-background"
                        title="Signing group number"
                      />
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                        {r.order}
                      </span>
                    )}
                    <input
                      type="text"
                      placeholder="Name"
                      value={r.name}
                      onChange={(e) =>
                        updateRecipient(idx, "name", e.target.value)
                      }
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background min-w-0"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={r.email}
                      onChange={(e) =>
                        updateRecipient(idx, "email", e.target.value)
                      }
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background min-w-0"
                    />
                    <select
                      value={r.role}
                      onChange={(e) =>
                        updateRecipient(idx, "role", e.target.value)
                      }
                      className="px-2 py-1.5 text-xs border border-border rounded bg-background"
                    >
                      <option value="SIGNER">Signer</option>
                      <option value="CC">CC</option>
                      <option value="CERTIFIED_DELIVERY">
                        Certified Delivery
                      </option>
                    </select>
                    {recipients.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => removeRecipient(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={addRecipient}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Recipient
        </Button>
      </div>

      {/* Signing Mode */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Signing Order
        </label>
        <div className="flex items-center gap-2">
          {(["SEQUENTIAL", "PARALLEL", "MIXED"] as SigningMode[]).map(
            (mode) => (
              <button
                key={mode}
                onClick={() => setSigningMode(mode)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  signingMode === mode
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {mode === "SEQUENTIAL"
                  ? "In Order"
                  : mode === "PARALLEL"
                    ? "Any Order"
                    : "Mixed"}
              </button>
            ),
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {signingMode === "SEQUENTIAL"
            ? "Each signer signs in order, one after another."
            : signingMode === "PARALLEL"
              ? "All signers can sign simultaneously."
              : "Signers with the same order number sign together, then the next group."}
        </p>
      </div>

      {/* Email Settings */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">
          Email Settings
        </label>
        <input
          type="text"
          placeholder="Email subject (optional)"
          value={emailSubject}
          onChange={(e) => setEmailSubject(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
        />
        <textarea
          placeholder="Personal message (optional)"
          value={emailMessage}
          onChange={(e) => setEmailMessage(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
        />
      </div>

      {/* Expiration + Reminders */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Expires in (days)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={expirationDays}
            onChange={(e) =>
              setExpirationDays(e.target.value ? parseInt(e.target.value) : "")
            }
            placeholder="No expiration"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="rounded"
            />
            Send reminders
          </label>
          {reminderEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Every</span>
              <input
                type="number"
                min={1}
                max={30}
                value={reminderDays}
                onChange={(e) =>
                  setReminderDays(parseInt(e.target.value) || 3)
                }
                className="w-16 px-2 py-1.5 text-sm border border-border rounded bg-background"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Picker */}
      {showSchedulePicker && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="datetime-local"
            value={scheduledSendAt}
            onChange={(e) => setScheduledSendAt(e.target.value)}
            min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
            className="px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground"
          />
          <Button
            size="sm"
            disabled={!scheduledSendAt || sending || !fileUrl}
            onClick={() => handleSubmit(false, scheduledSendAt)}
          >
            {sending ? "Scheduling..." : "Confirm Schedule"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowSchedulePicker(false);
              setScheduledSendAt("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={sending}
        >
          <Save className="h-4 w-4 mr-1" />
          Save as Draft
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowSchedulePicker(!showSchedulePicker)}
          disabled={sending || !fileUrl}
        >
          <Clock className="h-4 w-4 mr-1" />
          Schedule Send
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={sending || !fileUrl}
        >
          <Send className="h-4 w-4 mr-1" />
          {sending ? "Sending..." : "Send Now"}
        </Button>
      </div>
    </div>
  );
}
