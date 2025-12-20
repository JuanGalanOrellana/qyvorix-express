import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { queryInsertion, queryRows } from '@/config/db';
import { ensureUserStats } from '@/models/user-stats';

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

type StatsRow = RowDataPacket & {
  user_id: number;
  total_xp: number;
  streak_days: number;
  last_participation_date: string | null;
  weekly_grace_tokens: number;
};

async function getUserStats(userId: number): Promise<StatsRow | null> {
  const rows = await queryRows<StatsRow>('SELECT * FROM user_stats WHERE user_id = ? LIMIT 1', [
    userId,
  ]);
  return rows[0] ?? null;
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
    if (!stats) {
      next();
      return;
    }

    const last = stats.last_participation_date;
    let newStreak = Number(stats.streak_days || 0);
    let grace = Number(stats.weekly_grace_tokens ?? 1);

    let dailyXp = 0;
    let usedComeback = false;

    if (last === today) {
      dailyXp = 0;
    } else if (last) {
      const gap = daysBetween(last, today);

      if (gap === 1) {
        newStreak = newStreak + 1;
        dailyXp = 5;
      } else if (gap > 1) {
        if (grace > 0) {
          grace -= 1;
          newStreak = newStreak + 1;
          dailyXp = 5;
        } else {
          usedComeback = true;
          newStreak = 1;
          dailyXp = 3;
        }
      }
    } else {
      newStreak = 1;
      dailyXp = 5;
    }

    await queryInsertion(
      `
      UPDATE user_stats
      SET
        streak_days = ?,
        weekly_grace_tokens = ?,
        last_participation_date = ?,
        total_xp = total_xp + ?
      WHERE user_id = ?
      `,
      [newStreak, grace, last === today ? stats.last_participation_date : today, dailyXp, user.id]
    );

    await queryInsertion(`UPDATE user_stats SET total_xp = total_xp + 10 WHERE user_id = ?`, [
      user.id,
    ]);

    if (usedComeback) {
      await queryInsertion(
        `UPDATE user_stats SET weekly_grace_tokens = weekly_grace_tokens WHERE user_id = ?`,
        [user.id]
      );
    }

    next();
    return;
  } catch (e) {
    console.error('[applyStreakOnAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};
