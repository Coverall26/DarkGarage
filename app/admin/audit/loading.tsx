/**
 * Audit log page loading skeleton.
 * Shows filter bar + audit table skeleton.
 */
export default function AuditLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 bg-gray-800 rounded animate-pulse" />
        <div className="h-10 w-28 bg-gray-800 rounded animate-pulse" />
      </div>
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-36 bg-gray-800/50 rounded-md border border-gray-700 animate-pulse" />
        ))}
      </div>
      {/* Table */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <div className="h-10 bg-gray-800/60 animate-pulse" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 border-t border-gray-700/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
