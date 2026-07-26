/**
 * Cron Job – Reminder Email per appuntamenti del giorno successivo
 * Schedulato in vercel.json: "0 9 * * *" (ogni giorno alle 09:00 UTC)
 *
 * Sicurezza: richiede header Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAppointmentReminderEmail } from "@/lib/mailer";
import { format, addDays, startOfDay, endOfDay } from "date-fns";
import { it } from "date-fns/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReminderResult {
  customerId: string;
  customerName: string;
  email: string;
  appointmentId: string;
  success: boolean;
  error?: string;
}

export async function POST(req: NextRequest) {
  // ── Verifica autorizzazione cron ──────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Identifica appuntamenti di domani ─────────────────────────────────────
  const tomorrow = addDays(new Date(), 1);
  const from = startOfDay(tomorrow);
  const to = endOfDay(tomorrow);

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: from, lte: to },
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  if (appointments.length === 0) {
    return NextResponse.json({
      message: "Nessun appuntamento per domani",
      sent: 0,
      skipped: 0,
    });
  }

  // ── Invia i reminder ─────────────────────────────────────────────────────
  const results: ReminderResult[] = [];

  for (const apt of appointments) {
    const { customer } = apt;

    if (!customer.email) {
      results.push({
        customerId: customer.id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        email: "",
        appointmentId: apt.id,
        success: false,
        error: "Email mancante",
      });
      continue;
    }

    const sendResult = await sendAppointmentReminderEmail({
      to: customer.email,
      customerName: customer.firstName,
      date: format(apt.startTime, "EEEE d MMMM yyyy", { locale: it }),
      time: format(apt.startTime, "HH:mm"),
      service: apt.serviceType,
    });

    results.push({
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      appointmentId: apt.id,
      ...sendResult,
    });

    // Piccola pausa tra gli invii per rispettare i rate limit dell'SMTP
    await new Promise((r) => setTimeout(r, 200));
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`[Email Cron] ${sent} email inviate, ${failed} fallite`);

  return NextResponse.json({
    message: "Cron completato",
    date: format(tomorrow, "yyyy-MM-dd"),
    total: appointments.length,
    sent,
    failed,
    results,
  });
}

// Vercel invoca i cron job via GET in alcuni casi
export async function GET(req: NextRequest) {
  return POST(req);
}
