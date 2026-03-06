/**
 * Outreach center loading skeleton.
 * Shows 4-tab outreach layout with follow-up queue skeleton.
 */
export default function OutreachLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {["Follow-Ups", "Sequences", "Templates", "Bulk Send"].map((tab) => (
          <div key={tab} className="h-9 w-28 bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
      {/* Follow-up queue */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 bg-gray-800 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-gray-800 rounded" />
              <div className="h-3 w-48 bg-gray-800/60 rounded" />
            </div>
            <div className="h-6 w-16 bg-amber-900/30 rounded-full" />
            <div className="h-8 w-20 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
