import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name, needed when the visible label can be hidden (e.g. icon-only on mobile). */
  ariaLabel?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}

// Recessed track with the active option raised on top of it.
export function SegmentedControl<T extends string>({ value, onChange, options, ariaLabel, className }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex items-center gap-1 rounded-xl bg-secondary p-1 shadow-recessed", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-[box-shadow,background-color,color] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "[&_svg]:size-4 [&_svg]:shrink-0",
              selected
                ? "border-border bg-card bg-gradient-to-b from-card to-secondary text-foreground shadow-raised"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
