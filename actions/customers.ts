"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const customerSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phoneNumber: z.string().optional().nullable(),
  age: z.coerce.number().min(1).max(120).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Non autenticato");
  return session.user as any;
}

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

export async function createCustomer(data: z.infer<typeof customerSchema>) {
  await requireAuth();
  const parsed = customerSchema.parse(data);
  const customer = await prisma.customer.create({ data: parsed });
  revalidatePath("/customers");
  return customer;
}

export async function updateCustomer(id: string, data: z.infer<typeof customerSchema>) {
  await requireAuth();
  const parsed = customerSchema.parse(data);
  const customer = await prisma.customer.update({ where: { id }, data: parsed });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return customer;
}

export async function deleteCustomer(id: string) {
  await requireAuth();
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
}
