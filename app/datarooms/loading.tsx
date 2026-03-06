/**
 * Datarooms list page loading skeleton.
 * Shows dataroom cards grid skeleton.
 */
export default function DataroomsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-3 animate-pulse">
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-24 bg-gray-100 dark:bg-gray-700/60 rounded" />
            <div className="flex justify-between pt-2">
              <div className="h-4 w-20 bg-gray-100 dark:bg-gray-700/60 rounded" />
              <div className="h-4 w-20 bg-gray-100 dark:bg-gray-700/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
