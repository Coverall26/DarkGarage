/**
 * Admin documents page loading skeleton.
 * Shows document review dashboard with tabs + table skeleton.
 */
export default function DocumentsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-800 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-800 rounded animate-pulse" />
          <div className="h-9 w-36 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
      {/* Status tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {["Pending", "All", "Approved", "Rejected"].map((tab) => (
          <div key={tab} className="h-9 w-24 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
      {/* Document table */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <div className="h-10 bg-gray-800/60 animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 border-t border-gray-700/50 flex items-center px-4 gap-4 animate-pulse">
            <div className="h-8 w-8 bg-gray-800 rounded shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-40 bg-gray-800 rounded" />
              <div className="h-3 w-28 bg-gray-800/60 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-800 rounded-full" />
            <div className="h-8 w-20 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
