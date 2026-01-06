import nodemailer from 'nodemailer';
import { env } from './env';

let transporter: nodemailer.Transporter | null = null;

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

type ResendEmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  text: string;
};

async function resendSend(payload: ResendEmailPayload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`RESEND_ERROR_${r.status}${t ? `_${t}` : ''}`);
  }
}

function emailMode() {
  return (process.env.EMAIL_MODE ?? 'smtp').toLowerCase();
}

function emailFrom() {
  return emailMode() === 'resend' ? env('EMAIL_FROM') : env('SMTP_FROM');
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
