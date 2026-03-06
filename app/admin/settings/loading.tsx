/**
 * Settings center loading skeleton.
 * Shows tab bar + settings cards skeleton matching the 7-tab layout.
 */
export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-700 pb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 w-28 bg-gray-800 rounded animate-pulse shrink-0" />
        ))}
      </div>
      {/* Settings cards */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 space-y-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-5 w-40 bg-gray-800 rounded" />
              <div className="h-5 w-5 bg-gray-800 rounded" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full bg-gray-800/40 rounded" />
              <div className="h-4 w-3/4 bg-gray-800/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
