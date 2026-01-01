import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { connection } from '@/config/db';

interface DailyAggRow extends RowDataPacket {
  user_id: number;
  likes_sum: number;
}

export const aggregateDailyInfluence = async (questionId: number) => {
  const conn = await connection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<DailyAggRow[]>(
      `
      SELECT a.user_id, COALESCE(SUM(a.likes_count),0) AS likes_sum
      FROM answers a
      WHERE a.question_id = ? AND a.user_id IS NOT NULL
      GROUP BY a.user_id
      ORDER BY likes_sum DESC, user_id ASC
      `,
      [questionId]
    );

    await conn.query('DELETE FROM daily_user_influence WHERE question_id = ?', [questionId]);

    let rank = 0,
      lastLikes = -1,
      ties = 0;
    for (const r of rows) {
      if (r.likes_sum !== lastLikes) {
        rank = rank + 1 + ties;
        ties = 0;
        lastLikes = r.likes_sum;
      } else {
        ties += 1;
      }

      await conn.query<ResultSetHeader>(
        `INSERT INTO daily_user_influence (question_id, user_id, likes_sum, rank_position)
         VALUES (?, ?, ?, ?)`,
        [questionId, r.user_id, r.likes_sum, rank]
      );

      await conn.query<ResultSetHeader>(
        `UPDATE user_stats SET influence_total = influence_total + ? WHERE user_id = ?`,
        [r.likes_sum, r.user_id]
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};
