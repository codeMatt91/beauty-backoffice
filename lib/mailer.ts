/**
 * Email reminder service (Nodemailer / SMTP)
 */

import nodemailer from "nodemailer";

interface SendResult {
  success: boolean;
  error?: string;
}

function createTransporter() {
  const port = Number(process.env.EMAIL_PORT);
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    secure: port === 465, // implicit TLS on 465, STARTTLS on 587+
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_API_KEY,
    },
  });
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;

  // Validate all required env vars
  if (
    !process.env.EMAIL_HOST ||
    !process.env.EMAIL_PORT ||
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_API_KEY ||
    !from
  ) {
    console.error("[Mailer] Variabili SMTP non configurate");
    return { success: false, error: "Provider email non configurato" };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({ from, to, subject, html });
    return { success: true };
  } catch (err: any) {
    console.error("[Mailer]", err.message);
    return { success: false, error: err.message };
  }
}

export async function sendAppointmentReminderEmail(params: {
  to: string;
  customerName: string;
  date: string;
  time: string;
  service: string;
}): Promise<SendResult> {
  const { to, customerName, date, time, service } = params;
  return sendEmail({
    to,
    subject: "Promemoria appuntamento – Beauty Backoffice",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Ciao ${customerName}!</h2>
        <p>Ti ricordiamo il tuo appuntamento presso il nostro centro :</p>
        <p><strong> 📅 Data:</strong> ${date}<br/>
           <strong> ⏰ Ora:</strong> ${time}<br/>
           <strong> 💡 Servizio:</strong> ${service}</p>
        <p>⚠️ In caso di imprevisto, ti preghiamo di avvisarci con almeno 24h di anticipo.</p>
        <p>Ti aspettiamo! 🌸</p>
      </div>
    `,
  });
}
