import { RequestHandler } from 'express';
import { RowDataPacket } from 'mysql2';
import * as Questions from '@/models/questions';
import Answers from '@/models/answers';
import { queryRows } from '@/config/db';

interface QuestionHeadRow extends RowDataPacket {
  status: string;
  text: string;
  option_a: string;
  option_b: string;
}
interface SideCountRow extends RowDataPacket {
  side: 'A' | 'B';
  total: number;
}

const getActiveQuestion: RequestHandler = async (_req, res): Promise<void> => {
  try {
    const rows = await Questions.getActiveQuestion();
    if (!rows.length) {
      res.status(404).json({ message: 'No active question' });
      return;
    }
    res.status(200).json({ data: rows[0] });
    return;
  } catch (e) {
    console.error('[getActiveQuestion]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

const answer: RequestHandler = async (_req, res): Promise<void> => {
  try {
    const id = res.locals.createdAnswerId as number | undefined;
    if (!id) {
      res.status(400).json({ message: 'Answer not created' });
      return;
    }
    res.status(201).json({ message: 'Answer created', id });
  } catch (e) {
    console.error('[answer]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const likeAnswer: RequestHandler = async (_req, res): Promise<void> => {
  try {
    const created = Boolean(res.locals.liked);
    res.status(created ? 201 : 200).json({ message: created ? 'Liked' : 'Already liked' });
    return;
  } catch (e) {
    console.error('[likeAnswer]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

const unlikeAnswer: RequestHandler = async (_req, res): Promise<void> => {
  try {
    res.status(200).json({ message: 'Unliked' });
    return;
  } catch (e) {
    console.error('[unlikeAnswer]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

const getTopAnswers: RequestHandler = async (req, res): Promise<void> => {
  try {
    const qid = Number(req.params.id);
    const side = (req.query.side as 'A' | 'B' | undefined) || undefined;
    const limit = Number(req.query.limit ?? 10);

    if (Number.isNaN(qid) || qid <= 0) {
      res.status(400).json({ message: 'Invalid question id' });
      return;
    }

    if (side === 'A' || side === 'B') {
      const rows = await Answers.getTopAnswersBySide(qid, side, limit);
      res.status(200).json({ question_id: qid, side, data: rows });
      return;
    }

    const [topA, topB] = await Promise.all([
      Answers.getTopAnswersBySide(qid, 'A', limit),
      Answers.getTopAnswersBySide(qid, 'B', limit),
    ]);

    res.status(200).json({ question_id: qid, topA, topB });
    return;
  } catch (e) {
    console.error('[getTopAnswers]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

const listAnswers: RequestHandler = async (req, res): Promise<void> => {
  try {
    const qid = Number(req.params.id);
    if (!qid || qid <= 0) {
      res.status(400).json({ message: 'Invalid question id' });
      return;
    }
    const side = req.query.side as 'A' | 'B' | undefined;
    const sort =
      (req.query.sort as 'likes_desc' | 'likes_asc' | 'new' | 'old' | undefined) ?? 'new';
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Number(req.query.offset ?? 0);

    const rows = await Answers.listByQuestion(qid, side, sort, limit, offset);
    res.status(200).json({ question_id: qid, count: rows.length, data: rows });
    return;
  } catch (e) {
    console.error('[listAnswers]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

const getResults: RequestHandler = async (req, res): Promise<void> => {
  try {
    const qid = Number(req.params.id);
    if (!qid || qid <= 0) {
      res.status(400).json({ message: 'Invalid question id' });
      return;
    }

    const qRows = await queryRows<QuestionHeadRow>(
      'SELECT status, text, option_a, option_b FROM questions WHERE id = ? LIMIT 1',
      [qid]
    );
    const q = qRows[0];
    if (!q) {
      res.status(404).json({ message: 'Question not found' });
      return;
    }

    const counts = await queryRows<SideCountRow>(
      `SELECT side, COUNT(*) AS total
       FROM answers
       WHERE question_id = ?
       GROUP BY side`,
      [qid]
    );

    const totalA = counts.find((c) => c.side === 'A')?.total ?? 0;
    const totalB = counts.find((c) => c.side === 'B')?.total ?? 0;
    const total = totalA + totalB;
    const pctA = total ? Math.round((totalA * 10000) / total) / 100 : 0;
    const pctB = total ? Math.round((totalB * 10000) / total) / 100 : 0;

    res.status(200).json({
      question_id: qid,
      status: q.status,
      question: { text: q.text, option_a: q.option_a, option_b: q.option_b },
      totals: { A: totalA, B: totalB, total },
      percentages: { A: pctA, B: pctB },
    });
    return;
  } catch (e) {
    console.error('[getResults]', e);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

const getMyAnswer: RequestHandler = async (req, res) => {
  try {
    const qid = Number(req.params.id);
    const user = res.locals.user as { id: number } | undefined;

    if (Number.isNaN(qid) || qid <= 0) {
      res.status(400).json({ message: 'Invalid question id' });
      return;
    }

    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const rows = await Answers.getMyAnswer(qid, user.id);
    const answer = rows[0] ?? null;

    res.status(200).json({ answered: !!answer, answer });
  } catch (e) {
    console.error('[getMyAnswer]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const debateController = {
  getActiveQuestion,
  answer,
  likeAnswer,
  unlikeAnswer,
  getTopAnswers,
  listAnswers,
  getResults,
  getMyAnswer,
};

export default debateController;
