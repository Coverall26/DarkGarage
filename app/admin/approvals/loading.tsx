/**
 * Approvals page loading skeleton.
 * Shows approval queue with tabs + approval cards skeleton.
 */
export default function ApprovalsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {["All", "Pending", "Approved", "Rejected", "Changes"].map((tab) => (
          <div key={tab} className="h-9 w-24 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
      {/* Search */}
      <div className="h-10 w-full max-w-sm bg-gray-800/50 rounded-md border border-gray-700 animate-pulse" />
      {/* Approval cards */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-5 space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-800 rounded-full" />
              <div className="space-y-2">
                <div className="h-5 w-36 bg-gray-800 rounded" />
                <div className="h-3 w-48 bg-gray-800/60 rounded" />
              </div>
              <div className="flex-1" />
              <div className="h-7 w-20 bg-gray-800 rounded-full" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-9 w-24 bg-gray-800 rounded" />
              <div className="h-9 w-24 bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
