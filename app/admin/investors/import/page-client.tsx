"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Users,
  AlertCircle,
} from "lucide-react";

/**
 * Bulk Investor Import Page
 *
 * 1. Download CSV template
 * 2. Fill out template with investor data
 * 3. Upload filled template (drag-drop or file picker)
 * 4. Auto-column mapping & validation with duplicate detection
 * 5. Confirm & import
 */

interface ParsedRow {
  name: string;
  email: string;
  phone?: string;
  entityType: string;
  entityName?: string;
  commitmentAmount: number;
  commitmentDate?: string;
  fundingStatus: string;
  accreditationStatus: string;
  address?: string;
  notes?: string;
  valid: boolean;
  errors: string[];
}

interface ImportResult {
  email: string;
  name: string;
  success: boolean;
  error?: string;
}

/**
 * RFC 4180-compliant CSV line parser.
 * Handles quoted fields with embedded commas and escaped quotes ("").
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") or end of quoted field
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

const VALID_ENTITY_TYPES = [
  "INDIVIDUAL",
  "LLC",
  "TRUST",
  "RETIREMENT",
  "JOINT",
  "PARTNERSHIP",
  "CHARITY",
  "OTHER",
];

export default function BulkImportClient() {
  const [step, setStep] = useState<
    "upload" | "review" | "importing" | "results"
  >("upload");
  const [fundId, setFundId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [funds, setFunds] = useState<
    Array<{ id: string; name: string; teamId: string }>
  >([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/fund/list")
      .then((res) => res.json())
      .then((data) => {
        const fundsList = data.funds || [];
        setFunds(fundsList);
        if (fundsList.length > 0) {
          setFundId(fundsList[0].id);
          setTeamId(fundsList[0].teamId);
        }
      })
      .catch((e) => console.error("Failed to load funds:", e));
  }, []);

  const parseFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Only .csv files are supported");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());

      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one data row");
        return;
      }

      if (lines.length > 501) {
        toast.error("CSV exceeds the 500-row limit");
        return;
      }

      const headers = parseCSVLine(lines[0]).map((h) =>
        h.toLowerCase().replace(/[^a-z]/g, ""),
      );
      const rows: ParsedRow[] = [];
      const seenEmails = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const errors: string[] = [];

        const name = values[headers.indexOf("name")] || "";
        const rawEmail = values[headers.indexOf("email")] || "";
        const email = rawEmail.toLowerCase().trim();
        const commitmentStr =
          values[headers.indexOf("commitmentamount")] ||
          values[headers.indexOf("commitment")] ||
          "0";
        // Strip currency symbols and commas for parsing
        const commitmentAmount = Number(
          commitmentStr.replace(/[$,]/g, ""),
        );

        if (!name) errors.push("Name is required");
        if (!email || !email.includes("@"))
          errors.push("Valid email required");
        if (isNaN(commitmentAmount) || commitmentAmount <= 0)
          errors.push("Commitment must be a positive number");

        // Duplicate email check within the CSV
        if (email && seenEmails.has(email)) {
          errors.push("Duplicate email in CSV");
        }
        if (email) seenEmails.add(email);

        const entityType = (
          values[headers.indexOf("entitytype")] || "INDIVIDUAL"
        ).toUpperCase();
        if (!VALID_ENTITY_TYPES.includes(entityType)) {
          errors.push(
            `Invalid entity type: ${entityType}`,
          );
        }

        rows.push({
          name,
          email,
          phone: values[headers.indexOf("phone")] || undefined,
          entityType,
          entityName: values[headers.indexOf("entityname")] || undefined,
          commitmentAmount: isNaN(commitmentAmount) ? 0 : commitmentAmount,
          commitmentDate:
            values[headers.indexOf("commitmentdate")] || undefined,
          fundingStatus:
            values[headers.indexOf("fundingstatus")] || "COMMITTED",
          accreditationStatus:
            values[headers.indexOf("accreditationstatus")] ||
            "SELF_CERTIFIED",
          address: values[headers.indexOf("address")] || undefined,
          notes: values[headers.indexOf("notes")] || undefined,
          valid: errors.length === 0,
          errors,
        });
      }

      setParsedRows(rows);
      setStep("review");
      toast.success(`Parsed ${rows.length} rows from CSV`);
    };
    reader.readAsText(file);
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const handleImport = async () => {
    setShowConfirm(false);
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    setStep("importing");

    try {
      const res = await fetch("/api/admin/investors/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundId,
          teamId,
          investors: validRows.map(({ valid, errors, ...row }) => row),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportResults(data.results);
        setStep("results");
        toast.success(data.message);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Import failed");
        setStep("review");
      }
    } catch (error) {
      toast.error("An error occurred during import");
      setStep("review");
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;
  const duplicateCount = parsedRows.filter((r) =>
    r.errors.some((e) => e.includes("Duplicate")),
  ).length;
  const totalCommitment = parsedRows
    .filter((r) => r.valid)
    .reduce((sum, r) => sum + r.commitmentAmount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/investors">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Bulk Import Investors</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV to import multiple investors at once
          </p>
        </div>
      </div>

      {/* Fund Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Select Fund for Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={fundId}
            onValueChange={(v) => {
              setFundId(v);
              const fund = funds.find((f) => f.id === v);
              if (fund) setTeamId(fund.teamId);
            }}
          >
            <SelectTrigger className="w-[300px]" aria-label="Select fund">
              <SelectValue placeholder="Select a fund" />
            </SelectTrigger>
            <SelectContent>
              {funds.map((fund) => (
                <SelectItem key={fund.id} value={fund.id}>
                  {fund.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {step === "upload" && (
        <>
          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Download className="h-4 w-4" aria-hidden="true" />
                Step 1: Download Template
              </CardTitle>
              <CardDescription>
                Use our CSV template to ensure proper formatting. Supported
                entity types: Individual, LLC, Trust, Retirement, Joint,
                Partnership, Charity, Other.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => {
                  window.open(
                    "/api/admin/investors/bulk-import",
                    "_blank",
                  );
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />
                Download CSV Template
              </Button>
            </CardContent>
          </Card>

          {/* File Upload with Drag & Drop */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Step 2: Upload Filled Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-border hover:border-blue-400 hover:bg-muted/30"
                }`}
              >
                <div className="text-center">
                  <FileSpreadsheet
                    className={`mx-auto mb-3 h-10 w-10 ${
                      isDragOver ? "text-blue-500" : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                  <p className="mb-2 text-sm font-medium">
                    {isDragOver
                      ? "Drop your CSV file here"
                      : "Drag & drop your CSV file here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports .csv files up to 500 rows
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Step 3: Review & Import
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-500">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {invalidCount} with errors
                </span>
              )}
              {duplicateCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {duplicateCount} duplicate emails
                </span>
              )}
              <span className="text-muted-foreground">
                Total commitment:{" "}
                <span className="font-mono tabular-nums font-medium text-foreground">
                  ${totalCommitment.toLocaleString()}
                </span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={!row.valid ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                    >
                      <TableCell>
                        {row.valid ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        ${row.commitmentAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {row.errors.length > 0 && (
                          <span className="text-xs text-red-500">
                            {row.errors.join("; ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setParsedRows([]);
                  setStep("upload");
                }}
              >
                Upload Different File
              </Button>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={validCount === 0 || !fundId}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Users className="mr-2 h-4 w-4" aria-hidden="true" />
                Import {validCount} Investors
              </Button>
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Confirm Import
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This will create {validCount} investor records in{" "}
                      <strong>
                        {funds.find((f) => f.id === fundId)?.name || "the selected fund"}
                      </strong>{" "}
                      with a total commitment of{" "}
                      <span className="font-mono tabular-nums font-medium">
                        ${totalCommitment.toLocaleString()}
                      </span>
                      .{" "}
                      {invalidCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {invalidCount} invalid rows will be skipped.
                        </span>
                      )}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleImport}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Confirm Import
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
              <p className="font-medium">Importing investors...</p>
              <p className="text-sm text-muted-foreground">
                Processing {validCount} records
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "results" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-4">
              <Badge variant="default" className="bg-green-600">
                <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                {importResults.filter((r) => r.success).length} Succeeded
              </Badge>
              {importResults.filter((r) => !r.success).length > 0 && (
                <Badge variant="destructive">
                  <X className="mr-1 h-3 w-3" aria-hidden="true" />
                  {importResults.filter((r) => !r.success).length} Failed
                </Badge>
              )}
            </div>

            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importResults.map((result, i) => (
                    <TableRow
                      key={i}
                      className={
                        !result.success ? "bg-red-50/50 dark:bg-red-950/10" : ""
                      }
                    >
                      <TableCell>
                        {result.success ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {result.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.email}
                      </TableCell>
                      <TableCell>
                        {result.error && (
                          <span className="text-xs text-red-500">
                            {result.error}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex gap-3">
              <Link href="/admin/investors">
                <Button className="bg-blue-600 text-white hover:bg-blue-700">
                  View All Investors
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setParsedRows([]);
                  setImportResults([]);
                  setStep("upload");
                }}
              >
                Import More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
