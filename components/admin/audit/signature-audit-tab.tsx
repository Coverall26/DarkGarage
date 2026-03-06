import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Download,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Link2,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import {
  type SignatureAuditLog,
  type ChainIntegrity,
  type VerificationResult,
  SIGNATURE_EVENT_TYPES,
  getSignatureEventIcon,
  getSignatureEventLabel,
  getSignatureEventBadgeVariant,
} from "./audit-utils";

export function SignatureAuditTab({ teamId }: { teamId: string }) {
  const [logs, setLogs] = useState<SignatureAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [stats, setStats] = useState({
    totalEvents: 0,
    signatures: 0,
    views: 0,
    declined: 0,
  });

  const [chainIntegrity, setChainIntegrity] = useState<ChainIntegrity | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [exportingCompliance, setExportingCompliance] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
    fetchChainIntegrity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, page, eventFilter, startDate, endDate]);

  const fetchChainIntegrity = async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/audit/verify`);
      if (res.ok) {
        const data = await res.json();
        setChainIntegrity(data);
      }
    } catch {
      // Chain integrity fetch is non-critical
    }
  };

  const handleVerifyChain = async () => {
    try {
      setVerifying(true);
      setVerificationResult(null);

      const res = await fetch(`/api/teams/${teamId}/audit/verify`);

      if (res.ok) {
        const data = await res.json();
        setVerificationResult(data.verification);
        if (data.verification.isValid) {
          toast.success("Audit chain verified successfully! No tampering detected.");
        } else {
          toast.error("Chain verification failed! Tampering may have occurred.");
        }
        setChainIntegrity({
          isValid: data.integrity.isValid,
          chainLength: data.integrity.chainLength,
          lastVerifiedAt: data.verifiedAt,
          genesisHash: data.integrity.genesisHash,
          latestHash: data.integrity.latestHash,
        });
      } else {
        toast.error("Failed to verify audit chain");
      }
    } catch {
      toast.error("Failed to verify audit chain");
    } finally {
      setVerifying(false);
    }
  };

  const handleComplianceExport = async () => {
    try {
      setExportingCompliance(true);

      const fromDate = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const toDate = endDate || new Date().toISOString().split("T")[0];

      const res = await fetch(`/api/teams/${teamId}/audit/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate }),
      });

      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `compliance-audit-${format(new Date(), "yyyy-MM-dd")}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Compliance export downloaded successfully");
      } else {
        toast.error("Failed to export compliance data");
      }
    } catch {
      toast.error("Failed to export compliance data");
    } finally {
      setExportingCompliance(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (eventFilter && eventFilter !== "all") params.append("event", eventFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(
        `/api/teams/${teamId}/signature-audit/export?${params.toString()}`
      );

      if (res.ok) {
        const data = await res.json();
        const allLogs = data.auditLogs || [];

        let filteredLogs = allLogs;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filteredLogs = allLogs.filter(
            (log: SignatureAuditLog) =>
              log.recipientEmail?.toLowerCase().includes(term) ||
              log.documentTitle?.toLowerCase().includes(term) ||
              log.ipAddress?.includes(term)
          );
        }

        const startIndex = (page - 1) * pageSize;
        const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

        setLogs(paginatedLogs);
        setTotalCount(filteredLogs.length);

        const signatures = allLogs.filter((l: SignatureAuditLog) => l.event === "recipient.signed").length;
        const views = allLogs.filter((l: SignatureAuditLog) => l.event === "document.viewed").length;
        const declined = allLogs.filter((l: SignatureAuditLog) => l.event === "recipient.declined").length;

        setStats({
          totalEvents: allLogs.length,
          signatures,
          views,
          declined,
        });
      }
    } catch {
      toast.error("Failed to fetch signature audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (fmt: "csv" | "pdf") => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append("format", fmt);
      if (eventFilter && eventFilter !== "all") params.append("event", eventFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(
        `/api/teams/${teamId}/signature-audit/export?${params.toString()}`
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fmt === "csv" ? "audit-report.csv" : "audit-report.html";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchAuditLogs();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalEvents.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.signatures.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Signatures</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Eye className="h-8 w-8 text-gray-500" />
              <div>
                <p className="text-2xl font-bold">{stats.views.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Document Views</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.declined.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Declined</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={chainIntegrity?.isValid === false ? "border-destructive" : chainIntegrity?.isValid === true ? "border-emerald-500" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Audit Chain Integrity
              </CardTitle>
              <CardDescription>
                Cryptographic hash chain verification for tamper detection
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleComplianceExport}
                disabled={exportingCompliance}
              >
                {exportingCompliance ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Compliance Export
              </Button>
              <Button
                onClick={handleVerifyChain}
                disabled={verifying}
                variant={chainIntegrity?.isValid === false ? "destructive" : "default"}
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Verify Chain
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chainIntegrity ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                {chainIntegrity.isValid ? (
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                ) : (
                  <XCircle className="h-8 w-8 text-destructive" />
                )}
                <div>
                  <p className="font-medium">
                    {chainIntegrity.isValid ? "Chain Valid" : "Chain Invalid"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {chainIntegrity.isValid
                      ? "No tampering detected"
                      : "Tampering may have occurred"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Hash className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium">{chainIntegrity.chainLength.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Entries in Chain</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Clock className="h-8 w-8 text-gray-500" />
                <div>
                  <p className="font-medium">
                    {format(new Date(chainIntegrity.lastVerifiedAt), "MMM d, HH:mm")}
                  </p>
                  <p className="text-sm text-muted-foreground">Last Verified</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {verificationResult && (
            <div className={`mt-4 p-4 rounded-lg ${verificationResult.isValid ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-destructive/10"}`}>
              <div className="flex items-start gap-3">
                {verificationResult.isValid ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium ${verificationResult.isValid ? "text-emerald-800 dark:text-emerald-200" : "text-destructive"}`}>
                    {verificationResult.isValid
                      ? "Verification Successful"
                      : "Verification Failed"}
                  </h4>
                  <p className="text-sm mt-1">
                    Verified {verificationResult.verifiedEntries} of {verificationResult.totalEntries} entries
                  </p>
                  {verificationResult.verifiedEntries > 0 && (
                    <Progress
                      value={(verificationResult.verifiedEntries / verificationResult.totalEntries) * 100}
                      className="mt-2 h-2"
                    />
                  )}
                  {verificationResult.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {verificationResult.errors.slice(0, 3).map((err, i) => (
                        <p key={i} className="text-xs text-destructive">{err}</p>
                      ))}
                      {verificationResult.errors.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{verificationResult.errors.length - 3} more errors
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance Audit Trail
              </CardTitle>
              <CardDescription>
                SEC 506(c) compliant audit logs for all signature events
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <Printer className="h-4 w-4 mr-2" />
                  Export Report (HTML)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email, document, or IP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by event" />
                </SelectTrigger>
                <SelectContent>
                  {SIGNATURE_EVENT_TYPES.map((event) => (
                    <SelectItem key={event.value} value={event.value}>
                      {event.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">From:</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">To:</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>

              <Button onClick={handleSearch} variant="secondary">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No signature audit events found</p>
                <p className="text-sm mt-1">
                  {searchTerm || eventFilter !== "all" || startDate || endDate
                    ? "Try adjusting your filters"
                    : "Events will appear here once documents are signed"}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Device</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSignatureEventIcon(log.event)}
                              <Badge variant={getSignatureEventBadgeVariant(log.event)}>
                                {getSignatureEventLabel(log.event)}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.documentTitle || log.documentId.slice(0, 8)}
                          </TableCell>
                          <TableCell>{log.recipientEmail || "—"}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.ipAddress || "—"}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {log.browser && log.os
                                ? `${log.browser} / ${log.os}`
                                : log.device || "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(page * pageSize, totalCount)} of {totalCount} events
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-200">SEC 506(c) Compliance Notice</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                This audit trail maintains records of all electronic signature events including
                IP addresses, timestamps, user agents, and device information. These records are
                required for &quot;reasonable steps&quot; verification of accredited investor status under
                SEC Rule 506(c). Audit logs are retained for 7 years per regulatory requirements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
