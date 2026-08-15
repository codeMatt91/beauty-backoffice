"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DAY_VIEW_START_HOUR,
  DAY_VIEW_END_HOUR,
  LANE_OFFSET_PX,
  LANE_OFFSET_PX_MOBILE,
  computeDayViewLayout,
} from "@/lib/calendarLayout";
import AppointmentBlock from "./AppointmentBlock";
import type { Appointment } from "./CalendarView";

interface DayViewProps {
  currentDate: Date;
  /** Appointments already filtered to `currentDate` by the caller. */
  appointments: Appointment[];
  getServiceColor: (serviceTypeName: string) => string;
  onSlotClick: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const HOURS = Array.from(
  { length: DAY_VIEW_END_HOUR - DAY_VIEW_START_HOUR },
  (_, i) => i + DAY_VIEW_START_HOUR
);
const GRID_HEIGHT_PX = (DAY_VIEW_END_HOUR - DAY_VIEW_START_HOUR) * 60;
const MOBILE_QUERY = "(max-width: 1023px)"; // matches the app's `lg` breakpoint convention

export default function DayView({
  currentDate,
  appointments,
  getServiceColor,
  onSlotClick,
  onAppointmentClick,
}: DayViewProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // A block "focused" via click-to-front on one day shouldn't stay focused
  // after navigating to another day.
  useEffect(() => {
    setFocusedId(null);
  }, [currentDate]);

  const layouts = useMemo(
    () =>
      computeDayViewLayout(appointments, {
        laneOffsetPx: isMobile ? LANE_OFFSET_PX_MOBILE : LANE_OFFSET_PX,
      }),
    [appointments, isMobile]
  );

  const appointmentById = useMemo(
    () => new Map(appointments.map((a) => [a.id, a])),
    [appointments]
  );

  function handleBlockClick(layoutId: string) {
    const layout = layouts.find((l) => l.id === layoutId);
    const appointment = appointmentById.get(layoutId);
    if (!layout || !appointment) return;

    const isFrontmost =
      focusedId === layoutId ||
      (focusedId === null && layout.clusterIndex === layout.clusterSize - 1);

    if (isFrontmost) {
      onAppointmentClick(appointment);
    } else {
      setFocusedId(layoutId);
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="relative" style={{ height: GRID_HEIGHT_PX }}>
        {/* Grid layer: hour gridlines + click-to-create on empty space */}
        <div className="absolute inset-0 z-0">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[60px_1fr] border-b border-border"
              style={{ height: 60 }}
            >
              <div className="px-2 py-1 text-[10px] text-muted-foreground text-right border-r border-border">
                {hour}:00
              </div>
              <div
                onClick={() => {
                  setFocusedId(null);
                  const date = new Date(currentDate);
                  date.setHours(hour, 0, 0, 0);
                  onSlotClick(date);
                }}
                className="hover:bg-secondary/30 cursor-pointer transition-colors"
              />
            </div>
          ))}
        </div>

        {/* Appointment layer: absolutely positioned, time-proportional blocks */}
        <div className="absolute inset-y-0 left-[60px] right-0 pointer-events-none">
          {layouts.map((layout) => {
            const appointment = appointmentById.get(layout.id);
            if (!appointment) return null;
            return (
              <AppointmentBlock
                key={layout.id}
                appointment={appointment}
                layout={layout}
                color={getServiceColor(appointment.serviceType)}
                isFocused={focusedId === layout.id}
                onClick={() => handleBlockClick(layout.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
