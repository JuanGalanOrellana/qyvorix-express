import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { RowDataPacket } from 'mysql2';
import Answers from '@/models/answers';
import { queryRows } from '@/config/db';

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
  },
];

export const createAnswerMw = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = res.locals.question as { id: number };
    const user = res.locals.user as { id: number } | undefined;
    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { side, body: text } = req.body as { side: 'A' | 'B'; body: string };

    const existing = await queryRows<{ id: number } & RowDataPacket>(
      `SELECT id FROM answers WHERE question_id = ? AND user_id = ? LIMIT 1`,
      [q.id, user.id]
    );

    if (existing.length) {
      res.status(409).json({ message: 'Already answered this question' });
      return;
    }

    const inserted = await Answers.createAnswer({
      question_id: q.id,
      user_id: user.id,
      side,
      body: text,
    } as any);

    res.locals.createdAnswerId = inserted.insertId;
    next();
  } catch (e) {
    console.error('[createAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

