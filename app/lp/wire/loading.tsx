/**
 * Wire instructions page loading skeleton.
 * Shows wire details card + proof upload area skeleton.
 */
export default function WireLoading() {
  return (
    <div className="max-w-[800px] mx-auto p-6 space-y-6">
      <div className="h-7 w-44 bg-gray-700 rounded animate-pulse" />
      {/* Wire instructions card */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 space-y-4 animate-pulse">
        <div className="h-5 w-36 bg-gray-700 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-gray-700/50">
            <div className="h-4 w-24 bg-gray-700/60 rounded" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-36 bg-gray-700 rounded" />
              <div className="h-8 w-8 bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
      {/* Proof upload area */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 animate-pulse">
        <div className="h-5 w-40 bg-gray-700 rounded mb-4" />
        <div className="h-32 border-2 border-dashed border-gray-600 rounded-lg" />
      </div>
    </div>
  );
}
