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

function toIsoDate(d: unknown): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function daysBetweenIso(d1Iso: string, d2Iso: string): number {
  const a = new Date(`${d1Iso}T00:00:00Z`);
  const b = new Date(`${d2Iso}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

type StatsRow = RowDataPacket & {
  user_id: number;
  total_xp: number;
  streak_days: number;
  last_participation_date: string | Date | null;
  weekly_grace_tokens: number;
};

async function getUserStats(userId: number): Promise<StatsRow | null> {
  const rows = await queryRows<StatsRow>('SELECT * FROM user_stats WHERE user_id = ? LIMIT 1', [
    userId,
  ]);
  return rows[0] ?? null;
}

function calcAnswerXp(streakDays: number, usedComeback: boolean): number {
  const base = usedComeback ? 10 : 12;
  const bonus = Math.min(60, Math.max(0, streakDays - 1) * 2);
  return base + bonus;
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

    const lastIso = toIsoDate(stats.last_participation_date);
    let newStreak = Number(stats.streak_days || 0);
    let grace = Number(stats.weekly_grace_tokens ?? 1);

    let usedComeback = false;

    if (lastIso === today) {
      const xpAdd = calcAnswerXp(newStreak || 1, false);
      await queryInsertion(
        `
        UPDATE user_stats
        SET total_xp = total_xp + ?
        WHERE user_id = ?
        `,
        [xpAdd, user.id]
      );
      next();
      return;
    }

    if (lastIso) {
      const gap = daysBetweenIso(lastIso, today);

      if (gap === 1) {
        newStreak = Math.max(1, newStreak) + 1;
      } else if (gap > 1) {
        if (grace > 0) {
          grace -= 1;
          newStreak = Math.max(1, newStreak) + 1;
        } else {
          usedComeback = true;
          newStreak = 1;
        }
      } else {
        newStreak = Math.max(1, newStreak);
      }
    } else {
      newStreak = 1;
    }

    const xpAdd = calcAnswerXp(newStreak, usedComeback);

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
      [newStreak, grace, today, xpAdd, user.id]
    );

    next();
    return;
  } catch (e) {
    console.error('[applyStreakOnAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};
