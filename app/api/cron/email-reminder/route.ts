/**
 * Cron Job – Reminder Email per appuntamenti del giorno successivo
 * Schedulato in vercel.json: "0 5 * * *" (ogni giorno alle 05:00 UTC,
 * ovvero 07:00 ora italiana in CEST; 06:00 in CET durante l'ora solare)
 *
 * Sicurezza: richiede header Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAppointmentReminderEmail } from "@/lib/mailer";
import { logReminderNotification } from "@/lib/notifications";
import { addDays, startOfDay, endOfDay } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Il processo Node su Vercel gira in UTC: qualunque formattazione va
// ancorata esplicitamente a Europe/Rome, altrimenti l'orario nell'email
// risulta sfasato di 1h (CET) o 2h (CEST) rispetto a quello mostrato in app.
const ROME_TZ = "Europe/Rome";

function formatDateItRome(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTimeItRome(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatIsoDateRome(date: Date): string {
  // locale en-CA produce direttamente il formato YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

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
      await logReminderNotification({
        customerName: `${customer.firstName} ${customer.lastName}`,
        appointmentType: apt.serviceType,
        success: false,
        errorMessage: "Email mancante",
        appointmentId: apt.id,
      });
      continue;
    }

    const sendResult = await sendAppointmentReminderEmail({
      to: customer.email,
      customerName: customer.firstName,
      date: formatDateItRome(apt.startTime),
      time: formatTimeItRome(apt.startTime),
      service: apt.serviceType,
    });

    results.push({
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      appointmentId: apt.id,
      ...sendResult,
    });

    await logReminderNotification({
      customerName: `${customer.firstName} ${customer.lastName}`,
      appointmentType: apt.serviceType,
      success: sendResult.success,
      errorMessage: sendResult.error ?? null,
      appointmentId: apt.id,
    });

    // Piccola pausa tra gli invii per rispettare i rate limit dell'SMTP
    await new Promise((r) => setTimeout(r, 200));
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`[Email Cron] ${sent} email inviate, ${failed} fallite`);

  return NextResponse.json({
    message: "Cron completato",
    date: formatIsoDateRome(tomorrow),
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
