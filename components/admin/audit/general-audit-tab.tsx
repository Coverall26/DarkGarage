import { useState, useEffect, useCallback } from "react";
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
  FileText,
  User,
  Activity,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import {
  type GeneralAuditLog,
  GENERAL_EVENT_TYPES,
  RESOURCE_TYPES,
  getGeneralEventBadgeVariant,
  formatEventType,
} from "./audit-utils";

export function GeneralAuditTab({ teamId }: { teamId: string }) {
  const [logs, setLogs] = useState<GeneralAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ format: "json" });
      if (eventFilter && eventFilter !== "all") params.set("eventType", eventFilter);
      if (resourceFilter && resourceFilter !== "all") params.set("resourceType", resourceFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("limit", "5000");

      const res = await fetch(`/api/admin/audit/export?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const allLogs: GeneralAuditLog[] = data.logs || [];

        let filteredLogs = allLogs;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filteredLogs = allLogs.filter(
            (log) =>
              log.user?.email?.toLowerCase().includes(term) ||
              log.user?.name?.toLowerCase().includes(term) ||
              log.eventType.toLowerCase().includes(term) ||
              log.resourceId?.toLowerCase().includes(term) ||
              log.ipAddress?.includes(term)
          );
        }

        setLogs(filteredLogs);
        setTotalCount(filteredLogs.length);
      }
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [eventFilter, resourceFilter, startDate, endDate, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Client-side pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [eventFilter, resourceFilter, startDate, endDate, searchTerm]);

  const handleExport = async (fmt: "csv" | "json") => {
    try {
      const params = new URLSearchParams({ format: fmt });
      if (eventFilter && eventFilter !== "all") params.set("eventType", eventFilter);
      if (resourceFilter && resourceFilter !== "all") params.set("resourceType", resourceFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (fmt === "json") params.set("download", "true");
      params.set("limit", "10000");

      const res = await fetch(`/api/admin/audit/export?${params.toString()}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.${fmt}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Audit log exported as ${fmt.toUpperCase()}`);
      }
    } catch {
      toast.error("Export failed");
    }
  };

  // Stats
  const statsMap = logs.reduce(
    (acc, log) => {
      acc.total++;
      if (log.eventType.includes("INVESTOR")) acc.investorActions++;
      if (log.eventType.includes("DOCUMENT") || log.eventType.includes("SIGNED")) acc.docActions++;
      if (log.eventType.includes("SETTINGS") || log.eventType.includes("ADMIN")) acc.adminActions++;
      return acc;
    },
    { total: 0, investorActions: 0, docActions: 0, adminActions: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{statsMap.total.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{statsMap.investorActions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Investor Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{statsMap.docActions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Document Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{statsMap.adminActions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Admin Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <CardDescription>
                All platform actions including investor management, settings changes, and document operations
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by actor, email, event, or IP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  {GENERAL_EVENT_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Resource type" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
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
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : paginatedLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit events found</p>
                <p className="text-sm mt-1">
                  {searchTerm || eventFilter !== "all" || resourceFilter !== "all" || startDate || endDate
                    ? "Try adjusting your filters"
                    : "Events will appear here as actions are performed"}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[170px]">Timestamp</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <>
                          <TableRow
                            key={log.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          >
                            <TableCell className="font-mono text-xs">
                              {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {log.user?.name || "System"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {log.user?.email || "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getGeneralEventBadgeVariant(log.eventType)}>
                                {formatEventType(log.eventType)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {log.resourceType ? (
                                <span className="text-sm">
                                  {log.resourceType}
                                  {log.resourceId && (
                                    <span className="ml-1 text-xs text-muted-foreground font-mono">
                                      {log.resourceId.slice(0, 8)}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.ipAddress || "—"}
                            </TableCell>
                            <TableCell>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                expandedRow === log.id ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedRow === log.id && log.metadata && Object.keys(log.metadata).length > 0 && (
                            <TableRow key={`${log.id}-detail`}>
                              <TableCell colSpan={6} className="bg-muted/30 py-3">
                                <div className="px-2">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Event Details</p>
                                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-h-40">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                  {log.userAgent && (
                                    <p className="text-xs text-muted-foreground mt-2 truncate">
                                      <span className="font-medium">User Agent:</span> {log.userAgent}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
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
    </div>
  );
}
