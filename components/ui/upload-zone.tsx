"use client";

import { cn } from "@/lib/utils";
import { CloudUpload, File, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "./button";

interface UploadZoneProps {
  accept?: string;
  maxSizeMB?: number;
  onFileSelect: (file: File) => void;
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
  /** Show upload progress 0-100 */
  progress?: number;
  /** Currently selected file name */
  fileName?: string;
  onClear?: () => void;
}

export function UploadZone({
  accept = "application/pdf",
  maxSizeMB = 25,
  onFileSelect,
  label = "Drag and drop or click to upload",
  hint,
  className,
  disabled = false,
  progress,
  fileName,
  onClear,
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        setError(`File must be under ${maxSizeMB}MB`);
        return;
      }
      if (accept) {
        const acceptedTypes = accept.split(",").map((t) => t.trim());
        const matches = acceptedTypes.some((type) => {
          if (type.startsWith(".")) return file.name.endsWith(type);
          if (type.endsWith("/*")) return file.type.startsWith(type.replace("/*", "/"));
          return file.type === type;
        });
        if (!matches) {
          setError("File type not accepted");
          return;
        }
      }
      onFileSelect(file);
    },
    [accept, maxSizeMB, onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
      e.target.value = "";
    },
    [validateAndSelect],
  );

  if (fileName) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-muted/50 p-3",
          className,
        )}
      >
        <File className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {typeof progress === "number" && progress < 100 && (
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-blue-500 progress-bar-animated"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 shrink-0 before:absolute before:-inset-[6px] before:content-['']"
            onClick={onClear}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors duration-150 cursor-pointer",
        isDragOver
          ? "border-blue-500 bg-blue-500/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "opacity-50 cursor-not-allowed",
        error && "border-red-500",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      aria-label={label}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
        aria-hidden="true"
      />
      <CloudUpload
        className={cn(
          "h-8 w-8 mb-2",
          isDragOver ? "text-blue-500" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
