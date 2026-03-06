/**
 * LP transactions page loading skeleton.
 * Shows summary cards + transaction list skeleton.
 */
export default function TransactionsLoading() {
  return (
    <div className="max-w-[800px] mx-auto p-6 space-y-6">
      <div className="h-7 w-36 bg-gray-700 rounded animate-pulse" />
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 animate-pulse">
            <div className="h-3 w-16 bg-gray-700/60 rounded mb-2" />
            <div className="h-6 w-20 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      {/* Filter pills */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-700/30 rounded-full border border-gray-600 animate-pulse" />
        ))}
      </div>
      {/* Transaction list */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 bg-gray-700 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-gray-700 rounded" />
              <div className="h-3 w-24 bg-gray-700/60 rounded" />
            </div>
            <div className="text-right space-y-2">
              <div className="h-5 w-24 bg-gray-700 rounded" />
              <div className="h-3 w-16 bg-gray-700/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
