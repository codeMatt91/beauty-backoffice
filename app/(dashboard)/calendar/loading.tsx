import { Skeleton } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="flex flex-col h-full" role="status" aria-label="Caricamento in corso">
      {/* Toolbar skeleton — mirrors CalendarView's toolbar */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-card lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <div className="flex items-center gap-2 flex-1 justify-center lg:flex-none lg:justify-start">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 lg:ml-auto lg:justify-end">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Grid skeleton — generic month-view placeholder */}
      <div className="flex-1 overflow-hidden p-2">
        <div className="grid grid-cols-7 gap-1 h-full">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
