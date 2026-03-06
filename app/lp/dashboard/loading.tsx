/**
 * LP dashboard loading skeleton.
 * Shows progress tracker + summary cards + fund info skeleton.
 */
export default function LPDashboardLoading() {
  return (
    <div className="max-w-[800px] mx-auto p-6 space-y-6">
      {/* Progress tracker */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
        <div className="h-5 w-36 bg-gray-700 rounded animate-pulse mb-4" />
        <div className="flex items-center justify-between">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gray-700 animate-pulse" />
              <div className="h-3 w-16 bg-gray-700/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 animate-pulse">
            <div className="h-3 w-20 bg-gray-700/60 rounded mb-2" />
            <div className="h-6 w-24 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      {/* Fund card */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-gray-700 rounded" />
        <div className="h-2 w-full bg-gray-700 rounded-full" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-4 w-28 bg-gray-700/60 rounded" />
          <div className="h-4 w-28 bg-gray-700/60 rounded" />
        </div>
      </div>
      {/* Action items */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
