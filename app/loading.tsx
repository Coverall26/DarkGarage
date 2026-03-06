/**
 * Root loading skeleton for FundRoom platform.
 * Shows a centered FundRoom logo with pulse animation during page transitions.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-[#0066FF] animate-pulse flex items-center justify-center">
          <span className="text-white font-bold text-lg">FR</span>
        </div>
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[#0066FF] animate-bounce [animation-delay:0ms]" />
          <div className="h-2 w-2 rounded-full bg-[#0066FF] animate-bounce [animation-delay:150ms]" />
          <div className="h-2 w-2 rounded-full bg-[#0066FF] animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
