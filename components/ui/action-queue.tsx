"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon, Clock } from "lucide-react";
import { Button } from "./button";

interface ActionQueueItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  age?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ActionQueueProps {
  items: ActionQueueItem[];
  emptyMessage?: string;
  className?: string;
  maxItems?: number;
  onViewAll?: () => void;
  totalCount?: number;
}

export function ActionQueue({
  items,
  emptyMessage = "No pending actions",
  className,
  maxItems,
  onViewAll,
  totalCount,
}: ActionQueueProps) {
  const displayed = maxItems ? items.slice(0, maxItems) : items;
  const remaining = totalCount
    ? totalCount - displayed.length
    : items.length - displayed.length;

  if (items.length === 0) {
    return (
      <div className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {displayed.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 min-h-[44px]"
          >
            {Icon && (
              <div
                className={cn(
                  "rounded-full p-1.5 shrink-0",
                  item.iconColor || "bg-blue-500/10 text-blue-500",
                )}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.title}</p>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              )}
            </div>
            {item.age && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>{item.age}</span>
              </div>
            )}
            {item.actionLabel && item.onAction && (
              <Button
                variant="outline"
                size="sm"
                onClick={item.onAction}
                className="shrink-0 min-h-[36px]"
              >
                {item.actionLabel}
              </Button>
            )}
          </div>
        );
      })}
      {remaining > 0 && onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full py-2 text-center text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors min-h-[36px]"
        >
          and {remaining} more...
        </button>
      )}
    </div>
  );
}
