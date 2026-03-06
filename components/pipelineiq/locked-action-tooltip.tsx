"use client";

import { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock } from "lucide-react";

interface LockedActionTooltipProps {
  children: ReactNode;
  action?: string;
}

/**
 * Wraps a locked action with a tooltip: "Requires PipelineIQ — Unlock for $15/mo"
 */
export function LockedActionTooltip({
  children,
  action,
}: LockedActionTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="flex items-center gap-1.5 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-3 py-2 max-w-xs"
        >
          <Lock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs">
            {action ? `${action}: ` : ""}Requires PipelineIQ — Unlock for
            $15/mo
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
