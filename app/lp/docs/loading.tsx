/**
 * LP documents vault loading skeleton.
 * Shows document list with status badges skeleton.
 */
export default function LPDocsLoading() {
  return (
    <div className="max-w-[800px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 bg-gray-700 rounded animate-pulse" />
        <div className="h-9 w-32 bg-gray-700 rounded animate-pulse" />
      </div>
      {/* Filter */}
      <div className="h-9 w-40 bg-gray-700/30 rounded-md border border-gray-600 animate-pulse" />
      {/* Document list */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 bg-gray-700 rounded shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-gray-700 rounded" />
              <div className="h-3 w-32 bg-gray-700/60 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-700 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
