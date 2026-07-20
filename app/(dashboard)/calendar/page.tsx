import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import CalendarClient from "./CalendarClient";

export default async function CalendarPage() {
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const [appointments, employees] = await Promise.all([
    prisma.appointment.findMany({
      where: { startTime: { gte: from, lte: to } },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const serializedAppointments = appointments.map((a) => ({
    ...a,
    price: a.price.toString(),
  }));

  return (
    <div className="flex flex-col h-full">
      <CalendarClient
        initialAppointments={JSON.parse(JSON.stringify(serializedAppointments))}
        employees={employees}
      />
    </div>
  );
}
