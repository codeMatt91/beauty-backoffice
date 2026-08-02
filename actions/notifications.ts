"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { NotificationItem } from "@/types";

export async function getNotifications(): Promise<NotificationItem[]> {
  await requireAuth();
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markNotificationsAsRead(): Promise<void> {
  await requireAuth();
  await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });
}

export async function hasUnreadNotifications(): Promise<boolean> {
  await requireAuth();
  const count = await prisma.notification.count({ where: { read: false } });
  return count > 0;
}
