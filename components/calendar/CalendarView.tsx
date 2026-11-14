"use client";

import { useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Grid3x3, Calendar } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { formatHour, getBusinessHourSlots } from "@/lib/businessHours";
import { DEFAULT_SERVICE_COLOR, getContrastingTextColor } from "@/lib/colors";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import AppointmentModal from "./AppointmentModal";
import DayView from "./DayView";
import { useState } from "react";
import { PaymentStatus } from "@prisma/client";

export interface Appointment {
  id: string;
  customerId: string;
  employeeId: string | null;
  serviceType: string;
  startTime: Date;
  endTime: Date;
  price: string;
  paymentStatus: PaymentStatus;
  notes: string | null;
  customer: { id: string; firstName: string; lastName: string; phoneNumber: string | null };
  employee: { id: string; firstName: string; lastName: string } | null;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface ServiceType {
  id: string;
  name: string;
  color: string;
}

type ViewMode = "month" | "week" | "day";

interface Props {
  appointments: Appointment[];
  employees: Employee[];
  serviceTypes: ServiceType[];
  currentDate: Date;
  view: ViewMode;
  isPending?: boolean;
  onNavigate: (dir: 1 | -1) => void;
  onViewChange: (view: ViewMode) => void;
  onGoToToday: () => void;
  onRefresh: () => void;
}

export default function CalendarView({
  appointments,
  employees,
  serviceTypes,
  currentDate,
  view,
  isPending,
  onNavigate,
  onViewChange,
  onGoToToday,
  onRefresh,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const openNew = (date: Date) => {
    setSelectedAppointment(null);
    setSelectedDate(date);
    setModalOpen(true);
  };

  const openEdit = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setSelectedDate(undefined);
    setModalOpen(true);
  };

  const getAppointmentsForDay = useCallback(
    (date: Date) =>
      appointments.filter((a) => isSameDay(new Date(a.startTime), date)),
    [appointments]
  );

  const getServiceColor = useCallback(
    (serviceTypeName: string) =>
      serviceTypes.find((s) => s.name === serviceTypeName)?.color ?? DEFAULT_SERVICE_COLOR,
    [serviceTypes]
  );

  // ─── Month View ─────────────────────────────────────────────────────────────

  function renderMonthView() {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1">
          {days.map((d, idx) => {
            const dayApts = getAppointmentsForDay(d);
            const inCurrentMonth = isSameMonth(d, currentDate);
            return (
              <div
                key={idx}
                onClick={() => openNew(d)}
                className={cn(
                  "min-h-[100px] p-1 border-b border-r border-border cursor-pointer hover:bg-secondary/30 transition-colors",
                  !inCurrentMonth && "opacity-40",
                  isToday(d) && "bg-accent/20"
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 inline-flex items-center justify-center rounded-full",
                    isToday(d) && "bg-primary text-primary-foreground"
                  )}
                >
                  {format(d, "d")}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayApts.slice(0, 3).map((a) => {
                    const bg = getServiceColor(a.serviceType);
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                        className="appointment-block border"
                        style={{ backgroundColor: bg, borderColor: bg, color: getContrastingTextColor(bg) }}
                      >
                        {formatTime(a.startTime)} {a.customer.lastName}
                      </div>
                    );
                  })}
                  {dayApts.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayApts.length - 3} altri
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Week View ──────────────────────────────────────────────────────────────

  function renderWeekView() {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = getBusinessHourSlots();

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
          <div className="py-2 text-xs text-muted-foreground text-center">Ora</div>
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className={cn(
                "py-2 text-center",
                isToday(d) && "bg-accent/30"
              )}
            >
              <p className="text-xs text-muted-foreground">{format(d, "EEE", { locale: it })}</p>
              <p className={cn("text-sm font-semibold", isToday(d) && "text-primary")}>
                {format(d, "d")}
              </p>
            </div>
          ))}
        </div>

        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b border-border min-h-[60px]">
            <div className="px-2 py-1 text-[10px] text-muted-foreground text-right border-r border-border">
              {formatHour(hour)}
            </div>
            {days.map((d) => {
              const slotApts = appointments.filter((a) => {
                const start = new Date(a.startTime);
                return isSameDay(start, d) && start.getHours() === hour;
              });
              return (
                <div
                  key={d.toISOString()}
                  onClick={() => {
                    const date = new Date(d);
                    date.setHours(hour, 0, 0, 0);
                    openNew(date);
                  }}
                  className={cn(
                    "p-0.5 border-r border-border hover:bg-secondary/30 cursor-pointer transition-colors",
                    isToday(d) && "bg-accent/10"
                  )}
                >
                  {slotApts.map((a) => {
                    const bg = getServiceColor(a.serviceType);
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                        className="appointment-block border mb-0.5"
                        style={{ backgroundColor: bg, borderColor: bg, color: getContrastingTextColor(bg) }}
                      >
                        {a.customer.lastName} – {a.serviceType}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-card lg:flex-row lg:items-center">
        {/* Riga 1 (mobile) / gruppo sinistro (desktop): Oggi + navigazione data */}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onGoToToday}>
            Oggi
          </Button>

          <div className="flex items-center gap-1 flex-1 justify-center lg:flex-none lg:justify-start">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate(-1)}
              aria-label="Periodo precedente"
            >
              <ChevronLeft />
            </Button>
            <span className={cn(
              "text-sm font-semibold text-foreground min-w-[160px] text-center capitalize transition-opacity",
              isPending && "opacity-50"
            )}>
              {view === "month"
                ? format(currentDate, "MMMM yyyy", { locale: it })
                : view === "week"
                ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: it })} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: it })}`
                : format(currentDate, "EEEE d MMMM yyyy", { locale: it })
              }
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate(1)}
              aria-label="Periodo successivo"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        {/* Riga 2 (mobile) / gruppo destro (desktop): vista + nuovo appuntamento */}
        <div className="flex items-center justify-between gap-2 lg:ml-auto lg:justify-end">
          <SegmentedControl
            ariaLabel="Vista calendario"
            value={view}
            onChange={onViewChange}
            options={[
              { value: "month", ariaLabel: "Mese", label: <><Grid3x3 /><span className="hidden sm:inline">Mese</span></> },
              { value: "week", ariaLabel: "Settimana", label: <><CalendarDays /><span className="hidden sm:inline">Settimana</span></> },
              { value: "day", ariaLabel: "Giorno", label: <><Calendar /><span className="hidden sm:inline">Giorno</span></> },
            ]}
          />

          <Button
            onClick={() => openNew(new Date())}
            aria-label="Nuovo appuntamento"
            className="max-sm:w-11 max-sm:px-0"
          >
            <Plus />
            <span className="hidden sm:inline">Appuntamento</span>
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain snap-x snap-proximity no-scrollbar px-4 py-1.5 border-b border-border bg-card text-[11px]">
        {serviceTypes.map((s) => (
          <span
            key={s.id}
            className="shrink-0 snap-start px-2 py-0.5 rounded border font-medium"
            style={{ backgroundColor: s.color, borderColor: s.color, color: getContrastingTextColor(s.color) }}
          >
            {s.name}
          </span>
        ))}
      </div>

      {view === "month" ? (
        renderMonthView()
      ) : view === "week" ? (
        renderWeekView()
      ) : (
        <DayView
          currentDate={currentDate}
          appointments={getAppointmentsForDay(currentDate)}
          getServiceColor={getServiceColor}
          onSlotClick={openNew}
          onAppointmentClick={openEdit}
        />
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        appointment={selectedAppointment}
        defaultDate={selectedDate}
        employees={employees}
        onSaved={onRefresh}
      />
    </div>
  );
}
