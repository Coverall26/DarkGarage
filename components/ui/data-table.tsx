"use client";

import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Skeleton } from "./skeleton";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Render cell content. If not provided, uses row[key] */
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Unique key accessor for each row */
  rowKey: (row: T) => string;
  loading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  searchValue?: string;
  pageSize?: number;
  page?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  /** Render above table (filters, bulk actions) */
  toolbar?: React.ReactNode;
  /** Sort externally (server-side) */
  onSort?: (key: string, direction: "asc" | "desc") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading = false,
  searchPlaceholder = "Search...",
  onSearch,
  searchValue,
  pageSize = 10,
  page,
  totalCount,
  onPageChange,
  onRowClick,
  emptyMessage = "No results found",
  className,
  toolbar,
  onSort,
  sortKey,
  sortDirection,
}: DataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState("");
  const [localSort, setLocalSort] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [localPage, setLocalPage] = useState(0);

  const searchQuery = searchValue ?? localSearch;
  const currentPage = page ?? localPage;
  const activeSort = sortKey
    ? { key: sortKey, direction: sortDirection || "asc" }
    : localSort;

  const handleSearch = useCallback(
    (value: string) => {
      if (onSearch) {
        onSearch(value);
      } else {
        setLocalSearch(value);
        setLocalPage(0);
      }
    },
    [onSearch],
  );

  const handleSort = useCallback(
    (key: string) => {
      const newDirection =
        activeSort?.key === key && activeSort.direction === "asc"
          ? "desc"
          : "asc";
      if (onSort) {
        onSort(key, newDirection);
      } else {
        setLocalSort({ key, direction: newDirection });
      }
    },
    [activeSort, onSort],
  );

  // Client-side filtering when no external search handler
  const filteredData = useMemo(() => {
    if (onSearch || !searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some(
        (val) => typeof val === "string" && val.toLowerCase().includes(q),
      ),
    );
  }, [data, searchQuery, onSearch]);

  // Client-side sorting when no external sort handler
  const sortedData = useMemo(() => {
    if (onSort || !activeSort) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[activeSort.key];
      const bVal = b[activeSort.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return activeSort.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, activeSort, onSort]);

  // Client-side pagination when no external handler
  const paginatedData = useMemo(() => {
    if (onPageChange) return sortedData;
    return sortedData.slice(
      currentPage * pageSize,
      (currentPage + 1) * pageSize,
    );
  }, [sortedData, currentPage, pageSize, onPageChange]);

  const total = totalCount ?? filteredData.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setPage = onPageChange ?? setLocalPage;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search + Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {onSearch !== undefined || !toolbar ? (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 text-base sm:text-sm"
              aria-label={searchPlaceholder}
            />
          </div>
        ) : null}
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                      col.sortable && "cursor-pointer select-none hover:text-foreground",
                      col.headerClassName,
                    )}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && (
                        <span className="ml-1" aria-hidden="true">
                          {activeSort?.key === col.key ? (
                            activeSort.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-b">
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3">
                          <Skeleton className="h-4 w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : paginatedData.map((row, rowIdx) => (
                    <tr
                      key={rowKey(row)}
                      className={cn(
                        "border-b transition-colors",
                        onRowClick &&
                          "cursor-pointer hover:bg-muted/50 active:scale-[0.998]",
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn("px-4 py-3", col.className)}
                        >
                          {col.render
                            ? col.render(row, rowIdx)
                            : (row[col.key] as React.ReactNode)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {!loading && paginatedData.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-mono font-medium">
              {currentPage * pageSize + 1}
            </span>
            –
            <span className="font-mono font-medium">
              {Math.min((currentPage + 1) * pageSize, total)}
            </span>{" "}
            of <span className="font-mono font-medium">{total}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs font-mono text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
