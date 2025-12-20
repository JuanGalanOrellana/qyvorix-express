import { Request, Response, NextFunction } from 'express';
import { queryInsertion, queryRows } from '@/config/db';

function todayInMadrid(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

function daysBetween(d1: string, d2: string): number {
  const a = new Date(d1 + 'T00:00:00Z');
  const b = new Date(d2 + 'T00:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function ensureUserStats(userId: number) {
  await queryInsertion(
    `INSERT INTO user_stats (user_id, total_xp, influence_total, power_majority_hits, power_participations, streak_days, weekly_grace_tokens)
     VALUES (?, 0, 0, 0, 0, 0, 1)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
}

async function getUserStats(userId: number) {
  const rows = await queryRows<any>('SELECT * FROM user_stats WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] ?? null;
}

async function applyStreakAndXp(userId: number, today: string, newStreakDays: number) {
  const xpToday = Math.min(0.5 * newStreakDays, 3.5);
  await queryInsertion(
    `UPDATE user_stats
     SET streak_days = ?, total_xp = ROUND(total_xp + ?, 1), last_participation_date = ?
     WHERE user_id = ?`,
    [newStreakDays, xpToday, today, userId]
  );
}

export const applyStreakOnAnswerMw = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const answerId = res.locals.createdAnswerId as number | undefined;
    const user = res.locals.user as { id: number } | undefined;

    if (!answerId || !user) {
      next();
      return;
    }

    const today = todayInMadrid();

    await ensureUserStats(user.id);

    const stats = await getUserStats(user.id);
    const last = (stats?.last_participation_date as string | null) ?? null;

    let newStreak = Number(stats?.streak_days || 0);
    let grace = Number(stats?.weekly_grace_tokens ?? 1);

    if (last === today) {
      next();
      return;
    }

    if (!last) {
      newStreak = 1;
    } else {
      const gap = daysBetween(last, today);
      if (gap === 1) {
        newStreak = newStreak + 1;
      } else if (gap > 1) {
        if (grace > 0) {
          grace -= 1;
          newStreak = newStreak + 1;
        } else {
          newStreak = Math.floor(newStreak / 2) || 1;
        }
      }
    }

    if (newStreak < 1) newStreak = 1;

    await applyStreakAndXp(user.id, today, newStreak);

    if (Number(stats?.weekly_grace_tokens ?? 1) !== grace) {
      await queryInsertion('UPDATE user_stats SET weekly_grace_tokens = ? WHERE user_id = ?', [
        grace,
        user.id,
      ]);
    }

    next();
    return;
  } catch (e) {
    console.error('[applyStreakOnAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};
