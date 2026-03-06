/**
 * Offering / dataroom landing page loading skeleton.
 * Shows offering header + documents + invest button area skeleton.
 */
export default function OfferingLoading() {
  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      {/* Hero section */}
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="bg-white border rounded-lg p-8 space-y-4 animate-pulse">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-full max-w-lg bg-gray-200/60 rounded" />
          <div className="flex gap-4 pt-2">
            <div className="h-6 w-24 bg-gray-200 rounded-full" />
            <div className="h-6 w-24 bg-gray-200 rounded-full" />
          </div>
        </div>
        {/* Document grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border rounded-lg p-4 space-y-3 animate-pulse">
              <div className="h-32 bg-gray-100 rounded" />
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
