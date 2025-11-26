import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import Answers from '@/models/answers';

export const validateCreateAnswer = [
  body('side').exists().isIn(['A', 'B']).withMessage('side must be A or B'),
  body('body').exists().isString().isLength({ min: 1, max: 280 }),
  body('anonymous_key').optional({ nullable: true }).isString().isLength({ max: 64 }),
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

export const createAnswerMw = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = res.locals.question as { id: number };
    const user = res.locals.user as { id: number } | undefined;

    const {
      side,
      body: text,
      anonymous_key,
    } = req.body as {
      side: 'A' | 'B';
      body: string;
      anonymous_key?: string | null;
    };

    const data = {
      question_id: q.id,
      user_id: user?.id ?? null,
      anonymous_key: user ? null : anonymous_key ?? null,
      side,
      body: text,
    };

    const inserted = await Answers.createAnswer(data as any);
    res.locals.createdAnswerId = inserted.insertId;

    next();
    return;
  } catch (e) {
    console.error('[createAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};
