import { Request, Response, NextFunction } from 'express';
import { param, validationResult } from 'express-validator';
import Answers from '@/models/answers';
import { queryRows } from '@/config/db';

export const validateAnswerIdParam = [
  param('answerId').exists().isInt({ min: 1 }).toInt(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: 'Invalid answer id' });
      return;
    }
    next();
    return;
  },
];

export const preventSelfLike = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = res.locals.user as { id: number };
    const answerId = Number(req.params.answerId);

    const rows = await queryRows<{ user_id: number } & any>(
      'SELECT user_id FROM answers WHERE id = ?',
      [answerId]
    );

    if (!rows.length) {
      res.status(404).json({ message: 'Answer not found' });
      return;
    }
    if (rows[0].user_id && rows[0].user_id === user.id) {
      res.status(403).json({ message: 'You cannot like your own answer' });
      return;
    }

    next();
    return;
  } catch (e) {
    console.error('[preventSelfLike]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

export const likeAnswerMw = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = res.locals.user as { id: number };
    const answerId = Number(req.params.answerId);

    await Answers.likeAnswer(answerId, user.id);

    next();
    return;
  } catch (e) {
    console.error('[likeAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

export const unlikeAnswerMw = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = res.locals.user as { id: number };
    const answerId = Number(req.params.answerId);

    await Answers.unlikeAnswer(answerId, user.id);

    next();
    return;
  } catch (e) {
    console.error('[unlikeAnswerMw]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};
