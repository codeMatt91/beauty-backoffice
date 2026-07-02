"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";

const appointmentSchema = z.object({
  customerId: z.string().cuid(),
  employeeId: z.string().cuid().optional().nullable(),
  serviceType: z.string().min(2).max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  price: z.coerce.number().min(0),
  paymentStatus: z.nativeEnum(PaymentStatus).default("PENDING"),
  notes: z.string().optional().nullable(),
});

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Non autenticato");
  return session.user as any;
}

export async function getAppointments(from: Date, to: Date) {
  await requireAuth();
  return prisma.appointment.findMany({
    where: { startTime: { gte: from, lte: to } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
      employee: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function createAppointment(data: z.infer<typeof appointmentSchema>) {
  await requireAuth();
  const parsed = appointmentSchema.parse(data);

  const appointment = await prisma.appointment.create({
    data: {
      ...parsed,
      price: parsed.price,
      startTime: new Date(parsed.startTime),
      endTime: new Date(parsed.endTime),
    },
  });

  revalidatePath("/calendar");
  return appointment;
}

export async function updateAppointment(id: string, data: Partial<z.infer<typeof appointmentSchema>>) {
  await requireAuth();

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
    },
  });

  revalidatePath("/calendar");
  return appointment;
}

export async function deleteAppointment(id: string) {
  await requireAuth();
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/calendar");
}

export async function getTomorrowAppointments() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  return prisma.appointment.findMany({
    where: { startTime: { gte: tomorrow, lt: dayAfter } },
    include: {
      customer: { select: { firstName: true, lastName: true, phoneNumber: true } },
    },
    orderBy: { startTime: "asc" },
  });
}
