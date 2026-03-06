"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Trash2,
  PenLine,
  Eye,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { SignatureTemplate } from "./signsuite-types";

interface TemplateUsage {
  limit: number | null;
  used: number;
  canCreate: boolean;
}

export function TemplateList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SignatureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [templateUsage, setTemplateUsage] = useState<TemplateUsage | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/esign/templates?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
        if (data.templateUsage) {
          setTemplateUsage(data.templateUsage);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/esign/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        if (templateUsage) {
          setTemplateUsage({
            ...templateUsage,
            used: Math.max(0, templateUsage.used - 1),
            canCreate: true,
          });
        }
      }
    } catch {
      // silent
    }
  };

  const handleDuplicate = async (id: string) => {
    setDuplicating(id);
    try {
      const res = await fetch(`/api/esign/templates/${id}/duplicate`, {
        method: "POST",
      });
      if (res.ok) {
        const newTpl = await res.json();
        setTemplates((prev) => [newTpl, ...prev]);
        if (templateUsage) {
          const newUsed = templateUsage.used + 1;
          setTemplateUsage({
            ...templateUsage,
            used: newUsed,
            canCreate: templateUsage.limit === null || newUsed < templateUsage.limit,
          });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "SIGNATURE_TEMPLATE_LIMIT_REACHED") {
          alert("Template limit reached. Upgrade your plan to create more templates.");
        }
      }
    } catch {
      // silent
    } finally {
      setDuplicating(null);
    }
  };

  const atLimit = templateUsage !== null && !templateUsage.canCreate;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border border-border rounded-lg animate-pulse"
          >
            <div className="h-10 w-10 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tier usage bar */}
      {templateUsage && templateUsage.limit !== null && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Templates</span>
            <span className="font-mono tabular-nums text-sm font-medium">
              {templateUsage.used} / {templateUsage.limit}
            </span>
            {/* Progress bar */}
            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  templateUsage.used >= templateUsage.limit
                    ? "bg-red-500"
                    : templateUsage.used >= templateUsage.limit * 0.8
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(100, (templateUsage.used / templateUsage.limit) * 100)}%`,
                }}
              />
            </div>
          </div>
          {atLimit && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => router.push("/admin/settings?tab=billing")}
            >
              <ArrowUpRight className="h-3 w-3 mr-1" />
              Upgrade
            </Button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background"
          />
        </div>
        <Button
          size="sm"
          onClick={() => router.push("/admin/signsuite/send")}
          disabled={atLimit}
          title={atLimit ? "Template limit reached — upgrade to create more" : undefined}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {/* Upgrade banner when at limit */}
      {atLimit && templates.length > 0 && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Template limit reached
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            You&apos;ve used all {templateUsage?.limit} templates on your plan.
            Upgrade to create more templates or duplicate existing ones.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 text-xs border-amber-300 dark:border-amber-600"
            onClick={() => router.push("/admin/settings?tab=billing")}
          >
            <ArrowUpRight className="h-3 w-3 mr-1" />
            View Plans
          </Button>
        </div>
      )}

      {/* Empty */}
      {templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Save frequently used documents as templates for faster sending."
          accentColor="#10B981"
        >
          <Button
            size="sm"
            onClick={() => router.push("/admin/signsuite/send")}
            disabled={atLimit}
            style={{ backgroundColor: "#10B981", borderColor: "#10B981" }}
            className="text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Template
          </Button>
        </EmptyState>
      )}

      {/* List */}
      <div className="space-y-2">
        {templates.map((tpl) => {
          const fieldCount = Array.isArray(tpl.fields)
            ? tpl.fields.length
            : 0;
          const recipientCount = Array.isArray(tpl.defaultRecipients)
            ? tpl.defaultRecipients.length
            : 0;

          return (
            <div
              key={tpl.id}
              className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors group"
            >
              {/* Icon */}
              <div className="flex-shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 p-2.5">
                <PenLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {tpl.name}
                </p>
                {tpl.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {tpl.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {tpl.numPages && (
                    <span>
                      {tpl.numPages} page{tpl.numPages !== 1 ? "s" : ""}
                    </span>
                  )}
                  {fieldCount > 0 && (
                    <span>
                      {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {recipientCount > 0 && (
                    <span>
                      {recipientCount} recipient
                      {recipientCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="font-mono tabular-nums">
                    Used {tpl.usageCount}×
                  </span>
                </div>
              </div>

              {/* Use + Menu */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/admin/signsuite/send?templateId=${tpl.id}`)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Use
                </Button>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() =>
                      setOpenMenuId(openMenuId === tpl.id ? null : tpl.id)
                    }
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {openMenuId === tpl.id && (
                    <div className="absolute right-0 top-8 z-20 w-40 rounded-md border border-border bg-background shadow-lg py-1">
                      <button
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted"
                        onClick={() => {
                          router.push(`/admin/signsuite/send?templateId=${tpl.id}`);
                          setOpenMenuId(null);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted"
                        disabled={duplicating === tpl.id || atLimit}
                        onClick={() => {
                          handleDuplicate(tpl.id);
                          setOpenMenuId(null);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {duplicating === tpl.id ? "Duplicating..." : "Duplicate"}
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted text-red-600"
                        onClick={() => {
                          handleDelete(tpl.id);
                          setOpenMenuId(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
