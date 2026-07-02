import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import CalendarView from "@/components/calendar/CalendarView";
import Header from "@/components/layout/Header";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const session = await auth();
  const user = session!.user as any;

  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const [appointments, employees] = await Promise.all([
    prisma.appointment.findMany({
      where: { startTime: { gte: from, lte: to } },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
        employee: { select: { id: true, name: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize Decimal and Date fields
  const serializedAppointments = appointments.map((a) => ({
    ...a,
    price: a.price.toString(),
    startTime: a.startTime,
    endTime: a.endTime,
    createdAt: a.createdAt,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      <Header title="Calendario" userName={user.name ?? user.email} />
      <CalendarClient
        initialAppointments={JSON.parse(JSON.stringify(serializedAppointments))}
        employees={employees}
      />
    </div>
  );
}
