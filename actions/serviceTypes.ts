"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ActionResult, zodErrorToMessage } from "@/lib/actionResult";

const serviceTypeSchema = z.object({
  name: z.string().min(2, "Il nome è obbligatorio (min. 2 caratteri).").max(50, "Il nome è troppo lungo."),
  defaultPrice: z.coerce.number().nonnegative("Il prezzo non può essere negativo."),
  durationMinutes: z.coerce
    .number()
    .int("La durata deve essere un numero intero di minuti.")
    .min(1, "La durata deve essere di almeno 1 minuto.")
    .max(1440, "La durata non può superare i 1440 minuti (24 ore).")
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Il colore deve essere in formato esadecimale (#RRGGBB)."),
});

export async function getServiceTypes() {
  await requireAuth();
  const serviceTypes = await prisma.serviceType.findMany({ orderBy: { name: "asc" } });
  return serviceTypes.map((s) => ({ ...s, defaultPrice: s.defaultPrice.toString() }));
}

export async function createServiceType(data: z.infer<typeof serviceTypeSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = serviceTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const existing = await prisma.serviceType.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { success: false, error: "Esiste già una prestazione con questo nome." };

  await prisma.serviceType.create({ data: parsed.data });
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  return { success: true, data: null };
}

export async function updateServiceType(id: string, data: z.infer<typeof serviceTypeSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = serviceTypeSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const existing = await prisma.serviceType.findUnique({ where: { name: parsed.data.name } });
  if (existing && existing.id !== id) return { success: false, error: "Esiste già una prestazione con questo nome." };

  await prisma.serviceType.update({ where: { id }, data: parsed.data });
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  return { success: true, data: null };
}

export async function deleteServiceType(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.serviceType.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/finance");
  return { success: true, data: null };
}
