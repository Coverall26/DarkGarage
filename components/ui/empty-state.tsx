"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
  children?: React.ReactNode;
  /** Optional suite accent color hex (e.g. "#06B6D4"). Tints icon background and CTA button. */
  accentColor?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
  children,
  accentColor,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className,
      )}
    >
      <div
        className={cn("rounded-full p-4 mb-4", !accentColor && "bg-muted")}
        style={accentColor ? { backgroundColor: `${accentColor}1A` } : undefined}
        aria-hidden="true"
      >
        <Icon
          className={cn("h-8 w-8", !accentColor && "text-muted-foreground")}
          style={accentColor ? { color: accentColor } : undefined}
        />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {(actionLabel && (onAction || actionHref)) && (
        <div className="mt-4">
          {actionHref ? (
            <a href={actionHref}>
              <Button
                size="sm"
                style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                className={accentColor ? "text-white hover:opacity-90" : ""}
              >
                {actionLabel}
              </Button>
            </a>
          ) : (
            <Button
              size="sm"
              onClick={onAction}
              style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
              className={accentColor ? "text-white hover:opacity-90" : ""}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
