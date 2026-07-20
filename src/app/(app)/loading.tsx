export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Title skeleton */}
      <div className="h-7 w-48 rounded-md bg-surface-raised" />

      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-4 w-full max-w-md rounded bg-surface-raised" />
        <div className="h-4 w-full max-w-sm rounded bg-surface-raised" />
        <div className="h-4 w-full max-w-lg rounded bg-surface-raised" />
      </div>

      {/* Card skeleton */}
      <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-surface-raised" />
        <div className="h-4 w-full rounded bg-surface-raised" />
        <div className="h-4 w-3/4 rounded bg-surface-raised" />
      </div>
    </div>
  );
}
