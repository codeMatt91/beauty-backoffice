"use client";

import { cn, formatTime, formatCurrency } from "@/lib/utils";
import { getContrastingTextColor } from "@/lib/colors";
import { FOCUS_Z_INDEX, type DayViewBlockLayout } from "@/lib/calendarLayout";
import type { Appointment } from "./CalendarView";

interface AppointmentBlockProps {
  appointment: Appointment;
  layout: DayViewBlockLayout;
  color: string;
  isFocused: boolean;
  onClick: () => void;
}

function textClampClass(heightPx: number): string {
  if (heightPx < 40) return "truncate";
  if (heightPx < 64) return "line-clamp-2";
  return "line-clamp-3";
}

export default function AppointmentBlock({
  appointment,
  layout,
  color,
  isFocused,
  onClick,
}: AppointmentBlockProps) {
  const textColor = getContrastingTextColor(color);
  const zIndex = isFocused ? FOCUS_Z_INDEX : layout.zIndex;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute pointer-events-auto rounded-md border px-2 py-1 text-xs font-medium leading-tight cursor-pointer transition-opacity hover:opacity-90 min-w-11",
        textClampClass(layout.height)
      )}
      style={{
        top: layout.top,
        height: layout.height,
        left: layout.offsetX,
        right: 0,
        zIndex,
        backgroundColor: color,
        borderColor: color,
        color: textColor,
      }}
    >
      {formatTime(appointment.startTime)} {appointment.customer.lastName} – {appointment.serviceType}
      {appointment.employee && ` (${appointment.employee.firstName} ${appointment.employee.lastName})`} ·{" "}
      {formatCurrency(appointment.price)}
    </div>
  );
}
