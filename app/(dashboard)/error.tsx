"use client";

import { Button } from "@/components/ui/Button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
      <p className="text-sm text-muted-foreground">Impossibile caricare i dati.</p>
      <Button onClick={reset}>Riprova</Button>
    </div>
  );
}
