// @deprecated — Use components/esign/signsuite-sections.tsx for new imports.
// This file is the canonical implementation; the SignSuite alias re-exports from here.
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
import {
  CheckCircle2,
  PenIcon,
  Loader2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  AlertCircleIcon,
  UploadIcon,
  TypeIcon,
  PenTool,
  Maximize2,
  XIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ESIGN_CONSENT_TEXT } from "@/lib/signature/checksum";

import type {
  SignatureCaptureProps,
  CompletionScreenProps,
  DocumentQueueProps,
  PdfViewerPanelProps,
  SignaturePanelProps,
  SignatureCaptureModalProps,
  ConfirmationModalProps,
  FullscreenPdfModalProps,
} from "./fundroom-sign-types";

// ----- Signature Capture Component (Draw / Type / Upload) -----

export function SignatureCapture({
  onCapture,
  initialName = "",
  isInitials = false,
  className,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"draw" | "type" | "upload">("draw");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [typedText, setTypedText] = useState(initialName);
  const [selectedFont, setSelectedFont] = useState("'Dancing Script', cursive");
  const strokesRef = useRef<Array<{ x: number; y: number }[]>>([]);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  const canvasWidth = isInitials ? 200 : 400;
  const canvasHeight = isInitials ? 100 : 200;

  const fonts = [
    { id: "dancing", font: "'Dancing Script', cursive", label: "Script" },
    { id: "caveat", font: "'Caveat', cursive", label: "Casual" },
    { id: "homemade", font: "'Homemade Apple', cursive", label: "Natural" },
  ];

  useEffect(() => {
    redrawCanvas();
  }, []);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Signature line
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(16, canvas.height - 16);
    ctx.lineTo(canvas.width - 16, canvas.height - 16);
    ctx.stroke();
    ctx.setLineDash([]);
    // Redraw strokes
    strokesRef.current.forEach((stroke) => {
      if (stroke.length < 2) return;
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    });
  };

  const getCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    currentStrokeRef.current = [{ x, y }];
  };

  const continueDraw = (e: React.PointerEvent) => {
    if (!isDrawing || mode !== "draw") return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    currentStrokeRef.current.push({ x, y });
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const pts = currentStrokeRef.current;
    if (pts.length >= 2) {
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    setHasContent(true);
  };

  const endDraw = (e?: React.PointerEvent) => {
    if (e) {
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch (error) {}
    }
    if (isDrawing && currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current]);
      currentStrokeRef.current = [];
      emitSignature();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setHasContent(false);
    setTypedText("");
    redrawCanvas();
  };

  const emitSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onCapture(canvas.toDataURL("image/png"));
    }
  };

  const updateTypedSignature = (text: string, font: string) => {
    setTypedText(text);
    setSelectedFont(font);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Signature line
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(16, canvas.height - 16);
    ctx.lineTo(canvas.width - 16, canvas.height - 16);
    ctx.stroke();
    ctx.setLineDash([]);
    if (text.trim()) {
      const fontSize = isInitials ? 28 : 36;
      ctx.font = `${fontSize}px ${font}`;
      ctx.fillStyle = "#1a1a2e";
      ctx.textBaseline = "middle";
      const textWidth = ctx.measureText(text).width;
      ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height / 2);
      setHasContent(true);
      onCapture(canvas.toDataURL("image/png"));
    } else {
      setHasContent(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a PNG or JPG image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Fit image maintaining aspect ratio
        const scale = Math.min(
          (canvas.width - 32) / img.width,
          (canvas.height - 32) / img.height,
        );
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        setHasContent(true);
        onCapture(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Tabs
        value={mode}
        onValueChange={(v) => {
          setMode(v as "draw" | "type" | "upload");
          clearCanvas();
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="draw" className="min-h-[44px]">
            <PenTool className="h-4 w-4 mr-1.5" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="min-h-[44px]">
            <TypeIcon className="h-4 w-4 mr-1.5" />
            Type
          </TabsTrigger>
          <TabsTrigger value="upload" className="min-h-[44px]">
            <UploadIcon className="h-4 w-4 mr-1.5" />
            Upload
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "type" && (
        <div className="space-y-2">
          <Input
            value={typedText}
            onChange={(e) => updateTypedSignature(e.target.value, selectedFont)}
            placeholder={isInitials ? "Your initials (e.g. JS)" : "Type your full legal name..."}
            className="text-base"
            autoComplete="name"
          />
          <div className="flex gap-2 flex-wrap">
            {fonts.map((f) => (
              <button
                key={f.id}
                onClick={() => updateTypedSignature(typedText, f.font)}
                className={cn(
                  "px-3 py-1.5 min-h-[44px] rounded text-sm transition-colors",
                  selectedFont === f.font
                    ? "bg-[#0066FF] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                )}
                style={{ fontFamily: f.font }}
                aria-current={selectedFont === f.font ? "true" : undefined}
                aria-label={`${f.label} font style`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "upload" && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <UploadIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            Upload a signature image (PNG or JPG)
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleUpload}
            className="text-sm w-full"
          />
        </div>
      )}

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="w-full rounded-lg border border-gray-200 cursor-crosshair touch-none select-none bg-white"
          role="img"
          aria-label={isInitials ? "Initials drawing area. Use pointer or touch to draw your initials." : "Signature drawing area. Use pointer or touch to draw your signature."}
          style={{
            touchAction: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            msTouchAction: "none",
            minHeight: isInitials ? 80 : 120,
          }}
          onPointerDown={startDraw}
          onPointerMove={continueDraw}
          onPointerUp={endDraw}
          onPointerLeave={() => endDraw()}
          onPointerCancel={() => endDraw()}
        />
        {!hasContent && mode === "draw" && (
          <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
            {isInitials ? "Draw initials here" : "Draw signature here"}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={clearCanvas} className="min-h-[44px]">
          Clear
        </Button>
        {hasContent && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Captured
          </span>
        )}
      </div>
    </div>
  );
}

// ----- Completion Screen -----

export function CompletionScreen({ totalCount, onComplete }: CompletionScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <CheckCircle2 className="h-20 w-20 text-emerald-500 mb-6" />
      <h2 className="text-2xl font-bold text-gray-900 mb-3">All Documents Signed</h2>
      <p className="text-gray-500 text-center max-w-md mb-2">
        You have signed {totalCount} document{totalCount !== 1 ? "s" : ""}.
        Copies have been sent to your email.
      </p>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <ShieldCheckIcon className="h-4 w-4" />
        Securely signed and recorded via SignSuite
      </div>
      <Button onClick={onComplete} className="min-h-[44px] bg-[#0066FF] hover:bg-[#0052cc]">
        Continue
        <ArrowRightIcon className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

// ----- Document Queue (no active doc) -----

export function DocumentQueue({
  queue,
  signedCount,
  totalCount,
  onOpenDocument,
}: DocumentQueueProps) {
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Documents to Sign</h2>
          <p className="text-sm text-gray-500 mt-1">
            Review and sign each document in order.
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-emerald-600">{signedCount}</span>
          <span className="text-gray-400 text-xl">/{totalCount}</span>
          <p className="text-xs text-gray-500">signed</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-emerald-500 h-2.5 rounded-full transition-all duration-700"
          style={{
            width: `${totalCount > 0 ? (signedCount / totalCount) * 100 : 0}%`,
          }}
        />
      </div>

      {/* Document cards */}
      <div className="space-y-3">
        {queue.map((item, index) => {
          const isSigned = item.status === "signed";
          const isAvailable =
            !isSigned &&
            (index === 0 || queue[index - 1]?.status === "signed");
          const isLocked = !isSigned && !isAvailable;

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border p-4 min-h-[64px] transition-all",
                isSigned
                  ? "border-green-200 bg-green-50"
                  : isAvailable
                    ? "border-[#0066FF]/30 bg-blue-50 cursor-pointer hover:border-[#0066FF] hover:shadow-md"
                    : "border-gray-200 bg-gray-50 opacity-50",
              )}
              onClick={() => isAvailable && onOpenDocument(index)}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">
                  {isSigned ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : isAvailable ? (
                    <div className="w-8 h-8 rounded-full bg-[#0066FF] text-white flex items-center justify-center">
                      {index + 1}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-500 flex items-center justify-center">
                      {index + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={cn(
                      "font-semibold text-sm",
                      isSigned
                        ? "text-green-800"
                        : isAvailable
                          ? "text-gray-900"
                          : "text-gray-500",
                    )}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isSigned
                      ? "Signed"
                      : isAvailable
                        ? "Ready to sign"
                        : "Sign previous document first"}
                  </p>
                </div>
                {isAvailable && (
                  <Button
                    size="sm"
                    className="min-h-[44px] bg-[#0066FF] hover:bg-[#0052cc]"
                  >
                    Sign
                    <ArrowRightIcon className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {isSigned && (
                  <span className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                    Signed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- PDF Viewer Panel (Left side of split screen) -----

export function PdfViewerPanel({
  activeDoc,
  currentPage,
  numPages,
  scale,
  pdfLoading,
  pageSize,
  currentPageFields,
  totalRequired,
  completedRequired,
  onBack,
  onPageChange,
  onScaleChange,
  onPdfLoadSuccess,
  onPageSizeChange,
  onFieldClick,
  getFieldStyle,
  getFieldContent,
  onShowFullscreen,
}: PdfViewerPanelProps) {
  return (
    <div className="flex-1 lg:w-[60%] flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-[#0A1628] px-3 py-2 gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-300 hover:text-white min-h-[44px]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Back</span>
          </Button>
          <span className="text-sm text-gray-400">
            {currentPage}/{numPages}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onScaleChange(Math.max(0.5, scale - 0.15))}
            className="rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:bg-gray-700"
          >
            <ZoomOutIcon className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-400 w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => onScaleChange(Math.min(2.5, scale + 0.15))}
            className="rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:bg-gray-700"
          >
            <ZoomInIcon className="h-4 w-4" />
          </button>
          <button
            onClick={onShowFullscreen}
            className="rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:bg-gray-700"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {totalRequired > 0 && (
            <span className="text-xs text-gray-400">
              {completedRequired}/{totalRequired}
            </span>
          )}
          {completedRequired === totalRequired && totalRequired > 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : totalRequired > 0 ? (
            <AlertCircleIcon className="h-4 w-4 text-amber-500" />
          ) : null}
        </div>
      </div>

      {/* PDF viewer */}
      <div
        className="flex-1 bg-gray-200 overflow-auto"
        style={{ minHeight: 300, WebkitOverflowScrolling: "touch" }}
      >
        {pdfLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2Icon className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}
        <div className="flex flex-col items-center p-4">
          <Document
            file={activeDoc.fileUrl}
            onLoadSuccess={({ numPages: n }) => {
              onPdfLoadSuccess(n);
            }}
            loading={null}
            className="flex flex-col items-center"
          >
            <div className="relative inline-block shadow-lg">
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onRenderSuccess={(page: { width: number; height: number }) =>
                  onPageSizeChange({ width: page.width, height: page.height })
                }
              />
              {pageSize &&
                currentPageFields.map((field) => (
                  <div
                    key={field.id}
                    style={getFieldStyle(field)}
                    onClick={() => onFieldClick(field)}
                  >
                    {getFieldContent(field)}
                  </div>
                ))}
            </div>
          </Document>
        </div>
      </div>

      {/* Page nav */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 bg-gray-100 border-t py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="min-h-[44px]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Prev</span>
          </Button>
          <span className="text-sm text-gray-600">
            {currentPage} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="min-h-[44px]"
          >
            <span className="hidden sm:inline mr-1">Next</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ----- Signature Panel (Right side of split screen) -----

export function SignaturePanel({
  activeDoc,
  investorData,
  signatureData,
  initialsData,
  consentConfirmed,
  isSubmitting,
  allRequiredComplete,
  onSignatureCapture,
  onInitialsCapture,
  onConsentChange,
  onSignDocument,
}: SignaturePanelProps) {
  return (
    <div className="lg:w-[40%] flex flex-col bg-white overflow-y-auto sticky bottom-0 lg:sticky lg:top-0">
      <div className="p-4 space-y-5 flex-1">
        {/* Auto-filled fields */}
        {investorData && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Investor Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Name</span>
                <span className="font-medium">{investorData.investorName}</span>
              </div>
              {investorData.entityName && (
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Entity</span>
                  <span className="font-medium">{investorData.entityName}</span>
                </div>
              )}
              {investorData.investmentAmount && (
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium">
                    ${investorData.investmentAmount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{new Date().toLocaleDateString()}</span>
              </div>
              {investorData.address && (
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Address</span>
                  <span className="font-medium text-right max-w-[180px] truncate">
                    {investorData.address}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signature capture */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Your Signature
          </h3>
          <SignatureCapture
            onCapture={onSignatureCapture}
            initialName={investorData?.investorName}
          />
        </div>

        {/* Initials capture (if doc has initials fields) */}
        {activeDoc.fields.some((f) => f.type === "INITIALS") && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Your Initials
            </h3>
            <SignatureCapture
              onCapture={onInitialsCapture}
              initialName={
                investorData?.investorName
                  ? investorData.investorName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                  : ""
              }
              isInitials
            />
          </div>
        )}

        {/* Consent */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-start gap-3 min-h-[44px]">
            <Checkbox
              id="fundroom-sign-consent"
              checked={consentConfirmed}
              onCheckedChange={(checked) =>
                onConsentChange(checked === true)
              }
              className="mt-0.5 h-5 w-5"
            />
            <Label
              htmlFor="fundroom-sign-consent"
              className="text-xs text-gray-600 leading-relaxed cursor-pointer"
            >
              I have read and agree to the terms of this {activeDoc.title}.{" "}
              {ESIGN_CONSENT_TEXT}
            </Label>
          </div>
        </div>
      </div>

      {/* Sign button (sticky bottom) */}
      <div className="border-t bg-white p-4 sticky bottom-0">
        <Button
          onClick={onSignDocument}
          disabled={isSubmitting || !consentConfirmed || !allRequiredComplete}
          className="w-full min-h-[52px] text-base bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2Icon className="h-5 w-5 animate-spin mr-2" />
              Signing...
            </>
          ) : (
            <>
              <PenIcon className="h-5 w-5 mr-2" />
              Sign Document
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ----- Signature Capture Modal (for clicking fields on PDF) -----

export function SignatureCaptureModal({
  open,
  onOpenChange,
  activeFieldId,
  activeDoc,
  investorData,
  onCapture,
  onCancel,
}: SignatureCaptureModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>
            {activeFieldId &&
            activeDoc?.fields.find((f) => f.id === activeFieldId)?.type ===
              "INITIALS"
              ? "Add Your Initials"
              : "Add Your Signature"}
          </DialogTitle>
        </DialogHeader>
        <SignatureCapture
          onCapture={onCapture}
          initialName={investorData?.investorName}
          isInitials={
            activeFieldId
              ? activeDoc?.fields.find((f) => f.id === activeFieldId)?.type ===
                "INITIALS"
              : false
          }
        />
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Confirmation Modal -----

export function ConfirmationModal({
  open,
  onOpenChange,
  activeDocTitle,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Signature</DialogTitle>
          <DialogDescription>
            You are about to sign <strong>{activeDocTitle}</strong>. This is a
            legally binding electronic signature under ESIGN/UETA.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <ShieldCheckIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-amber-800">
            By confirming, you agree this signature carries the same legal effect
            as a handwritten signature.
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="min-h-[44px] bg-[#0066FF] hover:bg-[#0052cc]"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirm & Sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Fullscreen PDF Modal -----

export function FullscreenPdfModal({
  open,
  onOpenChange,
  activeDoc,
  numPages,
}: FullscreenPdfModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100dvh] w-full h-full p-0 rounded-none sm:rounded-lg sm:max-w-[95vw] sm:max-h-[95vh]">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between bg-gray-900 px-4 py-2">
            <span className="text-sm text-gray-300 truncate mr-2">{activeDoc.title}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-300 hover:text-white min-h-[44px] min-w-[44px]"
            >
              <XIcon className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto bg-gray-200 p-2 sm:p-4" style={{ WebkitOverflowScrolling: "touch" }}>
            <Document
              file={activeDoc.fileUrl}
              loading={null}
              className="flex flex-col items-center gap-4"
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page key={i + 1} pageNumber={i + 1} width={typeof window !== "undefined" ? Math.min(window.innerWidth - 32, 800) : 600} />
              ))}
            </Document>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
