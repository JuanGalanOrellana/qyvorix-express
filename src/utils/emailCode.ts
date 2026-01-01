import crypto from 'crypto';

export function random6Digits(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
