import { Request } from 'express';
import { RowDataPacket } from 'mysql2';
import { queryInsertion, queryRows } from '@/config/db';
import Participations from '@/models/participations';
import { getClientIp } from '@/middlewares/answer.middleware';

export async function attachAnonAnswersAndParticipations(req: Request, userId: number) {
  const ip = getClientIp(req);
  if (!ip) return;

  await queryInsertion(
    `UPDATE answers
       SET user_id = ?
     WHERE user_id IS NULL
       AND ip_address = ?`,
    [userId, ip]
  );

  await Participations.ensureUserStats(userId);

  const rows = await queryRows<{ question_id: number } & RowDataPacket>(
    `
      SELECT DISTINCT a.question_id
        FROM answers a
        LEFT JOIN participations p
          ON p.question_id = a.question_id
         AND p.user_id = ?
       WHERE a.user_id = ?
         AND p.id IS NULL
    `,
    [userId, userId]
  );

  for (const row of rows) {
    await Participations.recordParticipation(userId, row.question_id);
  }
}
