import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import * as Questions from '@/models/questions';

export const validateCreateQuestion = [
  body('text').exists().isString().isLength({ min: 5, max: 500 }),
  body('option_a').exists().isString().isLength({ min: 1, max: 150 }),
  body('option_b').exists().isString().isLength({ min: 1, max: 150 }),
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

export const loadActiveQuestion = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const q = await Questions.getOrActivateActive();
    if (!q.length) {
      res.status(404).json({ message: 'No active question' });
      return;
    }
    res.locals.question = q[0];
    next();
    return;
  } catch (e) {
    console.error('[loadActiveQuestion]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

export const requireActiveQuestionById = [
  param('id').exists().toInt(),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: 'Invalid question id' });
      return;
    }
    try {
      const rows = await Questions.getById(Number(req.params.id));
      if (!rows.length) {
        res.status(404).json({ message: 'Question not found' });
        return;
      }
      const q = rows[0];
      if (q.status !== 'active') {
        res.status(409).json({ message: 'Question is not active' });
        return;
      }
      res.locals.question = q;
      next();
      return;
    } catch (e) {
      console.error('[requireActiveQuestionById]', e);
      res.status(500).json({ message: 'Internal Server Error' });
      return;
    }
  },
];
