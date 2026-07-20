"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { ActionResult, zodErrorToMessage } from "@/lib/actionResult";

const createUserSchema = z.object({
  firstName: z.string().min(1, "Il nome è obbligatorio.").max(80),
  lastName: z.string().min(1, "Il cognome è obbligatorio.").max(80),
  email: z.string().email("Inserisci un indirizzo email valido."),
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri."),
  role: z.nativeEnum(Role).default("EMPLOYEE"),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri.").optional(),
});

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

export async function getEmployees() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    select: USER_SELECT,
    orderBy: { firstName: "asc" },
  });
}

export async function getAllUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { firstName: "asc" },
  });
}

export async function createUser(data: z.infer<typeof createUserSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { success: false, error: "Questa email è già in uso." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
    select: USER_SELECT,
  });

  revalidatePath("/employees");
  return { success: true, data: null };
}

export async function updateUser(id: string, data: z.infer<typeof updateUserSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: zodErrorToMessage(parsed.error) };

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    delete updateData.password;
  }

  await prisma.user.update({
    where: { id },
    data: updateData,
    select: USER_SELECT,
  });

  revalidatePath("/employees");
  return { success: true, data: null };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.id === id) return { success: false, error: "Non puoi eliminare il tuo account." };

  const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (targetUser?.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { success: false, error: "Non puoi eliminare l'ultimo account Admin." };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/employees");
  return { success: true, data: null };
}
