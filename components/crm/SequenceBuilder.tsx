"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmailTemplate } from "@/app/admin/outreach/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepData {
  id: string;
  stepOrder: number;
  delayDays: number;
  templateId: string | null;
  aiPrompt: string | null;
  condition: string;
}

interface SequenceBuilderProps {
  steps: StepData[];
  templates: EmailTemplate[];
  onSave: (steps: StepData[]) => void;
  onCancel: () => void;
  saving?: boolean;
}

const CONDITION_OPTIONS = [
  { value: "ALWAYS", label: "Always send" },
  { value: "IF_NO_REPLY", label: "If no reply" },
  { value: "IF_NOT_OPENED", label: "If not opened" },
  { value: "IF_NOT_CLICKED", label: "If not clicked" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createBlankStep(order: number): StepData {
  return {
    id: generateId(),
    stepOrder: order,
    delayDays: order === 1 ? 0 : 3,
    templateId: null,
    aiPrompt: null,
    condition: order === 1 ? "ALWAYS" : "IF_NO_REPLY",
  };
}

// ---------------------------------------------------------------------------
// Step Card
// ---------------------------------------------------------------------------

function StepCard({
  step,
  index,
  total,
  templates,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: StepData;
  index: number;
  total: number;
  templates: EmailTemplate[];
  onUpdate: (id: string, updates: Partial<StepData>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isAiMode = step.templateId === null && step.aiPrompt !== null;
  const [useAi, setUseAi] = useState(isAiMode);

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* Step Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-t-lg">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab" aria-hidden="true" />

        <span className="text-xs font-semibold text-muted-foreground">
          Step {index + 1}
        </span>

        {index > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span className="font-mono tabular-nums">
              {step.delayDays === 0 ? "Immediately" : `${step.delayDays}d delay`}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Reorder */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onMoveUp(step.id)}
            disabled={index === 0}
            className="p-1 rounded hover:bg-muted disabled:opacity-30"
            aria-label="Move step up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMoveDown(step.id)}
            disabled={index === total - 1}
            className="p-1 rounded hover:bg-muted disabled:opacity-30"
            aria-label="Move step down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          aria-label={expanded ? "Collapse step" : "Expand step"}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {total > 1 && (
          <button
            onClick={() => onRemove(step.id)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500"
            aria-label="Remove step"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Step Body */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Delay */}
          {index > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Delay (days after previous step)
              </label>
              <Input
                type="number"
                min={0}
                max={90}
                value={step.delayDays}
                onChange={(e) =>
                  onUpdate(step.id, { delayDays: Math.max(0, Math.min(90, parseInt(e.target.value) || 0)) })
                }
                className="mt-0.5 w-24 text-sm font-mono"
              />
            </div>
          )}

          {/* Condition */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Send Condition
            </label>
            <Select
              value={step.condition}
              onValueChange={(v) => onUpdate(step.id, { condition: v })}
            >
              <SelectTrigger className="mt-0.5 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template vs AI Toggle */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Email Content
            </label>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => {
                  setUseAi(false);
                  onUpdate(step.id, { aiPrompt: null });
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  !useAi
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                Template
              </button>
              <button
                onClick={() => {
                  setUseAi(true);
                  onUpdate(step.id, { templateId: null });
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  useAi
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                AI Prompt
              </button>
            </div>

            {useAi ? (
              <Textarea
                value={step.aiPrompt || ""}
                onChange={(e) => onUpdate(step.id, { aiPrompt: e.target.value })}
                placeholder="Describe what the AI should write, e.g. 'Send a friendly check-in asking about their review of the PPM...'"
                rows={3}
                maxLength={500}
                className="text-sm"
              />
            ) : (
              <Select
                value={step.templateId || ""}
                onValueChange={(v) => onUpdate(step.id, { templateId: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  {templates.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No templates available. Create one in the Templates tab.
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sequence Builder
// ---------------------------------------------------------------------------

export function SequenceBuilder({
  steps: initialSteps,
  templates,
  onSave,
  onCancel,
  saving = false,
}: SequenceBuilderProps) {
  const [steps, setSteps] = useState<StepData[]>(
    initialSteps.length > 0
      ? initialSteps
      : [createBlankStep(1)],
  );

  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, createBlankStep(prev.length + 1)]);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      return filtered.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    });
  }, []);

  const updateStep = useCallback((id: string, updates: Partial<StepData>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
  }, []);

  const moveUp = useCallback((id: string) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    });
  }, []);

  const hasContent = steps.every(
    (s) => s.templateId !== null || (s.aiPrompt !== null && s.aiPrompt.trim().length > 0),
  );

  return (
    <div className="space-y-3">
      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            total={steps.length}
            templates={templates}
            onUpdate={updateStep}
            onRemove={removeStep}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        ))}
      </div>

      {/* Add Step */}
      {steps.length < 10 && (
        <Button variant="outline" size="sm" onClick={addStep} className="w-full text-xs">
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Add Step ({steps.length}/10)
        </Button>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs">
          <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(steps)}
          disabled={saving || !hasContent}
          className="h-8 text-xs ml-auto"
        >
          <Save className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {saving ? "Saving..." : "Save Sequence"}
        </Button>
      </div>
    </div>
  );
}
