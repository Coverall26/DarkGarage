/**
 * Dataroom detail page loading skeleton.
 * Shows sidebar + document tree skeleton.
 */
export default function DataroomDetailLoading() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 space-y-3 hidden md:block">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-full bg-gray-100 dark:bg-gray-700/60 rounded animate-pulse" />
        ))}
      </div>
      {/* Main content */}
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
