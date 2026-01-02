import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';
import dotenv from 'dotenv';

dotenv.config();

export function createJwt(payload: object, secret: string, daysValid = 1) {
  return jwt.sign(payload, secret, { expiresIn: `${daysValid}d` });
}

export function cookieOptions(_req: unknown): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';

  const crossSite = isProd;

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: crossSite ? 'none' : 'lax',
    domain: isProd ? '.qyvorix.com' : undefined,
    path: '/',
  };
}

export function setJwt(
  name: string,
  data: object,
  secret: string,
  expiresInHours: number,
  req?: unknown
) {
  const token = jwt.sign(data, secret, { expiresIn: `${expiresInHours}h` });

  return {
    name,
    token,
    options: {
      ...cookieOptions(req),
      maxAge: expiresInHours * 3600 * 1000,
    },
  };
}
