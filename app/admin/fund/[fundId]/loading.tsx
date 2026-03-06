/**
 * Fund detail page loading skeleton.
 * Shows fund header + tabs + content area skeleton.
 */
export default function FundDetailLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* Back link */}
      <div className="h-5 w-24 bg-gray-800 rounded animate-pulse" />
      {/* Fund header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-36 bg-gray-800/60 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-gray-800 rounded animate-pulse" />
          <div className="h-9 w-28 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
      {/* Action required card */}
      <div className="h-20 bg-amber-900/10 border border-amber-800/30 rounded-lg animate-pulse" />
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 pb-2">
        {["Overview", "Wire", "Documents", "CRM", "Activity"].map((tab) => (
          <div key={tab} className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
      {/* Tab content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-800/30 border border-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
