"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { ActionResult, zodErrorToMessage } from "@/lib/actionResult";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 ora

// TEMP: Resend è in modalità sandbox senza dominio verificato, quindi può
// inviare solo a questo indirizzo. Rimuovere e usare `user.email` una volta
// verificato un dominio su Resend.
const TEMP_TEST_RECIPIENT_EMAIL = "emanuela94@yopmail.com";

const requestResetSchema = z.object({
  email: z.string().email("Inserisci un indirizzo email valido."),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Link non valido o scaduto."),
  password: z.string().min(8, "La password deve contenere almeno 8 caratteri."),
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(
  email: string,
): Promise<ActionResult> {
  const parsed = requestResetSchema.safeParse({ email });
  if (!parsed.success)
    return { success: false, error: zodErrorToMessage(parsed.error) };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (user) {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl, user.email);
  }

  // Messaggio identico indipendentemente dall'esistenza dell'utente, per non rivelare quali email sono registrate.
  return { success: true, data: null };
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({ token, password });
  if (!parsed.success)
    return { success: false, error: zodErrorToMessage(parsed.error) };

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt < new Date()
  ) {
    return { success: false, error: "Link non valido o scaduto." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true, data: null };
}
