import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { queryRows, queryInsertion } from '@/config/db';
import { insertRow } from '@/helpers';

export interface AnswerRow extends RowDataPacket {
  id: number;
  question_id: number;
  user_id: number | null;
  side: 'A' | 'B';
  body: string;
  likes_count: number;
  created_at: string;
}

export type AnswerUiRow = AnswerRow & { likedByMe: 0 | 1 };

export const createAnswer = (data: Omit<AnswerRow, 'id' | 'likes_count' | 'created_at'>) =>
  insertRow('answers', data);

export const getAnswersByQuestion = (questionId: number) =>
  queryRows<AnswerRow>('SELECT * FROM answers WHERE question_id = ?', [questionId]);

export const getTopAnswersBySide = (questionId: number, side: 'A' | 'B', limit = 10) =>
  queryRows<AnswerRow>(
    `SELECT * FROM answers WHERE question_id = ? AND side = ? 
     ORDER BY likes_count DESC, id ASC LIMIT ?`,
    [questionId, side, limit]
  );

export const likeAnswer = (answerId: number, userId: number) =>
  queryInsertion<ResultSetHeader>(
    `INSERT IGNORE INTO answer_likes (answer_id, user_id) VALUES (?, ?)`,
    [answerId, userId]
  );

export const unlikeAnswer = (answerId: number, userId: number) =>
  queryInsertion<ResultSetHeader>(`DELETE FROM answer_likes WHERE answer_id = ? AND user_id = ?`, [
    answerId,
    userId,
  ]);

export const getUserLikesForQuestion = (questionId: number, userId: number) =>
  queryRows<RowDataPacket>(
    `SELECT al.* 
     FROM answer_likes al
     JOIN answers a ON a.id = al.answer_id
     WHERE a.question_id = ? AND al.user_id = ?`,
    [questionId, userId]
  );

export const listByQuestion = async (
  qid: number,
  userId: number | null,
  side?: 'A' | 'B',
  sort: 'likes_desc' | 'likes_asc' | 'new' | 'old' = 'new',
  limit = 20,
  offset = 0
): Promise<AnswerUiRow[]> => {
  const where = ['a.question_id = ?'];
  const params: any[] = [qid];

  if (side) {
    where.push('a.side = ?');
    params.push(side);
  }

  const order =
    sort === 'likes_desc'
      ? 'a.likes_count DESC, a.id DESC'
      : sort === 'likes_asc'
      ? 'a.likes_count ASC, a.id ASC'
      : sort === 'old'
      ? 'a.created_at ASC, a.id ASC'
      : 'a.created_at DESC, a.id DESC';

  const join =
    userId != null
      ? 'LEFT JOIN answer_likes al ON al.answer_id = a.id AND al.user_id = ?'
      : 'LEFT JOIN answer_likes al ON 1=0';

  if (userId != null) params.unshift(userId);

  params.push(limit, offset);

  return queryRows<AnswerUiRow>(
    `
    SELECT
      a.id, a.question_id, a.user_id, a.side, a.body, a.likes_count, a.created_at,
      CASE WHEN al.id IS NULL THEN 0 ELSE 1 END AS likedByMe
    FROM answers a
    ${join}
    WHERE ${where.join(' AND ')}
    ORDER BY ${order}
    LIMIT ? OFFSET ?
    `,
    params
  );
};

export const getMyAnswer = (questionId: number, userId: number) =>
  queryRows<AnswerRow>(
    `SELECT *
     FROM answers
     WHERE question_id = ?
       AND user_id = ?
     LIMIT 1`,
    [questionId, userId]
  );

export default {
  createAnswer,
  getAnswersByQuestion,
  getTopAnswersBySide,
  likeAnswer,
  unlikeAnswer,
  getUserLikesForQuestion,
  listByQuestion,
  getMyAnswer,
};
