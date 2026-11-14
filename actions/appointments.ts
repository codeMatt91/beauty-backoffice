"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PaymentStatus } from "@prisma/client";
import { ActionResult, zodErrorToMessage } from "@/lib/actionResult";
import { isSameSlot, validateWithinBusinessHours } from "@/lib/businessHours";

const appointmentBaseSchema = z.object({
  customerId: z.string().min(1, "Seleziona un cliente."),
  employeeId: z.string().min(1).optional().nullable(),
  serviceType: z.string().min(2, "Seleziona una prestazione.").max(100),
  startTime: z.string().datetime({ message: "Data/ora di inizio non valida." }),
  endTime: z.string().datetime({ message: "Data/ora di fine non valida." }),
  price: z.coerce
    .number({ invalid_type_error: "Il prezzo deve essere un numero." })
    .min(0, "Il prezzo non può essere negativo."),
  paymentStatus: z.nativeEnum(PaymentStatus).default("PAID"),
  notes: z.string().optional().nullable(),
});

const appointmentSchema = appointmentBaseSchema.superRefine((data, ctx) => {
  // Copre anche il controllo fine > inizio. La validazione degli orari vive
  // qui (server) perché la Server Action è un endpoint invocabile
  // direttamente: il controllo nel modale è solo UX.
  const error = validateWithinBusinessHours(new Date(data.startTime), new Date(data.endTime));
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: ["endTime"] });
});

const appointmentUpdateSchema = appointmentBaseSchema.partial().refine(
  (d) => !d.startTime || !d.endTime || new Date(d.endTime) > new Date(d.startTime),
  { message: "L'orario di fine deve essere successivo all'inizio.", path: ["endTime"] }
);

export async function getAppointments(from: Date, to: Date) {
  await requireAuth();
  const appointments = await prisma.appointment.findMany({
    where: { startTime: { gte: from, lte: to } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phoneNumber: true } },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { startTime: "asc" },
  });
  return appointments.map((a) => ({
    ...a,
    price: a.price.toString(),
  }));
}

export async function createAppointment(data: z.infer<typeof appointmentBaseSchema>): Promise<ActionResult> {
  await requireAuth();
  const parsed = appointmentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  await prisma.appointment.create({
    data: {
      ...parsed.data,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
    },
  });

  revalidatePath("/calendar");
  return { success: true, data: null };
}

export async function updateAppointment(id: string, data: Partial<z.infer<typeof appointmentBaseSchema>>): Promise<ActionResult> {
  await requireAuth();
  const parsed = appointmentUpdateSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  // Update parziale: ricostruisce lo slot effettivo unendo i nuovi valori a
  // quelli salvati, così non si aggira il controllo inviando un solo campo.
  // Se lo slot non cambia (es. si aggiorna solo il pagamento) non si valida:
  // gli appuntamenti storici fuori fascia restano modificabili.
  if (parsed.data.startTime || parsed.data.endTime) {
    const current = await prisma.appointment.findUnique({
      where: { id },
      select: { startTime: true, endTime: true },
    });
    if (!current) return { success: false, error: "Appuntamento non trovato." };
    const nextStart = parsed.data.startTime ? new Date(parsed.data.startTime) : current.startTime;
    const nextEnd = parsed.data.endTime ? new Date(parsed.data.endTime) : current.endTime;
    if (!isSameSlot(nextStart, nextEnd, current.startTime, current.endTime)) {
      const hoursError = validateWithinBusinessHours(nextStart, nextEnd);
      if (hoursError) return { success: false, error: hoursError };
    }
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      ...parsed.data,
      startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : undefined,
      endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : undefined,
    },
  });

  revalidatePath("/calendar");
  return { success: true, data: null };
}

export async function deleteAppointment(id: string) {
  await requireAuth();
  await prisma.appointment.delete({ where: { id } });
  revalidatePath("/calendar");
}
