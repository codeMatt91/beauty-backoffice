"use client";

import { useState } from "react";
import CalendarView from "@/components/calendar/CalendarView";
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

interface Props {
  initialAppointments: Appointment[];
  employees: { id: string; name: string }[];
}

export default function CalendarClient({ initialAppointments, employees }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);

  async function handleRefresh() {
    // Re-fetch from server action or trigger router refresh
    // In produzione useReactTransition + router.refresh() per aggiornare senza reload
    window.location.reload();
  }

  return (
    <div className="flex-1 overflow-hidden">
      <CalendarView
        appointments={appointments}
        employees={employees}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
