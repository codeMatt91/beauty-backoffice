"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ExpenseCategory } from "@prisma/client";

const expenseSchema = z.object({
  amount: z.coerce.number().min(0.01),
  description: z.string().min(2).max(200),
  category: z.nativeEnum(ExpenseCategory).default("ALTRO"),
  date: z.string().datetime(),
});

export async function getExpenses(from: Date, to: Date) {
  await requireAdmin();
  const expenses = await prisma.monthlyExpense.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "desc" },
  });
  return expenses.map((e) => ({
    ...e,
    amount: e.amount.toString(),
    date: e.date.toISOString(),
  }));
}

export async function createExpense(data: z.infer<typeof expenseSchema>) {
  await requireAdmin();
  const parsed = expenseSchema.parse(data);
  const expense = await prisma.monthlyExpense.create({
    data: { ...parsed, date: new Date(parsed.date) },
  });
  revalidatePath("/finance");
  return { ...expense, amount: expense.amount.toString(), date: expense.date.toISOString() };
}

export async function updateExpense(id: string, data: z.infer<typeof expenseSchema>) {
  await requireAdmin();
  const parsed = expenseSchema.parse(data);
  const expense = await prisma.monthlyExpense.update({
    where: { id },
    data: { ...parsed, date: new Date(parsed.date) },
  });
  revalidatePath("/finance");
  return { ...expense, amount: expense.amount.toString(), date: expense.date.toISOString() };
}

export async function deleteExpense(id: string) {
  await requireAdmin();
  await prisma.monthlyExpense.delete({ where: { id } });
  revalidatePath("/finance");
}

export async function getFinancialSummary(from: Date, to: Date) {
  await requireAdmin();

  const [appointments, expenses] = await Promise.all([
    prisma.appointment.findMany({
      where: { startTime: { gte: from, lte: to }, paymentStatus: "PAID" },
      select: { startTime: true, price: true, serviceType: true },
    }),
    prisma.monthlyExpense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true, amount: true, category: true },
    }),
  ]);

  return {
    appointments: appointments.map((a) => ({
      startTime: a.startTime.toISOString(),
      price: a.price.toString(),
      serviceType: a.serviceType,
    })),
    expenses: expenses.map((e) => ({
      date: e.date.toISOString(),
      amount: e.amount.toString(),
      category: e.category,
    })),
  };
}
