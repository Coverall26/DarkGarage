/**
 * GP Setup Wizard loading skeleton.
 * Shows progress indicator + form area skeleton matching the 9-step wizard layout.
 */
export default function SetupLoading() {
  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center px-4 py-8">
      {/* Progress bar skeleton */}
      <div className="w-full max-w-3xl mb-8">
        <div className="flex items-center justify-between mb-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-9 w-9 rounded-full bg-gray-800 animate-pulse" />
              <div className="h-3 w-12 bg-gray-800 rounded animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>
        <div className="h-1 bg-gray-800 rounded-full animate-pulse" />
      </div>
      {/* Form content skeleton */}
      <div className="w-full max-w-2xl space-y-6">
        <div className="h-8 w-64 bg-gray-800 rounded animate-pulse" />
        <div className="h-4 w-96 bg-gray-800/60 rounded animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
              <div className="h-10 w-full bg-gray-800/50 rounded-md border border-gray-700 animate-pulse" />
            </div>
          ))}
        </div>
        {/* Navigation buttons */}
        <div className="flex justify-between pt-4">
          <div className="h-10 w-24 bg-gray-800 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
