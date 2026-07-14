"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  startOfDay, endOfDay,
  addMonths, subMonths,
  addWeeks, subWeeks,
  addDays, subDays,
} from "date-fns";
import CalendarView from "@/components/calendar/CalendarView";
import { getAppointments } from "@/actions/appointments";
import { PaymentStatus } from "@prisma/client";

type ViewMode = "month" | "week" | "day";

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

interface Props {
  initialAppointments: Appointment[];
  employees: { id: string; name: string }[];
}

export default function CalendarClient({ initialAppointments, employees }: Props) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [isPending, startTransition] = useTransition();

  async function fetchAppointments(date: Date, v: ViewMode) {
    const from = v === "month" ? startOfMonth(date) : v === "week" ? startOfWeek(date, { weekStartsOn: 1 }) : startOfDay(date);
    const to = v === "month" ? endOfMonth(date) : v === "week" ? endOfWeek(date, { weekStartsOn: 1 }) : endOfDay(date);
    const data = await getAppointments(from, to);
    setAppointments(JSON.parse(JSON.stringify(data)) as Appointment[]);
  }

  function handleNavigate(dir: 1 | -1) {
    const newDate = view === "month"
      ? (dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
      : view === "week"
      ? (dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
      : (dir === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
    setCurrentDate(newDate);
    startTransition(() => { fetchAppointments(newDate, view); });
  }

  function handleViewChange(newView: ViewMode) {
    setView(newView);
    startTransition(() => { fetchAppointments(currentDate, newView); });
  }

  function handleGoToToday() {
    const today = new Date();
    setCurrentDate(today);
    startTransition(() => { fetchAppointments(today, view); });
  }

  function handleRefresh() {
    startTransition(() => {
      fetchAppointments(currentDate, view);
      router.refresh();
    });
  }

  return (
    <div className="flex-1 overflow-hidden">
      <CalendarView
        appointments={appointments}
        employees={employees}
        currentDate={currentDate}
        view={view}
        isPending={isPending}
        onNavigate={handleNavigate}
        onViewChange={handleViewChange}
        onGoToToday={handleGoToToday}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
