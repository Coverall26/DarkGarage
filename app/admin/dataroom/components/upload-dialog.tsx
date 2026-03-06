"use client";

import { useState, useRef } from "react";
import { Upload, X, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Upload Dialog — manual document upload to org vault
// ---------------------------------------------------------------------------

interface UploadDialogProps {
  teamId: string;
  onClose: () => void;
  onUploaded: () => void;
}

const SOURCE_TYPES = [
  { value: "MANUAL_UPLOAD", label: "Manual Upload" },
  { value: "WIRE_PROOF", label: "Wire Proof" },
  { value: "TAX_FORM", label: "Tax Form" },
  { value: "IDENTITY_DOCUMENT", label: "Identity Document" },
  { value: "SHARED_DOCUMENT", label: "Shared Document" },
] as const;

export function UploadDialog({
  teamId,
  onClose,
  onUploaded,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState("MANUAL_UPLOAD");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      setError("File must be under 25 MB.");
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceType", sourceType);
      formData.append("teamId", teamId);

      const res = await fetch("/api/dataroom/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onUploaded();
          onClose();
        }, 800);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Upload failed.");
      }
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Upload Document
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Source type */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Document Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
          >
            {SOURCE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            File
          </label>
          {file ? (
            <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/30">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm truncate flex-1">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setFile(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              <p className="text-sm text-muted-foreground">
                Click to select file
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Max 25 MB
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading || success}
          >
            {success ? (
              <>
                <Check className="h-4 w-4 mr-1" /> Filed
              </>
            ) : uploading ? (
              "Uploading..."
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" /> Upload & File
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
