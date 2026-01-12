import { RequestHandler } from 'express';
import { RowDataPacket } from 'mysql2';
import Answers, { AnswerUiRow, LikedAnswerRow } from '@/models/answers';
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

type MyAnswersRow = {
  answer_id: number;
  side: 'A' | 'B';
  body: string;
  likes_count: number;
  created_at: string;
  likedByMe: 0 | 1;
  question_id: number;
  text: string;
  option_a: string;
  option_b: string;
  published_date: string;
  status: 'scheduled' | 'active' | 'closed' | 'archived';
};

type PublicUserProfileRow = RowDataPacket & {
  id: number;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number | null;
  influence_total: number | null;
  power_participations: number | null;
  power_pct: number | null;
  streak_days: number | null;
};

function toBool(v: unknown) {
  return v === 1 || v === true || v === '1';
}

function mapAnswerRow(r: AnswerUiRow) {
  return {
    id: r.id,
    question_id: r.question_id,
    user_id: r.user_id,
    side: r.side,
    body: r.body,
    likes_count: Number(r.likes_count ?? 0),
    created_at: r.created_at,
    likedByMe: toBool(r.likedByMe),
    user:
      r.author_id != null
        ? {
            id: r.author_id,
            display_name: r.author_display_name,
            first_name: r.author_first_name,
            last_name: r.author_last_name,
            avatar_url: r.author_avatar_url,
          }
        : null,
  };
}

function mapLikedRow(r: LikedAnswerRow) {
  return {
    question: {
      id: r.question_id,
      text: r.text,
      option_a: r.option_a,
      option_b: r.option_b,
      published_date: r.published_date,
      status: r.status,
    },
    answer: {
      id: r.answer_id,
      question_id: r.question_id,
      user_id: r.author_id,
      side: r.side,
      body: r.body,
      likes_count: Number(r.likes_count ?? 0),
      created_at: r.created_at,
      likedByMe: true,
      user:
        r.author_id != null
          ? {
              id: r.author_id,
              display_name: r.author_display_name,
              first_name: r.author_first_name,
              last_name: r.author_last_name,
              avatar_url: r.author_avatar_url,
            }
          : null,
    },
  };
}

const getActiveQuestion: RequestHandler = async (_req, res): Promise<void> => {
  try {
    const q = res.locals.question;
    if (!q) {
      res.status(404).json({ message: 'No active question' });
      return;
    }
    res.status(200).json({ data: q });
  } catch (e) {
    console.error('[getActiveQuestion]', e);
    res.status(500).json({ message: 'Internal Server Error' });
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
  } catch (e) {
    console.error('[likeAnswer]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const unlikeAnswer: RequestHandler = async (_req, res): Promise<void> => {
  try {
    res.status(200).json({ message: 'Unliked' });
  } catch (e) {
    console.error('[unlikeAnswer]', e);
    res.status(500).json({ message: 'Internal Server Error' });
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
  } catch (e) {
    console.error('[getTopAnswers]', e);
    res.status(500).json({ message: 'Internal Server Error' });
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
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    const userId = (res.locals?.user?.id as number | undefined) ?? null;

    const rows = await Answers.listByQuestion(qid, userId, side, sort, limit, offset);
    const data = rows.map(mapAnswerRow);

    res.status(200).json({ question_id: qid, count: data.length, data });
  } catch (e) {
    console.error('[listAnswers]', e);
    res.status(500).json({ message: 'Internal Server Error' });
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
  } catch (e) {
    console.error('[getResults]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getMyAnswer: RequestHandler = async (req, res): Promise<void> => {
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

const getMyAnswers: RequestHandler = async (req, res): Promise<void> => {
  try {
    const user = res.locals.user as { id: number } | undefined;
    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    const rows = await Answers.listMine(user.id, limit, offset);

    const answerIds = rows.map((r) => r.answer_id);
    const likedSet =
      answerIds.length > 0
        ? new Set<number>(
            (
              await queryRows<RowDataPacket & { answer_id: number }>(
                `SELECT answer_id
                 FROM answer_likes
                 WHERE user_id = ?
                   AND answer_id IN (${answerIds.map(() => '?').join(',')})`,
                [user.id, ...answerIds]
              )
            ).map((x) => Number(x.answer_id))
          )
        : new Set<number>();

    const data = (rows as unknown as MyAnswersRow[]).map((r) => ({
      question: {
        id: r.question_id,
        text: r.text,
        option_a: r.option_a,
        option_b: r.option_b,
        published_date: r.published_date,
        status: r.status,
      },
      answer: {
        id: r.answer_id,
        question_id: r.question_id,
        user_id: user.id,
        side: r.side,
        body: r.body,
        likes_count: r.likes_count,
        created_at: r.created_at,
        likedByMe: likedSet.has(r.answer_id) ? 1 : 0,
      },
    }));

    res.status(200).json({ count: data.length, data });
  } catch (e) {
    console.error('[getMyAnswers]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getUserProfile: RequestHandler = async (req, res): Promise<void> => {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId) || userId <= 0) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const viewerId = (res.locals?.user?.id as number | undefined) ?? null;
    const isSelf = viewerId != null && viewerId === userId;

    const rows = await queryRows<PublicUserProfileRow>(
      `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.display_name,
        u.avatar_url,
        s.total_xp,
        s.influence_total,
        s.power_participations,
        s.power_pct,
        s.streak_days
      FROM users u
      LEFT JOIN user_stats s ON s.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
      `,
      [userId]
    );

    const u = rows[0];
    if (!u) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      data: {
        id: u.id,
        display_name: u.display_name,
        first_name: isSelf ? u.first_name : null,
        last_name: isSelf ? u.last_name : null,
        avatar_url: u.avatar_url,
        stats: {
          total_xp: Number(u.total_xp ?? 0),
          influence_total: Number(u.influence_total ?? 0),
          power_participations: Number(u.power_participations ?? 0),
          power_pct: Number(u.power_pct ?? 0),
          streak_days: Number(u.streak_days ?? 0),
        },
      },
    });
  } catch (e) {
    console.error('[getUserProfile]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getUserAnswers: RequestHandler = async (req, res): Promise<void> => {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId) || userId <= 0) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    const viewerId = (res.locals?.user?.id as number | undefined) ?? null;

    const rows = await Answers.listUserDaily(userId, viewerId, limit, offset);

    const data = rows.map((r) => ({
      question: {
        id: r.question_id,
        text: r.text,
        option_a: r.option_a,
        option_b: r.option_b,
        published_date: r.published_date,
        status: r.status,
      },
      answer: {
        id: r.answer_id,
        question_id: r.question_id,
        user_id: userId,
        side: r.side,
        body: r.body,
        likes_count: r.likes_count,
        created_at: r.created_at,
        likedByMe: toBool(r.likedByMe),
      },
    }));

    res.status(200).json({ count: data.length, data });
  } catch (e) {
    console.error('[getUserAnswers]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getMyLikes: RequestHandler = async (req, res): Promise<void> => {
  try {
    const user = res.locals.user as { id: number } | undefined;
    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    const rows = await Answers.listLikedDaily(user.id, user.id, limit, offset);
    const data = rows.map(mapLikedRow);

    res.status(200).json({ count: data.length, data });
  } catch (e) {
    console.error('[getMyLikes]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const getUserLikes: RequestHandler = async (req, res): Promise<void> => {
  try {
    const targetUserId = Number(req.params.userId);
    if (Number.isNaN(targetUserId) || targetUserId <= 0) {
      res.status(400).json({ message: 'Invalid user id' });
      return;
    }

    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const offset = Math.max(0, Number(req.query.offset ?? 0));

    const viewerId = (res.locals?.user?.id as number | undefined) ?? null;

    const rows = await Answers.listLikedDaily(targetUserId, viewerId, limit, offset);
    const data = rows.map(mapLikedRow);

    res.status(200).json({ count: data.length, data });
  } catch (e) {
    console.error('[getUserLikes]', e);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getHeaderLeaderboards: RequestHandler = async (req, res) => {
  try {
    const limitAnswers = Math.min(Number(req.query.answers ?? 10), 50);
    const limitProfiles = Math.min(Number(req.query.profiles ?? 10), 50);

    const topAnswers = await queryRows(
      `
      SELECT *
      FROM v_top_answers_global
      LIMIT ?
      `,
      [limitAnswers]
    );

    const topProfiles = await queryRows(
      `
      SELECT *
      FROM v_top_profiles_by_level
      LIMIT ?
      `,
      [limitProfiles]
    );

    res.status(200).json({
      data: { topAnswers, topProfiles },
    });
  } catch (e) {
    console.error('[getHeaderLeaderboards]', e);
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
  getMyAnswers,
  getUserProfile,
  getUserAnswers,
  getMyLikes,
  getUserLikes,
  getHeaderLeaderboards,
};

export default debateController;
