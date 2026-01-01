import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { queryRows, queryInsertion } from '@/config/db';

export interface EmailVerificationRow extends RowDataPacket {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export const createCode = (userId: number, tokenHash: string) =>
  queryInsertion(
    `INSERT INTO email_verifications (user_id, token_hash, expires_at, used, created_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), 0, UTC_TIMESTAMP())`,
    [userId, tokenHash]
  );

export const invalidateAll = (userId: number) =>
  queryInsertion<ResultSetHeader>(
    `UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0`,
    [userId]
  );

export const findValidCode = (userId: number, tokenHash: string) =>
  queryRows<EmailVerificationRow>(
    `SELECT id, user_id, token_hash, expires_at, used, created_at
     FROM email_verifications
     WHERE user_id = ?
       AND token_hash = ?
       AND used = 0
       AND expires_at >= UTC_TIMESTAMP()
     ORDER BY id DESC
     LIMIT 1`,
    [userId, tokenHash]
  );

export const markUsed = (id: number) =>
  queryInsertion<ResultSetHeader>(`UPDATE email_verifications SET used = 1 WHERE id = ?`, [id]);

export const lastSentAt = (userId: number) =>
  queryRows<{ created_at: string } & RowDataPacket>(
    `SELECT created_at
     FROM email_verifications
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );
