import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { RowDataPacket } from 'mysql2';
import Answers from '@/models/answers';
import { queryRows, queryInsertion } from '@/config/db';

export const validateCreateAnswer = [
  body('side').exists().isIn(['A', 'B']).withMessage('side must be A or B'),
  body('body').exists().isString().isLength({ min: 1, max: 280 }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: errors.array().map((e) => e.msg) });
      return;
    }
    next();
    return;
  },
];

export function getClientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  const fromHeader =
    typeof xff === 'string' && xff.length
      ? xff.split(',')[0].trim()
      : Array.isArray(xff) && xff.length
      ? xff[0].split(',')[0].trim()
      : null;

  const rawIp = fromHeader || req.socket.remoteAddress || null;
  if (!rawIp) return null;

  return rawIp.replace(/^::ffff:/, '').slice(0, 45);
}

interface AnswerOwnerRow extends RowDataPacket {
  id: number;
  user_id: number | null;
}

interface AnswerIdRow extends RowDataPacket {
  id: number;
}

export const createAnswerMw = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = res.locals.question as { id: number };
    const user = res.locals.user as { id: number } | undefined;

    const { side, body: text } = req.body as {
      side: 'A' | 'B';
      body: string;
    };

    const ip = getClientIp(req);

    if (user) {
      const existingByUser = await queryRows<AnswerOwnerRow>(
        `SELECT id, user_id
         FROM answers
         WHERE question_id = ? AND user_id = ?
         LIMIT 1`,
        [q.id, user.id]
      );

      if (existingByUser.length) {
        res.status(409).json({ message: 'Already answered this question' });
        return;
      }

      let claimedId: number | null = null;
      if (ip) {
        const existingAnon = await queryRows<AnswerOwnerRow>(
          `SELECT id, user_id
           FROM answers
           WHERE question_id = ?
             AND user_id IS NULL
             AND ip_address = ?
           LIMIT 1`,
          [q.id, ip]
        );

        if (existingAnon.length) {
          const answer = existingAnon[0];
          await queryInsertion(`UPDATE answers SET user_id = ? WHERE id = ?`, [user.id, answer.id]);
          claimedId = answer.id;
        }
      }

      if (claimedId) {
        res.locals.createdAnswerId = claimedId;
        next();
        return;
      }

      const inserted = await Answers.createAnswer({
        question_id: q.id,
        user_id: user.id,
        ip_address: ip,
        side,
        body: text,
      } as any);

      res.locals.createdAnswerId = inserted.insertId;
      next();
      return;
    }

    if (ip) {
      const existingByIp = await queryRows<AnswerIdRow>(
        `SELECT id
         FROM answers
         WHERE question_id = ? AND ip_address = ?
         LIMIT 1`,
        [q.id, ip]
      );

      if (existingByIp.length) {
        res.status(409).json({ message: 'Already answered this question' });
        return;
      }
    }

    const inserted = await Answers.createAnswer({
      question_id: q.id,
      user_id: null,
      ip_address: ip,
      side,
      body: text,
    } as any);

    res.locals.createdAnswerId = inserted.insertId;

    next();
    return;
  } catch (e) {
    console.error('[createAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};
