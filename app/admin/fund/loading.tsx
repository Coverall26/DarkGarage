/**
 * Fund management loading skeleton.
 * Matches the fund list/detail page layout.
 */
export default function FundsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-800 rounded animate-pulse" />
        <div className="h-10 w-36 bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 space-y-4 animate-pulse">
            <div className="h-6 w-40 bg-gray-800 rounded" />
            <div className="h-4 w-24 bg-gray-800/60 rounded" />
            <div className="h-2 w-full bg-gray-800 rounded-full" />
            <div className="flex justify-between">
              <div className="h-4 w-20 bg-gray-800/60 rounded" />
              <div className="h-4 w-20 bg-gray-800/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
