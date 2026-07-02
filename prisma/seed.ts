/**
 * Prisma Seed – dati iniziali per sviluppo
 * Esegui con: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin ──────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin1234", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@beauty.it" },
    update: {},
    create: {
      name: "Admin Centro",
      email: "admin@beauty.it",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin:", admin.email);

  // ── Dipendente ─────────────────────────────────────────────────────────────
  const empHash = await bcrypt.hash("dipendente123", 12);
  const employee = await prisma.user.upsert({
    where: { email: "sara@beauty.it" },
    update: {},
    create: {
      name: "Sara Rossi",
      email: "sara@beauty.it",
      passwordHash: empHash,
      role: "EMPLOYEE",
    },
  });
  console.log("✅ Employee:", employee.email);

  // ── Clienti ────────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: "cust-001" },
      update: {},
      create: {
        id: "cust-001",
        firstName: "Giulia",
        lastName: "Bianchi",
        phoneNumber: "+39 333 1234567",
        age: 32,
        notes: "Allergia alla cera tiepida",
      },
    }),
    prisma.customer.upsert({
      where: { id: "cust-002" },
      update: {},
      create: {
        id: "cust-002",
        firstName: "Marta",
        lastName: "Verdi",
        phoneNumber: "+39 347 7654321",
        age: 45,
      },
    }),
    prisma.customer.upsert({
      where: { id: "cust-003" },
      update: {},
      create: {
        id: "cust-003",
        firstName: "Elena",
        lastName: "Ferrari",
        phoneNumber: "+39 320 9876543",
        age: 28,
        notes: "Cliente VIP",
      },
    }),
  ]);
  console.log("✅ Clienti:", customers.length);

  // ── Appuntamenti demo ──────────────────────────────────────────────────────
  const today = new Date();
  const appointments = [
    {
      customerId: "cust-001",
      employeeId: employee.id,
      serviceType: "Pulizia viso",
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
      endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
      price: 65.0,
      paymentStatus: "PAID" as const,
    },
    {
      customerId: "cust-002",
      employeeId: employee.id,
      serviceType: "Massaggio rilassante",
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0),
      endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
      price: 80.0,
      paymentStatus: "PENDING" as const,
    },
    {
      customerId: "cust-003",
      serviceType: "Laser",
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 14, 0),
      endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 15, 0),
      price: 120.0,
      paymentStatus: "PENDING" as const,
    },
  ];

  for (const apt of appointments) {
    await prisma.appointment.create({ data: apt });
  }
  console.log("✅ Appuntamenti demo:", appointments.length);

  // ── Spese demo ─────────────────────────────────────────────────────────────
  await prisma.monthlyExpense.createMany({
    data: [
      { amount: 1200, description: "Affitto mensile", category: "AFFITTO", date: new Date(today.getFullYear(), today.getMonth(), 1) },
      { amount: 150, description: "Bolletta elettrica", category: "UTENZE", date: new Date(today.getFullYear(), today.getMonth(), 5) },
      { amount: 320, description: "Rifornimento cere e prodotti", category: "MATERIALI", date: new Date(today.getFullYear(), today.getMonth(), 10) },
    ],
  });
  console.log("✅ Spese demo create");

  console.log("\n🎉 Seed completato!");
  console.log("   Admin:     admin@beauty.it / admin1234");
  console.log("   Employee:  sara@beauty.it  / dipendente123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
