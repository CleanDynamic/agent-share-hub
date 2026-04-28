import { cn } from "@/lib/utils";

interface DiscoverLoadingSkeletonProps {
  count?: number;
}

export function DiscoverLoadingSkeleton({ count = 4 }: DiscoverLoadingSkeletonProps) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "rgba(22, 22, 30, 0.30)",
        border: "0.5px solid rgba(255, 255, 255, 0.05)",
      }}
    >
      <div className="flex items-center justify-between">
        <SkeletonRect className="h-4 w-24" />
        <SkeletonRect className="h-3 w-12" />
      </div>
      <div className="mt-3 space-y-2">
        <SkeletonRect className="h-4 w-3/4" />
        <SkeletonRect className="h-4 w-1/2" />
      </div>
      <div className="mt-3 space-y-1.5">
        <SkeletonRect className="h-3 w-full" />
        <SkeletonRect className="h-3 w-5/6" />
        <SkeletonRect className="h-3 w-4/6" />
      </div>
      <div className="mt-4 flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRect key={i} className="h-4 w-12" />
        ))}
      </div>
    </div>
  );
}

function SkeletonRect({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded", className)}
      style={{ background: "rgba(255,255,255,0.06)" }}
    />
  );
}
