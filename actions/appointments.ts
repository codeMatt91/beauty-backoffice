"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";

const appointmentBaseSchema = z.object({
  customerId: z.string().min(1),
  employeeId: z.string().min(1).optional().nullable(),
  serviceType: z.string().min(2).max(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  price: z.coerce.number().min(0),
  paymentStatus: z.nativeEnum(PaymentStatus).default("PENDING"),
  notes: z.string().optional().nullable(),
});

const appointmentSchema = appointmentBaseSchema.refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "L'orario di fine deve essere successivo all'inizio", path: ["endTime"] }
);

export async function getAppointments(from: Date, to: Date) {
  await requireAuth();
  const appointments = await prisma.appointment.findMany({
    where: { startTime: { gte: from, lte: to } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
      employee: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });
  return appointments.map((a) => ({
    ...a,
    price: a.price.toString(),
  }));
}

export async function createAppointment(data: z.infer<typeof appointmentBaseSchema>) {
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
  return { ...appointment, price: appointment.price.toString() };
}

export async function updateAppointment(id: string, data: Partial<z.infer<typeof appointmentBaseSchema>>) {
  await requireAuth();
  const parsed = appointmentBaseSchema.partial().parse(data);

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...parsed,
      startTime: parsed.startTime ? new Date(parsed.startTime) : undefined,
      endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
    },
  });

  revalidatePath("/calendar");
  return { ...appointment, price: appointment.price.toString() };
}

export async function deleteAppointment(id: string) {
  await requireAuth();
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/calendar");
}
