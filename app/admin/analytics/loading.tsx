/**
 * Analytics page loading skeleton.
 * Shows charts + engagement metrics skeleton.
 */
export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
      {/* Chart area */}
      <div className="h-72 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
      {/* Table */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <div className="h-10 bg-gray-800/60 animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 border-t border-gray-700/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
