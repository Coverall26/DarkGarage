/**
 * LP portal loading skeleton.
 * Shows header + content area skeleton matching LP dark gradient theme.
 */
export default function LPLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header skeleton */}
      <div className="border-b border-gray-700/50 px-4 py-3">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <div className="h-7 w-28 bg-gray-700 rounded animate-pulse" />
          <div className="hidden md:flex gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 w-20 bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-8 w-8 bg-gray-700 rounded-full animate-pulse" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="max-w-[800px] mx-auto p-6 space-y-6">
        <div className="h-8 w-48 bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-700/30 border border-gray-600 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
