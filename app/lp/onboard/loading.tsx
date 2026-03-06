/**
 * LP onboarding wizard loading skeleton.
 * Shows progress bar + form fields skeleton matching the 6-step onboarding layout.
 */
export default function OnboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center px-4 py-8">
      {/* Step indicator */}
      <div className="w-full max-w-[800px] mb-8">
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gray-700 animate-pulse" />
              {i < 5 && <div className="h-0.5 w-3 sm:w-5 bg-gray-700 animate-pulse" />}
            </div>
          ))}
        </div>
      </div>
      {/* Form content */}
      <div className="w-full max-w-[800px] space-y-6">
        <div className="h-7 w-56 bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-80 bg-gray-700/60 rounded animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-28 bg-gray-700 rounded animate-pulse" />
              <div className="h-11 w-full bg-gray-700/30 rounded-md border border-gray-600 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-4">
          <div className="h-11 w-24 bg-gray-700 rounded animate-pulse" />
          <div className="h-11 w-36 bg-[#0066FF]/30 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
