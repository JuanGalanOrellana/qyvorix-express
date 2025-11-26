// src/models/power.ts
import { RowDataPacket } from 'mysql2/promise';
import { connection } from '@/config/db';

type Side = 'A' | 'B';

interface SideTotalRow extends RowDataPacket {
  side: Side;
  total_likes: number;
}

interface ParticipantRow extends RowDataPacket {
  user_id: number;
  side: Side;
}

export const settleQuestionPower = async (questionId: number) => {
  const conn = await connection();
  try {
    await conn.beginTransaction();

    const [totals] = await conn.query<SideTotalRow[]>(
      `
      SELECT side, COALESCE(SUM(likes_count), 0) AS total_likes
      FROM answers
      WHERE question_id = ?
      GROUP BY side
      `,
      [questionId]
    );

    let majority: Side = 'A';
    if (totals.length === 2) {
      majority = totals[0].total_likes >= totals[1].total_likes ? totals[0].side : totals[1].side;
    } else if (totals.length === 1) {
      majority = totals[0].side;
    }

    const [parts] = await conn.query<ParticipantRow[]>(
      `
      SELECT DISTINCT a.user_id, a.side
      FROM answers a
      WHERE a.question_id = ? AND a.user_id IS NOT NULL
      `,
      [questionId]
    );

    for (const p of parts) {
      await conn.query(
        `UPDATE user_stats
         SET power_participations = power_participations + 1
         WHERE user_id = ?`,
        [p.user_id]
      );

      if (p.side === majority) {
        await conn.query(
          `UPDATE user_stats
           SET power_majority_hits = power_majority_hits + 1
           WHERE user_id = ?`,
          [p.user_id]
        );
      }
    }

    await conn.commit();
    return majority;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};
