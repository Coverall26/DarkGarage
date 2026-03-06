"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Plus,
  Trash2,
  Send,
  Save,
  FileText,
  X,
  Users,
  GripVertical,
  CheckCircle2,
  PenTool,
  Calendar,
  Clock,
  Mail,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Recipient {
  name: string;
  email: string;
  role: "SIGNER" | "CC" | "CERTIFIED_DELIVERY";
  order: number;
}

interface FieldDef {
  id: string;
  type: string;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  recipientIndex: number;
  options?: string[];
}

type SigningMode = "SEQUENTIAL" | "PARALLEL";

// ---------------------------------------------------------------------------
// Step config
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Recipients", icon: Users },
  { label: "Fields", icon: PenTool },
  { label: "Review", icon: Eye },
] as const;

// Recipient colors for field assignment
const RECIPIENT_COLORS = [
  "#0066FF",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignSuiteSendClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Step 2: Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([
    { name: "", email: "", role: "SIGNER", order: 1 },
  ]);
  const [signingMode, setSigningMode] = useState<SigningMode>("SEQUENTIAL");

  // Step 3: Fields (simplified – placeholder for existing FieldPlacement component)
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; fields: FieldDef[] | null }>>([]);

  // Step 4: Review
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [expirationDays, setExpirationDays] = useState<number>(30);
  const [reminderFrequency, setReminderFrequency] = useState<number>(3);

  // Submission
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =========================================================================
  // Step 1: File Upload
  // =========================================================================

  const handleFileChange = async (f: File) => {
    const maxSize = 25 * 1024 * 1024;
    if (f.size > maxSize) {
      setError("File must be under 25 MB.");
      return;
    }

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!validTypes.includes(f.type)) {
      setError("Only PDF, DOCX, and XLSX files are supported.");
      return;
    }

    setFile(f);
    setFileName(f.name);
    setError(null);

    // Auto-set title from filename
    if (!title) {
      const nameWithoutExt = f.name.replace(/\.[^.]+$/, "");
      setTitle(nameWithoutExt);
    }

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // =========================================================================
  // Step 2: Recipients
  // =========================================================================

  const addRecipient = () => {
    setRecipients((prev) => [
      ...prev,
      { name: "", email: "", role: "SIGNER", order: prev.length + 1 },
    ]);
  };

  const removeRecipient = (idx: number) => {
    setRecipients((prev) =>
      prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, order: i + 1 })),
    );
  };

  const updateRecipient = (idx: number, field: keyof Recipient, value: string | number) => {
    setRecipients((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const moveRecipient = (fromIdx: number, direction: "up" | "down") => {
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= recipients.length) return;
    setRecipients((prev) => {
      const arr = [...prev];
      [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]];
      return arr.map((r, i) => ({ ...r, order: i + 1 }));
    });
  };

  // Fetch CRM contacts for "Add from PipelineIQ"
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [crmContacts, setCrmContacts] = useState<Array<{ email: string; firstName: string; lastName: string }>>([]);

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contacts?pageSize=50");
      if (res.ok) {
        const data = await res.json();
        setCrmContacts(data.contacts || []);
        setShowContactPicker(true);
      }
    } catch {
      // ignore
    }
  };

  const addContactAsRecipient = (contact: { email: string; firstName: string; lastName: string }) => {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    setRecipients((prev) => [
      ...prev,
      { name, email: contact.email, role: "SIGNER", order: prev.length + 1 },
    ]);
    setShowContactPicker(false);
  };

  // =========================================================================
  // Step 3: Fields (uses existing FieldPlacement via lazy load)
  // =========================================================================

  // Fetch templates for "Use Template"
  useEffect(() => {
    fetch("/api/esign/templates?pageSize=20")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.templates) setTemplates(data.templates);
      })
      .catch(() => {});
  }, []);

  const loadTemplateFields = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl?.fields) {
      setFields(tmpl.fields as FieldDef[]);
      setSelectedTemplate(templateId);
    }
  };

  // =========================================================================
  // Step 4: Submit
  // =========================================================================

  const handleSubmit = async (sendImmediately: boolean) => {
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
      let expiresAt: string | undefined;
      if (expirationDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + expirationDays);
        expiresAt = d.toISOString();
      }

      const body = {
        title: title.trim(),
        signingMode,
        emailSubject: emailSubject.trim() || undefined,
        emailMessage: emailMessage.trim() || undefined,
        expiresAt,
        reminderEnabled: true,
        reminderDays: reminderFrequency,
        maxReminders: 5,
        recipients: recipients.map((r) => ({
          name: r.name.trim(),
          email: r.email.trim().toLowerCase(),
          role: r.role,
          order: r.order,
        })),
        sourceFile: fileUrl,
        sourceFileName: fileName,
        sourceModule: "SIGNSUITE",
        fields: fields.length > 0 ? fields : undefined,
      };

      if (sendImmediately) {
        // One-step create + send via standalone endpoint
        const res = await fetch("/api/esign/standalone/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.error === "MODULE_NOT_AVAILABLE") {
            setError("SignSuite is not available on your plan. Please upgrade.");
          } else if (data.error === "LIMIT_EXCEEDED" || data.error?.includes("limit")) {
            setError("Monthly e-signature limit reached. Upgrade your plan for more.");
          } else {
            setError(data.error || "Failed to send envelope.");
          }
          setSending(false);
          return;
        }

        toast.success("Document sent for signature!");
      } else {
        // Save as draft — use existing create-only endpoint
        const res = await fetch("/api/esign/envelopes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to save draft.");
          setSending(false);
          return;
        }

        toast.success("Draft saved.");
      }

      router.push("/admin/signsuite");
    } catch {
      setError("Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  // =========================================================================
  // Navigation
  // =========================================================================

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 0:
        return !!fileUrl && !!title.trim();
      case 1:
        return recipients.some((r) => r.role === "SIGNER" && r.email.includes("@"));
      case 2:
        return true; // Fields are optional
      case 3:
        return true;
      default:
        return false;
    }
  }, [step, fileUrl, title, recipients]);

  const goNext = () => {
    if (step < STEPS.length - 1 && canProceed()) {
      setStep(step + 1);
      setError(null);
    }
  };
  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setError(null);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/signsuite")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          Send for Signature
        </h1>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = idx === step;
          const isComplete = idx < step;
          return (
            <div key={s.label} className="flex items-center flex-1">
              <button
                onClick={() => idx <= step && setStep(idx)}
                disabled={idx > step}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                  isActive
                    ? "bg-emerald-600/10 text-emerald-600 border border-emerald-600/20"
                    : isComplete
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 cursor-pointer"
                      : "text-muted-foreground"
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : isComplete
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={`h-0.5 w-4 flex-shrink-0 mx-1 ${
                  isComplete ? "bg-emerald-600" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400 mb-6" role="alert">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* ----------------------------------------------------------------- */}
        {/* Step 1: Upload Document */}
        {/* ----------------------------------------------------------------- */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Upload Document</h2>
              <p className="text-sm text-muted-foreground">
                Upload the document you want to send for signature.
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Document Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. NDA — Acme Capital"
                className="w-full px-3 py-2 text-base sm:text-sm border border-border rounded-md bg-background"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Document File <span className="text-red-500">*</span>
              </label>
              {fileUrl && fileName ? (
                <div className="flex items-center gap-3 p-4 border border-border rounded-lg bg-muted/30">
                  <FileText className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fileName}</p>
                    <p className="text-xs text-muted-foreground">Uploaded successfully</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setFile(null);
                      setFileUrl(null);
                      setFileName(null);
                    }}
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  ref={dropRef}
                  className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
                  <p className="text-sm text-foreground font-medium">
                    {uploading ? "Uploading..." : "Drop file here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOCX, or XLSX — Max 25 MB
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
                className="hidden"
              />
            </div>

            {/* PDF Preview */}
            {fileUrl && fileName?.toLowerCase().endsWith(".pdf") && (
              <div className="border border-border rounded-lg overflow-hidden">
                <iframe
                  src={fileUrl}
                  className="w-full h-[300px]"
                  title="PDF Preview"
                />
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 2: Recipients */}
        {/* ----------------------------------------------------------------- */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Add Recipients</h2>
              <p className="text-sm text-muted-foreground">
                Add the people who need to sign or receive a copy.
              </p>
            </div>

            {/* Signing Mode */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Signing Order
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSigningMode("SEQUENTIAL")}
                  className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                    signingMode === "SEQUENTIAL"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  In Order (Sequential)
                </button>
                <button
                  onClick={() => setSigningMode("PARALLEL")}
                  className={`px-4 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                    signingMode === "PARALLEL"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  All at Once (Parallel)
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {signingMode === "SEQUENTIAL"
                  ? "Each signer signs in the order listed."
                  : "All signers can sign simultaneously."}
              </p>
            </div>

            {/* Recipients list */}
            <div className="space-y-2">
              {recipients.map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-3 border border-border rounded-lg"
                >
                  {/* Drag handle / order */}
                  {signingMode === "SEQUENTIAL" && (
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveRecipient(idx, "up")}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                        aria-label="Move up"
                      >
                        <GripVertical className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Color dot for field assignment */}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }}
                    title={`Recipient ${idx + 1}`}
                  />

                  <input
                    type="text"
                    placeholder="Name"
                    value={r.name}
                    onChange={(e) => updateRecipient(idx, "name", e.target.value)}
                    className="flex-1 px-2 py-1.5 text-base sm:text-sm border border-border rounded bg-background min-w-0"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={r.email}
                    onChange={(e) => updateRecipient(idx, "email", e.target.value)}
                    className="flex-1 px-2 py-1.5 text-base sm:text-sm border border-border rounded bg-background min-w-0"
                  />
                  <select
                    value={r.role}
                    onChange={(e) => updateRecipient(idx, "role", e.target.value)}
                    className="px-2 py-1.5 text-xs border border-border rounded bg-background"
                  >
                    <option value="SIGNER">Signer</option>
                    <option value="CC">CC</option>
                    <option value="CERTIFIED_DELIVERY">Viewer</option>
                  </select>
                  {recipients.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeRecipient(idx)}
                      aria-label="Remove recipient"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addRecipient}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Recipient
              </Button>
              <Button variant="outline" size="sm" onClick={fetchContacts}>
                <Users className="h-3.5 w-3.5 mr-1" />
                Add from PipelineIQ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRecipients((prev) => [
                    ...prev,
                    { name: "Me (will be filled)", email: "", role: "SIGNER", order: prev.length + 1 },
                  ]);
                }}
              >
                Add Myself
              </Button>
            </div>

            {/* Contact Picker Modal */}
            {showContactPicker && (
              <div className="border border-border rounded-lg bg-background p-4 space-y-2 max-h-[300px] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Select Contact</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowContactPicker(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {crmContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts found.</p>
                ) : (
                  crmContacts.map((c) => (
                    <button
                      key={c.email}
                      onClick={() => addContactAsRecipient(c)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm flex items-center gap-2"
                    >
                      <Users className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      <span>{c.firstName} {c.lastName}</span>
                      <span className="text-muted-foreground ml-auto text-xs">{c.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 3: Place Fields */}
        {/* ----------------------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Place Fields</h2>
              <p className="text-sm text-muted-foreground">
                Add signature fields to your document. You can also skip this step and let signers add fields themselves.
              </p>
            </div>

            {/* Template Selector */}
            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Use Template
                </label>
                <select
                  value={selectedTemplate || ""}
                  onChange={(e) => {
                    if (e.target.value) loadTemplateFields(e.target.value);
                    else {
                      setFields([]);
                      setSelectedTemplate(null);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                >
                  <option value="">No template — place fields manually</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Field Placement Area */}
            <div className="border border-border rounded-lg bg-muted/20 p-6 min-h-[300px]">
              {fileUrl && fileName?.toLowerCase().endsWith(".pdf") ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-medium">Recipient Field Colors</h3>
                    {recipients.filter((r) => r.role === "SIGNER").map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {r.name || r.email || `Signer ${idx + 1}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Simplified field buttons */}
                  <div className="flex flex-wrap gap-2">
                    {["Signature", "Initials", "Date Signed", "Text", "Checkbox", "Name", "Email"].map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newField: FieldDef = {
                            id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                            type: type.toUpperCase().replace(" ", "_"),
                            label: type,
                            page: 1,
                            x: 10 + fields.length * 5,
                            y: 70 + fields.length * 5,
                            width: type === "Signature" ? 20 : 15,
                            height: type === "Signature" ? 5 : 3,
                            required: type === "Signature" || type === "Initials",
                            recipientIndex: 0,
                          };
                          setFields((prev) => [...prev, newField]);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {type}
                      </Button>
                    ))}
                  </div>

                  {/* Field List */}
                  {fields.length > 0 && (
                    <div className="space-y-1 mt-4">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Placed Fields</h4>
                      {fields.map((f, idx) => (
                        <div key={f.id} className="flex items-center gap-2 text-sm px-3 py-1.5 border border-border rounded bg-background">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: RECIPIENT_COLORS[f.recipientIndex % RECIPIENT_COLORS.length] }}
                          />
                          <span className="flex-1">{f.label}</span>
                          <select
                            value={f.recipientIndex}
                            onChange={(e) => {
                              setFields((prev) =>
                                prev.map((field, i) =>
                                  i === idx ? { ...field, recipientIndex: parseInt(e.target.value) } : field,
                                ),
                              );
                            }}
                            className="px-1.5 py-0.5 text-xs border border-border rounded bg-background"
                          >
                            {recipients.filter((r) => r.role === "SIGNER").map((r, i) => (
                              <option key={i} value={i}>
                                {r.name || r.email || `Signer ${i + 1}`}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PDF Preview with overlaid fields */}
                  <iframe
                    src={fileUrl}
                    className="w-full h-[400px] border border-border rounded"
                    title="Document preview"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-2" aria-hidden="true" />
                  <p className="text-sm">Upload a PDF to place fields on it</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 4: Review & Send */}
        {/* ----------------------------------------------------------------- */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Review & Send</h2>
              <p className="text-sm text-muted-foreground">
                Confirm the details and send for signature.
              </p>
            </div>

            {/* Email Settings */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  <Mail className="h-3.5 w-3.5 inline mr-1" aria-hidden="true" />
                  Email Subject
                </label>
                <input
                  type="text"
                  placeholder={`Please sign: ${title}`}
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 text-base sm:text-sm border border-border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Message to Signers
                </label>
                <textarea
                  placeholder="Add a personal message (optional)"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-base sm:text-sm border border-border rounded-md bg-background resize-none"
                />
              </div>
            </div>

            {/* Expiry & Reminders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5 inline mr-1" aria-hidden="true" />
                  Expires in (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  <Clock className="h-3.5 w-3.5 inline mr-1" aria-hidden="true" />
                  Reminder frequency (days)
                </label>
                <select
                  value={reminderFrequency}
                  onChange={(e) => setReminderFrequency(parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                >
                  <option value={1}>Every 1 day</option>
                  <option value={3}>Every 3 days</option>
                  <option value={7}>Every 7 days</option>
                </select>
              </div>
            </div>

            {/* Summary */}
            <div className="border border-border rounded-lg bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Summary</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Document</span>
                <span className="font-medium truncate">{title}</span>
                <span className="text-muted-foreground">File</span>
                <span className="font-medium truncate">{fileName}</span>
                <span className="text-muted-foreground">Signing Mode</span>
                <span className="font-medium">{signingMode === "SEQUENTIAL" ? "Sequential" : "Parallel"}</span>
                <span className="text-muted-foreground">Fields</span>
                <span className="font-mono text-sm">{fields.length} field(s)</span>
                <span className="text-muted-foreground">Expires</span>
                <span className="font-mono text-sm">{expirationDays} days</span>
              </div>

              {/* Recipients */}
              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Recipients ({recipients.length})
                </h4>
                {recipients.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm py-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: RECIPIENT_COLORS[idx % RECIPIENT_COLORS.length] }}
                    />
                    <span className="font-medium">{r.name || "(No name)"}</span>
                    <span className="text-muted-foreground">{r.email}</span>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 ml-auto">
                      {r.role === "SIGNER" ? "Signer" : r.role === "CC" ? "CC" : "Viewer"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
        <Button
          variant="ghost"
          onClick={step === 0 ? () => router.push("/admin/signsuite") : goBack}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        <div className="flex items-center gap-2">
          {step === 3 && (
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={sending}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Draft
            </Button>
          )}

          {step < 3 ? (
            <Button onClick={goNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit(true)}
              disabled={sending || !fileUrl}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="h-4 w-4 mr-1" />
              {sending ? "Sending..." : "Send for Signature"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
