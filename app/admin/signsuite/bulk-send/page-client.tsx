"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Users,
  Send,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Download,
  ClipboardPaste,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkRecipient {
  name: string;
  email: string;
  source: "manual" | "crm" | "csv" | "paste";
}

interface CrmContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

// ---------------------------------------------------------------------------
// Step config
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Document", icon: Upload },
  { label: "Recipients", icon: Users },
  { label: "Review & Send", icon: Send },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BulkSendClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sending, setSending] = useState(false);

  // Step 1 — Document
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Recipients
  const [recipients, setRecipients] = useState<BulkRecipient[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showCrmPicker, setShowCrmPicker] = useState(false);
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSelected, setCrmSelected] = useState<Set<string>>(new Set());
  const [recipientTab, setRecipientTab] = useState<"manual" | "crm" | "csv" | "paste">("manual");

  // Step 3 — Review
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [batchName, setBatchName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // -------------------------------------------------------------------------
  // File handling
  // -------------------------------------------------------------------------

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25 MB");
      return;
    }
    setFile(f);
    setFilePreviewUrl(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  // -------------------------------------------------------------------------
  // Manual recipient add
  // -------------------------------------------------------------------------

  const addManualRecipient = () => {
    const email = manualEmail.trim().toLowerCase();
    const name = manualName.trim();
    if (!email || !name) {
      toast.error("Name and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Invalid email address");
      return;
    }
    if (recipients.some((r) => r.email.toLowerCase() === email)) {
      toast.error("Recipient already added");
      return;
    }
    setRecipients((prev) => [...prev, { name, email, source: "manual" }]);
    setManualName("");
    setManualEmail("");
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------------------
  // CSV upload
  // -------------------------------------------------------------------------

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCsvRecipients(text, "csv");
    };
    reader.readAsText(f);
  };

  const parseCsvRecipients = (text: string, source: "csv" | "paste") => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const added: BulkRecipient[] = [];
    const existingEmails = new Set(recipients.map((r) => r.email.toLowerCase()));

    for (const line of lines) {
      // Skip header row
      if (/^name/i.test(line) && /email/i.test(line)) continue;

      const parts = line.split(/[,\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length >= 2) {
        const [name, email] = parts;
        const normalizedEmail = email.toLowerCase();
        if (
          name &&
          email &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) &&
          !existingEmails.has(normalizedEmail)
        ) {
          added.push({ name, email: normalizedEmail, source });
          existingEmails.add(normalizedEmail);
        }
      }
    }

    if (added.length === 0) {
      toast.error("No valid recipients found. Use format: Name, Email");
      return;
    }

    setRecipients((prev) => [...prev, ...added]);
    toast.success(`Added ${added.length} recipient${added.length > 1 ? "s" : ""}`);
    if (source === "paste") setPasteText("");
  };

  // -------------------------------------------------------------------------
  // CRM picker
  // -------------------------------------------------------------------------

  const fetchCrmContacts = useCallback(async (query: string) => {
    setCrmLoading(true);
    try {
      const params = new URLSearchParams({ search: query, limit: "50" });
      const res = await fetch(`/api/contacts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCrmContacts(data.contacts ?? []);
      }
    } catch {
      // silent
    } finally {
      setCrmLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showCrmPicker) {
      fetchCrmContacts(crmSearch);
    }
  }, [showCrmPicker, crmSearch, fetchCrmContacts]);

  const toggleCrmSelect = (contactId: string) => {
    setCrmSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const addCrmRecipients = () => {
    const existingEmails = new Set(recipients.map((r) => r.email.toLowerCase()));
    const selected = crmContacts.filter((c) => crmSelected.has(c.id));
    const added: BulkRecipient[] = [];

    for (const c of selected) {
      const email = c.email.toLowerCase();
      if (!existingEmails.has(email)) {
        added.push({
          name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email,
          email,
          source: "crm",
        });
        existingEmails.add(email);
      }
    }

    setRecipients((prev) => [...prev, ...added]);
    setCrmSelected(new Set());
    setShowCrmPicker(false);
    if (added.length > 0) {
      toast.success(`Added ${added.length} contact${added.length > 1 ? "s" : ""} from CRM`);
    }
  };

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const handleSend = async () => {
    if (!file || !title.trim() || recipients.length === 0) return;

    setSending(true);
    try {
      // Convert file to base64 for the API
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
      );

      const body = {
        title: title.trim(),
        batchName: batchName.trim() || undefined,
        emailSubject: emailSubject.trim() || undefined,
        emailMessage: emailMessage.trim() || undefined,
        expiresAt: expiresAt || undefined,
        sourceFile: `data:${file.type};base64,${base64}`,
        sourceStorageType: "BASE64",
        sourceFileName: file.name,
        sourceMimeType: file.type,
        sourceFileSize: file.size,
        recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
      };

      const res = await fetch("/api/esign/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to send");
        return;
      }

      const data = await res.json();

      if (data.status === "COMPLETED") {
        toast.success(`Sent to ${data.envelopeCount} recipient${data.envelopeCount > 1 ? "s" : ""}`);
      } else {
        toast.success(
          `Sending in progress — ${data.processedSoFar} sent, ${data.remaining} queued`,
        );
      }

      router.push("/admin/signsuite");
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step validation
  // -------------------------------------------------------------------------

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!file && !!title.trim();
      case 1:
        return recipients.length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  };

  // -------------------------------------------------------------------------
  // Render — Step indicator
  // -------------------------------------------------------------------------

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6 overflow-x-auto">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === step;
        const isDone = i < step;
        return (
          <div key={s.label} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-8 h-0.5 mx-1 ${
                  isDone ? "bg-emerald-500" : "bg-border"
                }`}
              />
            )}
            <button
              onClick={() => {
                if (i < step) setStep(i);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[36px] ${
                isActive
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                  : isDone
                    ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                    : "text-muted-foreground"
              }`}
              disabled={i > step}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          </div>
        );
      })}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render — Step 1: Document
  // -------------------------------------------------------------------------

  const renderDocumentStep = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Document Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Q1 2026 Investor Update"
          className="w-full px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background"
          maxLength={255}
        />
      </div>

      {!file ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-colors"
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Click to upload document</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, or XLSX — up to 25 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.doc"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border border-border rounded-lg p-4 flex items-center gap-3">
          <FileText className="h-8 w-8 text-emerald-600 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFile(null);
              setFilePreviewUrl(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {filePreviewUrl && file?.type === "application/pdf" && (
        <div className="border border-border rounded-lg overflow-hidden">
          <iframe
            src={filePreviewUrl}
            className="w-full h-64"
            title="Document preview"
          />
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render — Step 2: Recipients
  // -------------------------------------------------------------------------

  const RECIPIENT_TABS = [
    { key: "manual" as const, label: "Add Manually", icon: UserPlus },
    { key: "crm" as const, label: "From CRM", icon: Users },
    { key: "csv" as const, label: "CSV Upload", icon: Download },
    { key: "paste" as const, label: "Paste List", icon: ClipboardPaste },
  ];

  const renderRecipientsStep = () => (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Recipient count */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Recipients ({recipients.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Each recipient will receive their own copy to sign
          </p>
        </div>
        {recipients.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 hover:text-red-600"
            onClick={() => setRecipients([])}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Source tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {RECIPIENT_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setRecipientTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                recipientTab === t.key
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Manual add */}
      {recipientTab === "manual" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Full name"
            className="flex-1 px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background"
          />
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter") addManualRecipient();
            }}
          />
          <Button onClick={addManualRecipient} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}

      {/* CRM picker */}
      {recipientTab === "crm" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={crmSearch}
              onChange={(e) => setCrmSearch(e.target.value)}
              placeholder="Search contacts by name or email..."
              className="flex-1 px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background"
            />
            <Button
              onClick={addCrmRecipients}
              disabled={crmSelected.size === 0}
              className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
            >
              Add Selected ({crmSelected.size})
            </Button>
          </div>
          <div className="border border-border rounded-lg max-h-60 overflow-y-auto divide-y divide-border">
            {crmLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
                Loading contacts...
              </div>
            ) : crmContacts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No contacts found
              </div>
            ) : (
              crmContacts.map((c) => {
                const alreadyAdded = recipients.some(
                  (r) => r.email.toLowerCase() === c.email.toLowerCase(),
                );
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 ${
                      alreadyAdded ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={crmSelected.has(c.id)}
                      onChange={() => toggleCrmSelect(c.id)}
                      disabled={alreadyAdded}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>
                    {alreadyAdded && (
                      <Badge variant="outline" className="text-xs">Already added</Badge>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CSV upload */}
      {recipientTab === "csv" && (
        <div className="space-y-3">
          <div
            onClick={() => document.getElementById("csv-input")?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500 transition-colors"
          >
            <Download className="h-8 w-8 mx-auto text-muted-foreground mb-2" aria-hidden="true" />
            <p className="text-sm font-medium">Upload CSV file</p>
            <p className="text-xs text-muted-foreground mt-1">Format: Name, Email (one per line)</p>
            <input
              id="csv-input"
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-foreground mb-1">CSV Template</p>
            <pre className="text-xs text-muted-foreground font-mono">
              Name, Email{"\n"}John Doe, john@example.com{"\n"}Jane Smith, jane@example.com
            </pre>
          </div>
        </div>
      )}

      {/* Paste list */}
      {recipientTab === "paste" && (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste recipients (Name, Email — one per line)&#10;&#10;John Doe, john@example.com&#10;Jane Smith, jane@example.com"
            className="w-full px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background h-40 font-mono resize-y"
          />
          <Button
            onClick={() => parseCsvRecipients(pasteText, "paste")}
            disabled={!pasteText.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <ClipboardPaste className="h-4 w-4 mr-1.5" />
            Parse & Add
          </Button>
        </div>
      )}

      {/* Recipient list */}
      {recipients.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {recipients.map((r, i) => (
              <div
                key={`${r.email}-${i}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    r.source === "crm"
                      ? "border-amber-500/40 text-amber-600"
                      : r.source === "csv" || r.source === "paste"
                        ? "border-blue-500/40 text-blue-600"
                        : "border-border"
                  }`}
                >
                  {r.source}
                </Badge>
                <button
                  onClick={() => removeRecipient(i)}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                  aria-label={`Remove ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {recipients.length > 10 && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-border">
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Large batch — first 10 will be sent immediately, rest processed in background
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render — Step 3: Review & Send
  // -------------------------------------------------------------------------

  const renderReviewStep = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Summary card */}
      <div className="border border-border rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{file?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-mono tabular-nums text-foreground">
            {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            {recipients.length} envelope{recipients.length !== 1 ? "s" : ""} will be created
          </span>
        </div>
      </div>

      {/* Batch name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Batch Name (optional)
        </label>
        <input
          type="text"
          value={batchName}
          onChange={(e) => setBatchName(e.target.value)}
          placeholder={`Bulk: ${title}`}
          className="w-full px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background"
          maxLength={255}
        />
        <p className="text-xs text-muted-foreground mt-1">
          A label for this batch to find it later in the dashboard
        </p>
      </div>

      {/* Email subject */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Email Subject
        </label>
        <input
          type="text"
          value={emailSubject}
          onChange={(e) => setEmailSubject(e.target.value)}
          placeholder={`Please sign: ${title}`}
          className="w-full px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background"
          maxLength={255}
        />
      </div>

      {/* Email message */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Email Message (optional)
        </label>
        <textarea
          value={emailMessage}
          onChange={(e) => setEmailMessage(e.target.value)}
          placeholder="Optional message to include in the signing invitation email..."
          rows={3}
          className="w-full px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background resize-y"
          maxLength={5000}
        />
      </div>

      {/* Expiration */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Expiration Date (optional)
        </label>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-3 py-2.5 text-base sm:text-sm border border-border rounded-md bg-background"
          min={new Date().toISOString().slice(0, 16)}
        />
      </div>

      {/* Recipient preview */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">
          Recipients Preview
        </h3>
        <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y divide-border">
          {recipients.slice(0, 20).map((r, i) => (
            <div key={`${r.email}-${i}`} className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs text-muted-foreground font-mono w-6">{i + 1}</span>
              <span className="text-sm truncate flex-1">{r.name}</span>
              <span className="text-xs text-muted-foreground truncate">{r.email}</span>
            </div>
          ))}
          {recipients.length > 20 && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
              ... and {recipients.length - 20} more
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render — Main
  // -------------------------------------------------------------------------

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/signsuite")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Bulk Send</h1>
          <p className="text-sm text-muted-foreground">
            Send a document to multiple recipients at once
          </p>
        </div>
      </div>

      <StepIndicator />

      {/* Step content */}
      {step === 0 && renderDocumentStep()}
      {step === 1 && renderRecipientsStep()}
      {step === 2 && renderReviewStep()}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={sending || !canProceed()}
            className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1.5" />
                Send to {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
