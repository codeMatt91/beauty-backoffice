/**
 * Email notification service (Resend)
 */

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("[Email] RESEND_API_KEY o EMAIL_FROM non configurati");
    return { success: false, error: "Email provider non configurato" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Reimposta la tua password – Beauty Backoffice",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reimposta la tua password</h2>
          <p>Abbiamo ricevuto una richiesta di reset password per il tuo account Beauty Backoffice.</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#e11d48;color:#fff;border-radius:8px;text-decoration:none;">Reimposta password</a></p>
          <p>Il link scade tra 1 ora. Se non hai richiesto questo reset, ignora questa email.</p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("[Email]", err.message);
    return { success: false, error: err.message };
  }
}
