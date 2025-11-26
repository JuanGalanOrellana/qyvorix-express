import { RequestHandler } from 'express';
import Questions from '@/models/questions';

export const createQuestion: RequestHandler = async (req, res) => {
  try {
    const { text, option_a, option_b } = req.body;

    const published_date = await Questions.getNextPublishedDate();

    const r = await Questions.createQuestion({
      text,
      option_a,
      option_b,
      published_date,
    });

    res.status(201).json({
      message: 'Question created',
      id: r.insertId,
      published_date,
    });
  } catch (e) {
    console.error('[createQuestion]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
