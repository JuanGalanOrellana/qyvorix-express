import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from './env';

let transporter: nodemailer.Transporter | null = null;
let resendClient: Resend | null = null;

function getSmtpTransporter() {
  if (!transporter) {
    const port = Number(env('SMTP_PORT'));
    transporter = nodemailer.createTransport({
      host: env('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
      requireTLS: port === 587,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(env('RESEND_API_KEY'));
  }
  return resendClient;
}

function emailMode() {
  return (process.env.EMAIL_MODE ?? 'smtp').toLowerCase();
}

function emailFrom() {
  return emailMode() === 'resend' ? env('EMAIL_FROM') : env('SMTP_FROM');
}

async function resendSend(payload: {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
}) {
  const client = getResendClient();
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const r = await client.emails.send({
    from: payload.from,
    to,
    subject: payload.subject,
    text: payload.text,
  });

  if ((r as any)?.error) {
    const e = (r as any).error;
    const msg =
      typeof e === 'string'
        ? e
        : `${e?.name ?? 'RESEND_ERROR'}_${e?.message ?? 'unknown'}${
            e?.statusCode ? `_STATUS_${e.statusCode}` : ''
          }`;
    throw new Error(msg);
  }
}

export async function sendVerificationEmail(to: string, code: string) {
  const from = emailFrom();

  if (emailMode() === 'resend') {
    await resendSend({
      from,
      to,
      subject: 'Código de verificación – Qyvorix',
      text: `Tu código de verificación es: ${code}`,
    });
    return;
  }

  await getSmtpTransporter().sendMail({
    from,
    to,
    subject: 'Código de verificación – Qyvorix',
    text: `Tu código de verificación es: ${code}`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = emailFrom();

  if (emailMode() === 'resend') {
    await resendSend({
      from,
      to,
      subject: 'Restablecer contraseña – Qyvorix',
      text: `Para restablecer tu contraseña abre este enlace: ${resetUrl}`,
    });
    return;
  }

  await getSmtpTransporter().sendMail({
    from,
    to,
    subject: 'Restablecer contraseña – Qyvorix',
    text: `Para restablecer tu contraseña abre este enlace: ${resetUrl}`,
  });
}
