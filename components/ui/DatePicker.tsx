"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, isValid, parse } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wire format shared with the native `<input type="date">` it replaces. */
const VALUE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "d MMM yyyy";

interface DatePickerProps {
  /** Selected date as `yyyy-MM-dd` (same format as `<input type="date">`). */
  value: string;
  /** Receives the new date as `yyyy-MM-dd`. */
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /**
   * Below the `md` breakpoint (< 768px) render the browser's native
   * `<input type="date">` instead of the popover calendar: phones keep the
   * OS picker, tablets and desktops get the custom one. Pure CSS switch
   * (no matchMedia), so there is no hydration mismatch or layout flash.
   */
  nativeOnMobile?: boolean;
}

const NATIVE_INPUT_CLASS =
  "w-full min-w-0 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary";

/** Parses `yyyy-MM-dd` as a *local* date (avoids the UTC off-by-one of `new Date(str)`). */
function parseValue(value: string): Date | undefined {
  if (!value) return undefined;
  const date = parse(value, VALUE_FORMAT, new Date());
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  value,
  onChange,
  ariaLabel,
  placeholder = "Seleziona data",
  disabled,
  id,
  className,
  nativeOnMobile = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseValue(value), [value]);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onChange(format(date, VALUE_FORMAT));
    setOpen(false);
  }

  const picker = (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={selected ? `${ariaLabel}: ${format(selected, "d MMMM yyyy", { locale: it })}` : ariaLabel}
          className={cn(
            "inline-flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-left text-sm",
            "transition-colors hover:bg-secondary/60",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:ring-2 data-[state=open]:ring-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            nativeOnMobile && "hidden md:inline-flex",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("truncate tabular-nums", !selected && "text-muted-foreground")}>
            {selected ? format(selected, DISPLAY_FORMAT, { locale: it }) : placeholder}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          // Let DayPicker's autoFocus put focus on the selected day instead of
          // Radix focusing the first focusable element (the "previous" button).
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "z-[60] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DayPicker
            mode="single"
            required
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            locale={it}
            weekStartsOn={1}
            numberOfMonths={1}
            showOutsideDays
            autoFocus
            components={{
              Chevron: ({ orientation, className: chevronClass }) =>
                orientation === "left" ? (
                  <ChevronLeft className={chevronClass} aria-hidden="true" />
                ) : (
                  <ChevronRight className={chevronClass} aria-hidden="true" />
                ),
            }}
            classNames={{
              root: "relative w-fit",
              months: "relative flex flex-col",
              month: "space-y-2",
              nav: "absolute inset-x-0 top-0 flex items-center justify-between",
              button_previous:
                "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40",
              button_next:
                "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40",
              chevron: "h-4 w-4",
              month_caption: "flex h-9 items-center justify-center",
              caption_label: "text-sm font-semibold capitalize",
              month_grid: "border-collapse",
              weekdays: "",
              weekday:
                "h-8 w-10 sm:w-9 text-center text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
              weeks: "",
              week: "",
              day: "p-0 text-center text-sm",
              day_button: cn(
                "inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg tabular-nums transition-colors",
                "hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              ),
              today: "font-semibold text-primary",
              selected:
                "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:shadow-sm",
              outside: "text-muted-foreground/50",
              disabled: "pointer-events-none opacity-40",
              hidden: "invisible",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  if (!nativeOnMobile) return picker;

  return (
    <>
      <input
        type="date"
        id={id ? `${id}-native` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(NATIVE_INPUT_CLASS, "md:hidden", className)}
      />
      {picker}
    </>
  );
}
