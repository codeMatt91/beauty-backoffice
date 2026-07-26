/**
 * Email reminder service (Nodemailer / SMTP)
 */

import nodemailer from "nodemailer";

interface SendResult {
  success: boolean;
  error?: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_API_KEY,
  },
});

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

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_API_KEY || !from) {
    console.error("[Mailer] Variabili SMTP non configurate");
    return { success: false, error: "Provider email non configurato" };
  }

  try {
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
        <p>Ti ricordiamo il tuo appuntamento presso il nostro centro estetico:</p>
        <p><strong>Data:</strong> ${date}<br/>
           <strong>Ora:</strong> ${time}<br/>
           <strong>Servizio:</strong> ${service}</p>
        <p>Per disdire o spostare l'appuntamento, contattaci.</p>
      </div>
    `,
  });
}
