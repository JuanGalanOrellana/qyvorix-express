import nodemailer from 'nodemailer';
import { env } from './env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env('SMTP_HOST'),
      port: Number(env('SMTP_PORT')),
      secure: false,
      auth: {
        user: env('SMTP_USER'),
        pass: env('SMTP_PASS'),
      },
    });
  }
  return transporter;
}

export async function sendVerificationEmail(to: string, code: string) {
  await getTransporter().sendMail({
    from: env('SMTP_FROM'),
    to,
    subject: 'Código de verificación – DebatiX',
    text: `Tu código de verificación es: ${code}`,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await getTransporter().sendMail({
    from: env('SMTP_FROM'),
    to,
    subject: 'Restablecer contraseña – DebatiX',
    text: `Para restablecer tu contraseña abre este enlace: ${resetUrl}`,
  });
}
