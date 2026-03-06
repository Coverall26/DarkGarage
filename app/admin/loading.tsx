/**
 * Admin portal loading skeleton.
 * Shows sidebar + header + content area skeleton matching GP dashboard layout.
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-screen bg-[#0A1628]">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-60 flex-col border-r border-gray-800 p-4 gap-3">
        <div className="h-8 w-32 bg-gray-800 rounded animate-pulse mb-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 w-full bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="h-14 border-b border-gray-800 flex items-center px-6 gap-4">
          <div className="h-8 w-64 bg-gray-800 rounded animate-pulse" />
          <div className="flex-1" />
          <div className="h-8 w-8 bg-gray-800 rounded-full animate-pulse" />
          <div className="h-8 w-8 bg-gray-800 rounded-full animate-pulse" />
        </div>
        {/* Content skeleton */}
        <div className="p-6 space-y-6">
          <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
