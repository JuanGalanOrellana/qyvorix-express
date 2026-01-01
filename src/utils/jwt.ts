import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';
import dotenv from 'dotenv';

dotenv.config();

export function createJwt(payload: object, secret: string, daysValid = 1) {
  return jwt.sign(payload, secret, { expiresIn: `${daysValid}d` });
}

export function cookieOptions(_req?: unknown): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24,
  };
}

export function setJwt(name: string, data: object, secret: string, expiresInHours: number) {
  const token = jwt.sign(data, secret, { expiresIn: `${expiresInHours}h` });

  const isProd = process.env.NODE_ENV === 'production';
  const opts: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: expiresInHours * 3600 * 1000,
  };

  return { name, token, options: opts };
}
