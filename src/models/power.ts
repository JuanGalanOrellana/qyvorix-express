import { RowDataPacket } from 'mysql2/promise';
import { connection } from '@/config/db';

type Side = 'A' | 'B';

interface SideVotesRow extends RowDataPacket {
  side: Side;
  total_votes: number;
}

interface SideLikesRow extends RowDataPacket {
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

    const [votes] = await conn.query<SideVotesRow[]>(
      `
      SELECT side, COUNT(*) AS total_votes
      FROM answers
      WHERE question_id = ?
      GROUP BY side
      `,
      [questionId]
    );

    let majority: Side = 'A';

    if (votes.length === 2) {
      if (votes[0].total_votes === votes[1].total_votes) {
        const [likes] = await conn.query<SideLikesRow[]>(
          `
          SELECT side, COALESCE(SUM(likes_count), 0) AS total_likes
          FROM answers
          WHERE question_id = ?
          GROUP BY side
          `,
          [questionId]
        );

        const aLikes = likes.find((x) => x.side === 'A')?.total_likes ?? 0;
        const bLikes = likes.find((x) => x.side === 'B')?.total_likes ?? 0;

        if (aLikes === bLikes) {
          majority = 'A';
        } else {
          majority = aLikes > bLikes ? 'A' : 'B';
        }
      } else {
        majority = votes[0].total_votes > votes[1].total_votes ? votes[0].side : votes[1].side;
      }
    } else if (votes.length === 1) {
      majority = votes[0].side;
    } else {
      majority = 'A';
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
        `
        UPDATE user_stats
        SET power_participations = power_participations + 1
        WHERE user_id = ?
        `,
        [p.user_id]
      );

      if (p.side === majority) {
        await conn.query(
          `
          UPDATE user_stats
          SET power_majority_hits = power_majority_hits + 1
          WHERE user_id = ?
          `,
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
