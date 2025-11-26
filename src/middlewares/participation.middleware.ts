import { Request, Response, NextFunction } from 'express';
import { queryInsertion, queryRows } from '@/config/db';
import Participations from '@/models/participations';

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

export const preventDuplicateParticipation = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = res.locals.user as { id: number };
    const question = res.locals.question as { id: number };
    const rows = await queryRows<any>(
      'SELECT id FROM participations WHERE user_id = ? AND question_id = ? LIMIT 1',
      [user.id, question.id]
    );
    if (rows.length) {
      res.status(409).json({ message: 'Already participated in this question' });
      return;
    }
    next();
    return;
  } catch (e) {
    console.error('[preventDuplicateParticipation]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

export const recordParticipationMw = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = res.locals.user as { id: number };
    const question = res.locals.question as { id: number };

    await Participations.ensureUserStats(user.id);
    await Participations.recordParticipation(user.id, question.id);

    const today = todayInMadrid();
    const [stats] = await Participations.getUserStats(user.id);
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

    await Participations.applyStreakAndXp(user.id, today, newStreak);

    if (Number(stats?.weekly_grace_tokens ?? 1) !== grace) {
      await queryInsertion('UPDATE user_stats SET weekly_grace_tokens = ? WHERE user_id = ?', [
        grace,
        user.id,
      ]);
    }

    next();
    return;
  } catch (e) {
    console.error('[recordParticipationMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};
