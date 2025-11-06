import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { queryInsertion, queryRows } from '@/config/db';
import crypto from 'crypto';

function deriveKey() {
  const pw = process.env.SECRET_2FA_KEY || 'default_dev_key_please_change';
  return crypto.scryptSync(pw, 'salt', 32);
}

function encrypt(text: string) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(enc: string) {
  const key = deriveKey();
  const data = Buffer.from(enc, 'base64');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const encrypted = data.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return out.toString('utf8');
}

export interface UserSecurity {
  id: number;
  user_id: number;
  secret_2fa: string;
  attempts: number;
}

export type UserSecurityRegister = Omit<UserSecurity, 'user_id' | 'attempts'>;

export type UserSecurityAttempts = Pick<UserSecurity, 'id' | 'attempts'>;

export type UserSecurityResponse = UserSecurity & RowDataPacket;

const getByUserId = async (userId: number): Promise<UserSecurityResponse[]> => {
  const rows = await queryRows<UserSecurityResponse>('SELECT * FROM user_security WHERE user_id = ?', [userId]);
  return rows.map((r) => ({
    ...r,
    secret_2fa: r.secret_2fa ? decrypt(r.secret_2fa) : r.secret_2fa,
  }));
};

const getById = async (id: number): Promise<UserSecurityResponse[]> => {
  const rows = await queryRows<UserSecurityResponse>('SELECT * FROM user_security WHERE id = ?', [id]);
  return rows.map((r) => ({
    ...r,
    secret_2fa: r.secret_2fa ? decrypt(r.secret_2fa) : r.secret_2fa,
  }));
};

const insert2faUserSecurity = async (userSecurity: UserSecurityRegister): Promise<ResultSetHeader> => {
  const encrypted = userSecurity.secret_2fa ? encrypt(userSecurity.secret_2fa) : null;
  return await queryInsertion<ResultSetHeader>('UPDATE user_security SET secret_2fa = ? WHERE id = ?', [
    encrypted,
    userSecurity.id,
  ]);
};

const updateAttemptsLeft = async (userSecurity: UserSecurityAttempts): Promise<UserSecurityResponse[]> => {
  return await queryRows('UPDATE user_security SET attempts = ? WHERE id = ?', [userSecurity.attempts, userSecurity.id]);
};

export default {
  getByUserId,
  getById,
  insert2faUserSecurity,
  updateAttemptsLeft,
};
