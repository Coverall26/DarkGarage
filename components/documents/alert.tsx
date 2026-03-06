"use client";

import { useState } from "react";

import { AlertTriangleIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export default function AlertBanner({
  id,
  variant = "default",
  title,
  description,
  onClose,
}: {
  id: string;
  variant?: "default" | "destructive";
  title: string;
  description: React.ReactNode;
  onClose?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      id={id}
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4",
        variant === "destructive"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-border bg-muted/50 text-foreground",
      )}
    >
      <AlertTriangleIcon
        className={cn(
          "mt-0.5 h-5 w-5 flex-shrink-0",
          variant === "destructive"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="mt-1 text-sm opacity-80">{description}</div>
      </div>
      {onClose && (
        <button
          onClick={() => {
            setDismissed(true);
            onClose();
          }}
          className="flex-shrink-0 rounded-md p-1 hover:bg-muted"
          aria-label="Dismiss"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
