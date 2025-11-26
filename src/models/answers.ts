import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { queryRows, queryInsertion } from '@/config/db';
import { insertRow } from '@/helpers';

export interface AnswerRow extends RowDataPacket {
  id: number;
  question_id: number;
  user_id: number | null;
  anonymous_key: string | null;
  side: 'A' | 'B';
  body: string;
  likes_count: number;
  created_at: string;
}

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
  side?: 'A' | 'B',
  sort: 'likes_desc' | 'likes_asc' | 'new' | 'old' = 'new',
  limit = 20,
  offset = 0
): Promise<AnswerRow[]> => {
  const where = ['question_id = ?'];
  const params: any[] = [qid];
  if (side) {
    where.push('side = ?');
    params.push(side);
  }

  let order =
    sort === 'likes_desc'
      ? 'likes_count DESC, id DESC'
      : sort === 'likes_asc'
      ? 'likes_count ASC, id ASC'
      : sort === 'old'
      ? 'created_at ASC, id ASC'
      : 'created_at DESC, id DESC';

  params.push(limit, offset);
  return queryRows<AnswerRow>(
    `SELECT id, question_id, user_id, anonymous_key, side, body, likes_count, created_at
     FROM answers
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    params
  );
};

export default {
  createAnswer,
  getAnswersByQuestion,
  getTopAnswersBySide,
  likeAnswer,
  unlikeAnswer,
  getUserLikesForQuestion,
  listByQuestion,
};
