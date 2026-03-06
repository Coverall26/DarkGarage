/**
 * Investor detail page loading skeleton.
 * Shows investor header + tabs + detail panels skeleton.
 */
export default function InvestorDetailLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Back link */}
      <div className="h-5 w-32 bg-gray-800 rounded animate-pulse" />
      {/* Investor header card */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-gray-800 rounded-full animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-800/60 rounded animate-pulse" />
          </div>
          <div className="flex-1" />
          <div className="h-8 w-24 bg-gray-800 rounded-full animate-pulse" />
        </div>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-2">
        {["Overview", "Documents", "Transactions", "Activity"].map((tab) => (
          <div key={tab} className="h-8 w-24 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
      {/* Tab content */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
