import { RowDataPacket } from 'mysql2';
import { queryInsertion, queryRows } from '@/config/db';

export interface UserStatsRow extends RowDataPacket {
  user_id: number;
  total_xp: number;
  influence_total: number;
  power_majority_hits: number;
  power_participations: number;
  power_pct: number;
  streak_days: number;
  last_participation_date: string | null;
  weekly_grace_tokens: number;
  updated_at: string;
}

export async function ensureUserStats(userId: number) {
  await queryInsertion(
    `INSERT INTO user_stats (user_id, total_xp, influence_total, power_majority_hits, power_participations, streak_days, weekly_grace_tokens)
     VALUES (?, 0, 0, 0, 0, 0, 1)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
}

export async function getUserStatsByUserId(userId: number): Promise<UserStatsRow | null> {
  const rows = await queryRows<UserStatsRow>('SELECT * FROM user_stats WHERE user_id = ? LIMIT 1', [
    userId,
  ]);
  return rows[0] ?? null;
}
