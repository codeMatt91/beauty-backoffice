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
import { cn, formatTime, formatCurrency } from "@/lib/utils";
import AppointmentModal from "./AppointmentModal";
import { useState } from "react";
import { PaymentStatus } from "@prisma/client";

interface Appointment {
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
  employee: { id: string; name: string } | null;
}

interface Employee {
  id: string;
  name: string;
}

type ViewMode = "month" | "week" | "day";

interface Props {
  appointments: Appointment[];
  employees: Employee[];
  currentDate: Date;
  view: ViewMode;
  isPending?: boolean;
  onNavigate: (dir: 1 | -1) => void;
  onViewChange: (view: ViewMode) => void;
  onGoToToday: () => void;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  OPTIONAL: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function CalendarView({
  appointments,
  employees,
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
                  {dayApts.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                      className={cn(
                        "appointment-block border",
                        STATUS_COLORS[a.paymentStatus]
                      )}
                    >
                      {formatTime(a.startTime)} {a.customer.lastName}
                    </div>
                  ))}
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
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);

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
              {hour}:00
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
                  {slotApts.map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                      className={cn(
                        "appointment-block border mb-0.5",
                        STATUS_COLORS[a.paymentStatus]
                      )}
                    >
                      {a.customer.lastName} – {a.serviceType}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ─── Day View ───────────────────────────────────────────────────────────────

  function renderDayView() {
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);
    const dayApts = getAppointmentsForDay(currentDate);

    return (
      <div className="flex-1 overflow-auto">
        {hours.map((hour) => {
          const slotApts = dayApts.filter((a) => new Date(a.startTime).getHours() === hour);
          return (
            <div key={hour} className="grid grid-cols-[60px_1fr] border-b border-border min-h-[60px]">
              <div className="px-2 py-1 text-[10px] text-muted-foreground text-right border-r border-border">
                {hour}:00
              </div>
              <div
                onClick={() => {
                  const date = new Date(currentDate);
                  date.setHours(hour, 0, 0, 0);
                  openNew(date);
                }}
                className="p-1 hover:bg-secondary/30 cursor-pointer transition-colors"
              >
                {slotApts.map((a) => (
                  <div
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                    className={cn(
                      "appointment-block border mb-0.5",
                      STATUS_COLORS[a.paymentStatus]
                    )}
                  >
                    {formatTime(a.startTime)} {a.customer.lastName} – {a.serviceType}
                    {a.employee && ` (${a.employee.name})`} · {formatCurrency(a.price)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <button
          onClick={onGoToToday}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors"
        >
          Oggi
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigate(-1)}
            className="p-1.5 rounded-lg hover:bg-secondary"
            aria-label="Periodo precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
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
          <button
            onClick={() => onNavigate(1)}
            className="p-1.5 rounded-lg hover:bg-secondary"
            aria-label="Periodo successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => onViewChange("month")}
              className={cn("px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors",
                view === "month" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mese</span>
            </button>
            <button
              onClick={() => onViewChange("week")}
              className={cn("px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors",
                view === "week" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settimana</span>
            </button>
            <button
              onClick={() => onViewChange("day")}
              className={cn("px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors",
                view === "day" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Giorno</span>
            </button>
          </div>

          <button
            onClick={() => openNew(new Date())}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Appuntamento</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border bg-card text-[11px]">
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={cn("px-2 py-0.5 rounded border font-medium", cls)}>
            {status === "PAID" ? "Pagato" : status === "PENDING" ? "Da pagare" : "Opzionale"}
          </span>
        ))}
      </div>

      {view === "month" ? renderMonthView() : view === "week" ? renderWeekView() : renderDayView()}

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
