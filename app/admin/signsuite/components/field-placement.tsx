"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Save,
  Trash2,
  GripVertical,
  Pen,
  Type,
  Calendar,
  AlignLeft,
  CheckSquare,
  User,
  Mail,
  Building2,
  Briefcase,
  MapPin,
  ChevronDown,
  Circle,
  Hash,
  DollarSign,
  Paperclip,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FieldPlacement as FieldPlacementType } from "./signsuite-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FieldPlacementProps {
  envelopeId: string;
  onBack: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Field type icon mapping
// ---------------------------------------------------------------------------

const FIELD_ICONS: Record<string, LucideIcon> = {
  SIGNATURE: Pen,
  INITIALS: Type,
  DATE_SIGNED: Calendar,
  TEXT: AlignLeft,
  CHECKBOX: CheckSquare,
  NAME: User,
  EMAIL: Mail,
  COMPANY: Building2,
  TITLE: Briefcase,
  ADDRESS: MapPin,
  DROPDOWN: ChevronDown,
  RADIO: Circle,
  NUMERIC: Hash,
  CURRENCY: DollarSign,
  ATTACHMENT: Paperclip,
  FORMULA: Calculator,
};

// ---------------------------------------------------------------------------
// Field palette categories
// ---------------------------------------------------------------------------

const FIELD_PALETTE = [
  {
    category: "Signature",
    fields: [
      { type: "SIGNATURE", label: "Signature", w: 20, h: 5 },
      { type: "INITIALS", label: "Initials", w: 8, h: 4 },
    ],
  },
  {
    category: "Auto-Fill",
    fields: [
      { type: "DATE_SIGNED", label: "Date Signed", w: 15, h: 3 },
      { type: "NAME", label: "Full Name", w: 20, h: 3 },
      { type: "EMAIL", label: "Email", w: 20, h: 3 },
      { type: "COMPANY", label: "Company", w: 20, h: 3 },
      { type: "TITLE", label: "Title", w: 15, h: 3 },
      { type: "ADDRESS", label: "Address", w: 25, h: 5 },
    ],
  },
  {
    category: "Input",
    fields: [
      { type: "TEXT", label: "Text", w: 20, h: 3 },
      { type: "CHECKBOX", label: "Checkbox", w: 3, h: 3 },
      { type: "DROPDOWN", label: "Dropdown", w: 20, h: 3 },
      { type: "RADIO", label: "Radio", w: 3, h: 3 },
      { type: "NUMERIC", label: "Number", w: 15, h: 3 },
      { type: "CURRENCY", label: "Currency", w: 15, h: 3 },
    ],
  },
  {
    category: "Advanced",
    fields: [
      { type: "ATTACHMENT", label: "Attachment", w: 20, h: 5 },
      { type: "FORMULA", label: "Formula", w: 15, h: 3 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Placed field type
// ---------------------------------------------------------------------------

interface PlacedField {
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
  fieldFormat?: string;
  groupId?: string;
  minValue?: number;
  maxValue?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FieldPlacement({
  envelopeId,
  onBack,
  onSaved,
}: FieldPlacementProps) {
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [saving, setSaving] = useState(false);
  const [recipientCount, setRecipientCount] = useState(1);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    fieldId: string;
    startX: number;
    startY: number;
    fieldStartX: number;
    fieldStartY: number;
  } | null>(null);

  // -------------------------------------------------------------------------
  // Load envelope data
  // -------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/esign/envelopes/${envelopeId}`);
        if (res.ok) {
          const data = await res.json();
          setRecipientCount(
            data.recipients?.filter(
              (r: { role: string }) => r.role === "SIGNER",
            ).length || 1,
          );
          setDocumentUrl(data.sourceFile || data.sourceFileName || null);
          setTotalPages(data.numPages || 1);

          // Load existing fields from template if any
          if (data.fields && Array.isArray(data.fields)) {
            setFields(
              data.fields.map((f: FieldPlacementType, i: number) => ({
                ...f,
                id: f.id || `field-${i}`,
              })),
            );
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [envelopeId]);

  // -------------------------------------------------------------------------
  // Add field from palette
  // -------------------------------------------------------------------------

  const addField = (
    type: string,
    label: string,
    defaultW: number,
    defaultH: number,
  ) => {
    const id = `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newField: PlacedField = {
      id,
      type,
      label,
      page: currentPage,
      x: 10,
      y: 10,
      width: defaultW,
      height: defaultH,
      required: true,
      recipientIndex: 0,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(id);
  };

  // -------------------------------------------------------------------------
  // Delete field
  // -------------------------------------------------------------------------

  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  // -------------------------------------------------------------------------
  // Update field property
  // -------------------------------------------------------------------------

  const updateField = (id: string, patch: Partial<PlacedField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  };

  // -------------------------------------------------------------------------
  // Drag to reposition
  // -------------------------------------------------------------------------

  const handlePointerDown = (e: React.PointerEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    dragRef.current = {
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      fieldStartX: field.x,
      fieldStartY: field.y,
    };
    setSelectedFieldId(fieldId);

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;

      updateField(dragRef.current.fieldId, {
        x: Math.max(0, Math.min(100 - field.width, dragRef.current.fieldStartX + dx)),
        y: Math.max(0, Math.min(100 - field.height, dragRef.current.fieldStartY + dy)),
      });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // -------------------------------------------------------------------------
  // Save fields
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/esign/envelopes/${envelopeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fields.map(({ id, ...rest }) => rest),
        }),
      });
      if (res.ok) onSaved();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const selectedField = fields.find((f) => f.id === selectedFieldId);
  const pageFields = fields.filter((f) => f.page === currentPage);

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-[600px] bg-muted rounded-lg" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h2 className="text-lg font-semibold text-foreground">
            Place Signature Fields
          </h2>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save Fields"}
        </Button>
      </div>

      <div className="flex gap-4">
        {/* ── Left: Field Palette ── */}
        <div className="w-56 flex-shrink-0 space-y-4">
          {FIELD_PALETTE.map((cat) => (
            <div key={cat.category}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {cat.category}
              </p>
              <div className="space-y-1">
                {cat.fields.map((f) => {
                  const Icon = FIELD_ICONS[f.type] || AlignLeft;
                  return (
                    <button
                      key={f.type}
                      onClick={() => addField(f.type, f.label, f.w, f.h)}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors text-left"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Center: PDF Canvas ── */}
        <div className="flex-1 min-w-0">
          {/* Page nav + zoom */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono text-muted-foreground">
                Page {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono text-muted-foreground w-10 text-center">
                {zoom}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Canvas area */}
          <div
            ref={canvasRef}
            className="relative bg-white dark:bg-gray-100 border border-border rounded-lg overflow-hidden"
            style={{
              width: `${(612 * zoom) / 100}px`,
              height: `${(792 * zoom) / 100}px`,
            }}
            onClick={() => setSelectedFieldId(null)}
          >
            {/* Document placeholder lines */}
            <div className="absolute inset-0 p-8 opacity-10">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 bg-gray-400 rounded mb-2"
                  style={{ width: `${60 + Math.random() * 35}%` }}
                />
              ))}
            </div>

            {/* Placed fields */}
            {pageFields.map((field) => {
              const Icon = FIELD_ICONS[field.type] || AlignLeft;
              const isSelected = field.id === selectedFieldId;

              return (
                <div
                  key={field.id}
                  onPointerDown={(e) => handlePointerDown(e, field.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFieldId(field.id);
                  }}
                  className={`absolute flex items-center gap-1 px-1 cursor-move select-none rounded border text-xs transition-shadow ${
                    isSelected
                      ? "border-blue-600 bg-blue-100/80 dark:bg-blue-200/80 shadow-md ring-2 ring-blue-400/50"
                      : "border-amber-500 bg-amber-100/70 dark:bg-amber-200/70 hover:shadow-sm"
                  }`}
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                    touchAction: "none",
                  }}
                >
                  <GripVertical className="h-3 w-3 text-gray-500 flex-shrink-0 opacity-60" />
                  <Icon className="h-3 w-3 text-gray-600 flex-shrink-0" />
                  <span className="truncate text-gray-700 font-medium">
                    {field.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Properties Panel ── */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {selectedField ? (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {selectedField.label}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500"
                  onClick={() => deleteField(selectedField.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Badge variant="secondary" className="text-xs">
                {selectedField.type}
              </Badge>

              {/* Label */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={selectedField.label}
                  onChange={(e) =>
                    updateField(selectedField.id, { label: e.target.value })
                  }
                  className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background"
                />
              </div>

              {/* Recipient */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Assigned to
                </label>
                <select
                  value={selectedField.recipientIndex}
                  onChange={(e) =>
                    updateField(selectedField.id, {
                      recipientIndex: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background"
                >
                  {Array.from({ length: recipientCount }).map((_, i) => (
                    <option key={i} value={i}>
                      Signer {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Required */}
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  onChange={(e) =>
                    updateField(selectedField.id, {
                      required: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                Required field
              </label>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">
                    X %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(selectedField.x)}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        x: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">
                    Y %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(selectedField.y)}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        y: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">
                    W %
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={Math.round(selectedField.width)}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        width: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-0.5">
                    H %
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={Math.round(selectedField.height)}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        height: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                  />
                </div>
              </div>

              {/* Options (for dropdown/radio) */}
              {(selectedField.type === "DROPDOWN" ||
                selectedField.type === "RADIO") && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Options (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={(selectedField.options || []).join("\n")}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        options: e.target.value
                          .split("\n")
                          .filter((s) => s.trim()),
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background resize-none"
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
              )}

              {/* Format (for numeric/currency) */}
              {(selectedField.type === "NUMERIC" ||
                selectedField.type === "CURRENCY") && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Format
                    </label>
                    <select
                      value={selectedField.fieldFormat || ""}
                      onChange={(e) =>
                        updateField(selectedField.id, {
                          fieldFormat: e.target.value || undefined,
                        })
                      }
                      className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background"
                    >
                      {selectedField.type === "NUMERIC" ? (
                        <>
                          <option value="">Default</option>
                          <option value="integer">Integer</option>
                          <option value="percentage">Percentage</option>
                        </>
                      ) : (
                        <>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-0.5">
                        Min
                      </label>
                      <input
                        type="number"
                        value={selectedField.minValue ?? ""}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            minValue: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                        placeholder="No min"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-0.5">
                        Max
                      </label>
                      <input
                        type="number"
                        value={selectedField.maxValue ?? ""}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            maxValue: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                        placeholder="No max"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Group ID (for radio groups) */}
              {selectedField.type === "RADIO" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Radio Group ID
                  </label>
                  <input
                    type="text"
                    value={selectedField.groupId || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        groupId: e.target.value || undefined,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background"
                    placeholder="e.g. question-1"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Radio buttons with the same Group ID are mutually exclusive.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">
                Click a field on the document to edit its properties, or drag a
                field from the palette on the left.
              </p>
            </div>
          )}

          {/* Field summary */}
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Fields ({fields.length})
            </p>
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields placed yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {fields.map((f) => {
                  const Icon = FIELD_ICONS[f.type] || AlignLeft;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setCurrentPage(f.page);
                        setSelectedFieldId(f.id);
                      }}
                      className={`flex items-center gap-2 w-full px-2 py-1 text-xs rounded transition-colors text-left ${
                        f.id === selectedFieldId
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{f.label}</span>
                      <span className="ml-auto text-xs font-mono">
                        p{f.page}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
