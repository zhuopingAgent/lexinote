export function WordCardSkeleton() {
  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-[14px] border border-white/10 bg-[#1e1e1e]/90 shadow-2xl shadow-black/50 backdrop-blur-xl sm:rounded-2xl">
      <div className="border-b border-white/10 p-4 sm:p-5 md:p-6">
        <div className="h-10 w-32 animate-pulse rounded-xl bg-white/8" />
        <div className="mt-4 h-5 w-40 animate-pulse rounded bg-white/8" />
        <div className="mt-4 h-8 w-24 animate-pulse rounded-full bg-white/8" />
      </div>
      <div className="border-b border-white/10 p-4 sm:p-5 md:p-6">
        <div className="h-5 w-20 animate-pulse rounded bg-white/8" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-white/8" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-white/8" />
        </div>
      </div>
      <div className="p-4 sm:p-5 md:p-6">
        <div className="h-5 w-20 animate-pulse rounded bg-white/8" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-white/8" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/8" />
        </div>
      </div>
    </div>
  );
}
