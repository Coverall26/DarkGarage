/**
 * Investor list loading skeleton.
 * Shows filter bar + table rows skeleton matching the investor pipeline layout.
 */
export default function InvestorsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-800 rounded animate-pulse" />
      </div>
      {/* Pipeline stage badges */}
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 w-28 bg-gray-800 rounded-full animate-pulse shrink-0" />
        ))}
      </div>
      {/* Search bar */}
      <div className="h-10 w-full max-w-sm bg-gray-800/50 rounded-md border border-gray-700 animate-pulse" />
      {/* Table skeleton */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <div className="h-10 bg-gray-800/60 border-b border-gray-700 animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-gray-700/50 flex items-center px-4 gap-4">
            <div className="h-8 w-8 bg-gray-800 rounded-full animate-pulse" />
            <div className="h-4 w-32 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-800/60 rounded animate-pulse" />
            <div className="flex-1" />
            <div className="h-6 w-20 bg-gray-800 rounded-full animate-pulse" />
            <div className="h-4 w-24 bg-gray-800/60 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
