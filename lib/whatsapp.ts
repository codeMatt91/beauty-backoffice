/**
 * WhatsApp notification service
 * Supporta Twilio WhatsApp API e Meta Business API (configurabile via env)
 */

interface SendWhatsAppParams {
  to: string;       // numero internazionale, es. "+393331234567"
  message: string;
}

interface SendResult {
  success: boolean;
  sid?: string;
  error?: string;
}

// ─── Twilio Implementation ─────────────────────────────────────────────────────

async function sendViaTwilio({ to, message }: SendWhatsAppParams): Promise<SendResult> {
  const { default: twilio } = await import("twilio");

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // "whatsapp:+14155238886"

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio credentials not configured in environment variables");
  }

  const client = twilio(accountSid, authToken);

  const msg = await client.messages.create({
    from,
    to: `whatsapp:${to}`,
    body: message,
  });

  return { success: true, sid: msg.sid };
}

// ─── Meta (WhatsApp Business API) Implementation ───────────────────────────────

async function sendViaMeta({ to, message }: SendWhatsAppParams): Promise<SendResult> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("Meta WhatsApp credentials not configured");
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "text",
        text: { body: message },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    return { success: false, error: JSON.stringify(err) };
  }

  const data = await res.json();
  return { success: true, sid: data.messages?.[0]?.id };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function sendWhatsApp(params: SendWhatsAppParams): Promise<SendResult> {
  const provider = process.env.WHATSAPP_PROVIDER ?? "twilio"; // "twilio" | "meta"

  try {
    if (provider === "meta") {
      return await sendViaMeta(params);
    }
    return await sendViaTwilio(params);
  } catch (err: any) {
    console.error("[WhatsApp]", err.message);
    return { success: false, error: err.message };
  }
}

export function buildReminderMessage({
  customerName,
  date,
  time,
  service,
}: {
  customerName: string;
  date: string;
  time: string;
  service: string;
}): string {
  return (
    `Ciao ${customerName}! 👋\n` +
    `Ti ricordiamo il tuo appuntamento presso il nostro centro estetico:\n\n` +
    `📅 Data: ${date}\n` +
    `🕐 Ora: ${time}\n` +
    `💆 Servizio: ${service}\n\n` +
    `Per disdire o spostare l'appuntamento, rispondi a questo messaggio.\n` +
    `A presto! ✨`
  );
}
