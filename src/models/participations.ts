import { RowDataPacket } from 'mysql2';
import { queryRows, queryInsertion } from '@/config/db';
import { insertRow } from '@/helpers';

export interface ParticipationRow extends RowDataPacket {
  id: number;
  user_id: number;
  question_id: number;
  created_at: string;
}

export const recordParticipation = (userId: number, questionId: number) =>
  insertRow('participations', { user_id: userId, question_id: questionId });

export const ensureUserStats = (userId: number) =>
  queryInsertion(
    `INSERT INTO user_stats (user_id, total_xp, influence_total, power_majority_hits, power_participations, streak_days, weekly_grace_tokens)
     VALUES (?, 0, 0, 0, 0, 0, 1)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );

export const applyStreakAndXp = (userId: number, today: string, newStreakDays: number) => {
  const xpToday = Math.min(0.5 * newStreakDays, 3.5);
  return queryInsertion(
    `UPDATE user_stats
     SET streak_days = ?, total_xp = ROUND(total_xp + ?, 1), last_participation_date = ?
     WHERE user_id = ?`,
    [newStreakDays, xpToday, today, userId]
  );
};

export const getUserStats = (userId: number) =>
  queryRows<any>('SELECT * FROM user_stats WHERE user_id = ?', [userId]);

export default { recordParticipation, ensureUserStats, applyStreakAndXp, getUserStats };
