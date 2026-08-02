/**
 * Notification writer — persists the outcome of automated email sends
 * (currently only appointment reminders) for display in the header bell.
 */

import { prisma } from "@/lib/prisma";

export async function logReminderNotification(params: {
  customerName: string;
  appointmentType: string;
  success: boolean;
  errorMessage?: string | null;
  appointmentId: string;
}) {
  await prisma.notification.create({ data: params });
}
