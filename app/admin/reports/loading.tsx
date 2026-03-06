/**
 * Reports page loading skeleton.
 * Shows metric cards + charts + tables skeleton.
 */
export default function ReportsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-800 rounded animate-pulse" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 space-y-2 animate-pulse">
            <div className="h-3 w-20 bg-gray-700/60 rounded" />
            <div className="h-7 w-28 bg-gray-700 rounded" />
            <div className="h-2 w-full bg-gray-700/40 rounded-full" />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
