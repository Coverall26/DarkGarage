"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Users,
  Search,
  ChevronRight,
  CheckCircle2,
  Send,
  Plus,
  MoreHorizontal,
  Eye,
  Mail,
  Bell,
  Trash2,
  User,
  CheckSquare,
  Square,
  MinusSquare,
} from "lucide-react";
import {
  type InvestorSummary,
  STAGE_CONFIG,
  ENTITY_ICONS,
  ENTITY_LABELS,
  FUNDING_STATUS_CONFIG,
  formatCurrency,
  getEngagementScore,
  getEngagementBadge,
  getFundingStatus,
  formatRelativeTime,
  formatFullDate,
} from "./types";

interface InvestorTableViewProps {
  investors: InvestorSummary[];
  teamId: string | null;
  fundId: string | null;
  fundName: string;
  showInviteModal: boolean;
  setShowInviteModal: (v: boolean) => void;
  search: string;
  filterStage: string | null;
  setSearch: (v: string) => void;
  setFilterStage: (v: string | null) => void;
  onSort: (col: "name" | "commitment" | "createdAt") => void;
  sortBy: string;
  sortDir: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

export function InvestorTableView({
  investors,
  teamId,
  fundId,
  showInviteModal,
  setShowInviteModal,
  search,
  filterStage,
  setSearch,
  setFilterStage,
  onSort,
  sortBy,
  sortDir,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: InvestorTableViewProps) {
  if (investors.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="text-center py-12">
            {search ? (
              <>
                <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <p className="text-muted-foreground font-medium">
                  No investors matching &ldquo;{search}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting your search terms</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearch("")}>
                  Clear Search
                </Button>
              </>
            ) : filterStage ? (
              <>
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <p className="text-muted-foreground font-medium">
                  No {STAGE_CONFIG[filterStage]?.label || filterStage} investors
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setFilterStage(null)}>
                  Show All
                </Button>
              </>
            ) : (
              <>
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
                <p className="text-muted-foreground font-medium">No investors yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Share your dataroom link to start building your pipeline.
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  {teamId && fundId && (
                    <Button size="sm" onClick={() => setShowInviteModal(true)}>
                      <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                      Invite
                    </Button>
                  )}
                  <Link href="/admin/investors/new">
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                      Add Manually
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const allSelected = investors.length > 0 && selectedIds.size === investors.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < investors.length;

  const SelectAllIcon = allSelected ? CheckSquare : someSelected ? MinusSquare : Square;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="hidden md:grid grid-cols-[36px_1fr_120px_120px_100px_100px_80px_40px] gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
          <button
            onClick={(e) => { e.preventDefault(); onToggleSelectAll(); }}
            className="flex items-center justify-center hover:text-foreground min-h-[28px]"
            aria-label={allSelected ? "Deselect all" : "Select all"}
          >
            <SelectAllIcon className={`h-4 w-4 ${selectedIds.size > 0 ? "text-[#0066FF]" : ""}`} />
          </button>
          <button className="text-left flex items-center gap-1 hover:text-foreground" onClick={() => onSort("name")}>
            Name {sortBy === "name" && (sortDir === "asc" ? "\u2191" : "\u2193")}
          </button>
          <span>Status</span>
          <button className="text-right flex items-center gap-1 justify-end hover:text-foreground" onClick={() => onSort("commitment")}>
            Commitment {sortBy === "commitment" && (sortDir === "asc" ? "\u2191" : "\u2193")}
          </button>
          <span className="text-center">Funding</span>
          <span className="text-center">Engagement</span>
          <button className="text-right flex items-center gap-1 justify-end hover:text-foreground" onClick={() => onSort("createdAt")}>
            Activity {sortBy === "createdAt" && (sortDir === "asc" ? "\u2191" : "\u2193")}
          </button>
          <span />
        </div>
        <div className="divide-y">
          {investors.map((investor) => (
            <InvestorTableRow
              key={investor.id}
              investor={investor}
              isSelected={selectedIds.has(investor.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InvestorTableRow({
  investor,
  isSelected,
  onToggleSelect,
}: {
  investor: InvestorSummary;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const stageConfig = STAGE_CONFIG[investor.stage] || STAGE_CONFIG.APPLIED;
  const score = getEngagementScore(investor);
  const engagement = getEngagementBadge(score);
  const fundingStatus = getFundingStatus(investor);
  const fundingConfig = FUNDING_STATUS_CONFIG[fundingStatus] || FUNDING_STATUS_CONFIG.NOT_FUNDED;
  const EntityIcon = (investor.entityType && ENTITY_ICONS[investor.entityType]) || User;
  const entityLabel = (investor.entityType && ENTITY_LABELS[investor.entityType]) || "";
  const lastActivity = investor.lastActivityAt || investor.createdAt;

  const router = useRouter();

  return (
    <div
      className={`flex md:grid md:grid-cols-[36px_1fr_120px_120px_100px_100px_80px_40px] gap-2 md:gap-2 items-center px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? "bg-[#0066FF]/5" : ""}`}
      onClick={() => router.push(`/admin/investors/${investor.id}`)}
    >
      {/* Checkbox */}
      <div
        className="hidden md:flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(investor.id); }}
      >
        <button
          className="p-0.5 rounded hover:bg-muted min-h-[28px] min-w-[28px] flex items-center justify-center"
          aria-label={isSelected ? `Deselect ${investor.name}` : `Select ${investor.name}`}
        >
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-[#0066FF]" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Name + Entity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{investor.entityName || investor.name}</p>
          {investor.ndaSigned && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" aria-hidden="true" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{investor.email}</span>
          {entityLabel && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
              <EntityIcon className="h-3 w-3" aria-hidden="true" />
              {entityLabel}
            </span>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="hidden md:block">
        <Badge variant="outline" className={`text-xs ${stageConfig.color}`}>
          {stageConfig.label}
        </Badge>
      </div>

      {/* Commitment */}
      <div className="text-right">
        <p className="text-sm font-medium font-mono tabular-nums">
          {investor.commitment > 0 ? formatCurrency(investor.commitment) : "-"}
        </p>
        {investor.funded > 0 && (
          <p className="text-xs text-emerald-600 font-mono tabular-nums">
            {formatCurrency(investor.funded)} funded
          </p>
        )}
      </div>

      {/* Funding Status */}
      <div className="hidden md:flex justify-center">
        <span className={`text-xs font-medium ${fundingConfig.className}`}>
          {fundingConfig.label}
        </span>
      </div>

      {/* Engagement */}
      <div className="hidden md:flex justify-center">
        {engagement.tier !== "none" && (
          <Badge variant="outline" className={`text-xs ${engagement.className}`}>
            {engagement.icon && <engagement.icon className="h-3 w-3 mr-0.5" aria-hidden="true" />}
            {engagement.label}
          </Badge>
        )}
      </div>

      {/* Last Activity */}
      <div className="hidden md:block text-right">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-default">
                {formatRelativeTime(lastActivity)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{formatFullDate(lastActivity)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Actions */}
      <div className="hidden md:flex justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-muted min-h-[32px] min-w-[32px] flex items-center justify-center" aria-label="Investor actions">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/investors/${investor.id}`}>
                <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`mailto:${investor.email}`)}>
              <Mail className="h-4 w-4 mr-2" aria-hidden="true" />
              Send Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`mailto:${investor.email}?subject=Reminder`)}>
              <Bell className="h-4 w-4 mr-2" aria-hidden="true" />
              Send Reminder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile chevron */}
      <div className="md:hidden flex items-center">
        <Badge variant="outline" className={`text-xs mr-2 ${stageConfig.color}`}>
          {stageConfig.label}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}
