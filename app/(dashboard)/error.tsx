"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
      <p className="text-sm text-muted-foreground">Impossibile caricare i dati.</p>
      <button
        onClick={reset}
        className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Riprova
      </button>
    </div>
  );
}
