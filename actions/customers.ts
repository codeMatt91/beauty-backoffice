"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ActionResult, zodErrorToMessage } from "@/lib/actionResult";

const customerSchema = z.object({
  firstName: z.string().min(2, "Il nome è obbligatorio (min. 2 caratteri).").max(50, "Il nome è troppo lungo."),
  lastName: z.string().min(2, "Il cognome è obbligatorio (min. 2 caratteri).").max(50, "Il cognome è troppo lungo."),
  phoneNumber: z.string().optional().nullable(),
  age: z.coerce
    .number({ invalid_type_error: "L'età deve essere un numero." })
    .min(1, "L'età inserita non è valida.")
    .max(120, "L'età inserita non è valida.")
    .optional()
    .nullable(),
  notes: z.string().max(500, "Le note sono troppo lunghe (max 500 caratteri).").optional().nullable(),
});


export async function getCustomers(search?: string) {
  await requireAuth();
  return prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search } },
          ],
        }
      : undefined,
    include: { _count: { select: { appointments: true } } },
    orderBy: { lastName: "asc" },
  });
}

export async function getCustomerById(id: string) {
  await requireAuth();
  return prisma.customer.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { startTime: "desc" },
        take: 10,
      },
      _count: { select: { appointments: true } },
    },
  });
}

export async function createCustomer(data: z.infer<typeof customerSchema>): Promise<ActionResult> {
  await requireAuth();
  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };
  await prisma.customer.create({ data: parsed.data });
  revalidatePath("/customers");
  return { success: true, data: null };
}

export async function updateCustomer(id: string, data: z.infer<typeof customerSchema>): Promise<ActionResult> {
  await requireAuth();
  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };
  await prisma.customer.update({ where: { id }, data: parsed.data });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true, data: null };
}

export async function deleteCustomer(id: string) {
  await requireAuth();
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
}
