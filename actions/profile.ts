"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getMyProfile(): Promise<{ image: string | null; createdAt: string }> {
  const user = await requireAuth();
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { image: true, createdAt: true },
  });
  return { image: dbUser.image, createdAt: dbUser.createdAt.toISOString() };
}

export async function updateProfileImage(dataUrl: string): Promise<{ success: boolean }> {
  const user = await requireAuth();

  const validPrefix = /^data:image\/(jpeg|png|svg\+xml);base64,/;
  if (!validPrefix.test(dataUrl)) {
    throw new Error("Formato immagine non valido. Usa JPEG, PNG o SVG.");
  }

  // base64 encodes 3 bytes as 4 chars; 10 MB * 4/3 ≈ 13 981 013 chars
  if (dataUrl.length > 13_981_013) {
    throw new Error("L'immagine supera il limite di 10 MB.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { image: dataUrl },
  });

  return { success: true };
}
