"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  PENDING: {
    label: "Pending",
    variant: "default",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  APPROVED: {
    label: "Approved",
    variant: "default",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  PROCESSING: {
    label: "Processing",
    variant: "default",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  DISTRIBUTED: {
    label: "Distributed",
    variant: "default",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  COMPLETED: {
    label: "Completed",
    variant: "default",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  CANCELLED: {
    label: "Cancelled",
    variant: "destructive",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

interface DistributionStatusBadgeProps {
  status: string;
  className?: string;
}

export function DistributionStatusBadge({
  status,
  className = "",
}: DistributionStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    variant: "outline" as const,
    className: "",
  };

  return (
    <Badge variant={config.variant} className={`${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  DIVIDEND: {
    label: "Dividend",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  RETURN_OF_CAPITAL: {
    label: "Return of Capital",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  INTEREST: {
    label: "Interest",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  OTHER: {
    label: "Other",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

interface DistributionTypeBadgeProps {
  type: string;
  className?: string;
}

export function DistributionTypeBadge({
  type,
  className = "",
}: DistributionTypeBadgeProps) {
  const config = TYPE_CONFIG[type] || {
    label: type,
    className: "",
  };

  return (
    <Badge variant="outline" className={`${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
}
