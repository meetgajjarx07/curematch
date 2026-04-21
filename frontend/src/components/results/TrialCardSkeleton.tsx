"use client";

/**
 * Skeleton placeholder that matches the real TrialCard dimensions so the
 * layout doesn't shift when real data arrives.
 */
export default function TrialCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <article
      className="block bg-white border border-line-soft rounded-[18px] p-6"
      style={{
        opacity: 0,
        animation: `skeletonFadeIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s forwards`,
      }}
    >
      <div className="flex items-start gap-5">
        {/* Score block skeleton */}
        <div className="flex-shrink-0 text-center">
          <div className="skeleton-shimmer h-9 w-12 rounded mb-1" />
          <div className="skeleton-shimmer h-2 w-10 rounded" />
        </div>

        {/* Divider */}
        <div className="w-px bg-line-soft self-stretch" />

        {/* Content skeleton */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="skeleton-shimmer h-5 w-14 rounded-full" />
            <div className="skeleton-shimmer h-3 w-20 rounded" />
          </div>
          <div className="skeleton-shimmer h-4 w-full max-w-[420px] rounded mb-1.5" />
          <div className="skeleton-shimmer h-4 w-3/4 max-w-[280px] rounded mb-3" />
          <div className="skeleton-shimmer h-3 w-1/2 max-w-[200px] rounded mb-4" />
          <div className="flex items-center gap-4">
            <div className="skeleton-shimmer h-3 w-14 rounded" />
            <div className="skeleton-shimmer h-3 w-16 rounded" />
            <div className="skeleton-shimmer h-3 w-12 rounded" />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes skeletonFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </article>
  );
}
