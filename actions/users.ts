"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";

const createUserSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role).default("EMPLOYEE"),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8).optional(),
});

export async function getEmployees() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
}

export async function getAllUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
}

export async function createUser(data: z.infer<typeof createUserSchema>) {
  await requireAdmin();
  const parsed = createUserSchema.parse(data);

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) throw new Error("Email già in uso");

  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: parsed.role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  revalidatePath("/employees");
  return user;
}

export async function updateUser(id: string, data: z.infer<typeof updateUserSchema>) {
  await requireAdmin();
  const parsed = updateUserSchema.parse(data);

  const updateData: Record<string, unknown> = { ...parsed };
  if (parsed.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.password, 12);
    delete updateData.password;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  revalidatePath("/employees");
  return user;
}

export async function deleteUser(id: string) {
  const admin = await requireAdmin();
  if (admin.id === id) throw new Error("Non puoi eliminare il tuo account");

  const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (targetUser?.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) throw new Error("Non puoi eliminare l'ultimo account Admin");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/employees");
}
