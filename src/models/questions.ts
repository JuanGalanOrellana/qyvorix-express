import { RowDataPacket } from 'mysql2';
import { queryRows, queryInsertion } from '@/config/db';
import { insertRow, updateRow } from '@/helpers';
import { getTomorrowDateIso } from '@/utils/date';

export interface QuestionRow extends RowDataPacket {
  id: number;
  text: string;
  option_a: string;
  option_b: string;
  published_date: string;
  status: 'scheduled' | 'active' | 'closed';
  created_at: string | Date;
}

interface LastDateRow extends RowDataPacket {
  last: string | null;
}

export const createQuestion = (
  data: Omit<QuestionRow, 'id' | 'status' | 'created_at'> & {
    status?: QuestionRow['status'];
  }
) => insertRow('questions', { status: 'scheduled', ...data });

export const activateQuestion = (id: number) =>
  updateRow('questions', { status: 'active' }, 'id = ?', [id]);

export const closeQuestion = (id: number) =>
  updateRow('questions', { status: 'closed' }, 'id = ?', [id]);

export const getActiveQuestion = () =>
  queryRows<QuestionRow>(`
    SELECT *
    FROM questions
    WHERE status = 'active'
    ORDER BY published_date DESC, id DESC
    LIMIT 1
  `);

export const getById = (id: number) =>
  queryRows<QuestionRow>('SELECT * FROM questions WHERE id = ?', [id]);

export async function getNextPublishedDate(): Promise<string> {
  const tomorrow = getTomorrowDateIso();

  const [row] = await queryRows<RowDataPacket & { next: string | null }>(
    `
    SELECT IFNULL(
      DATE_FORMAT(DATE_ADD(MAX(published_date), INTERVAL 1 DAY), '%Y-%m-%d'),
      ?
    ) AS next
    FROM questions
    WHERE published_date >= ?
    `,
    [tomorrow, tomorrow]
  );

  // Si no hay ninguna futura, usamos "mañana"
  return row?.next ?? tomorrow;
}

async function getNextDueQuestion(): Promise<QuestionRow | null> {
  const rows = await queryRows<QuestionRow>(`
    SELECT *
    FROM questions
    WHERE status = 'scheduled'
      AND published_date <= CURRENT_DATE()
    ORDER BY published_date ASC, id ASC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export const activateNextDue = async (): Promise<void> => {
  await queryInsertion(`UPDATE questions SET status = 'closed' WHERE status = 'active'`);

  const next = await getNextDueQuestion();
  if (!next) return;

  await updateRow('questions', { status: 'active' }, 'id = ?', [next.id]);
};

export const getOrActivateActive = async (): Promise<QuestionRow[]> => {
  const current = await getActiveQuestion();
  if (current.length) return current;

  await activateNextDue();
  return getActiveQuestion();
};

export default {
  createQuestion,
  activateQuestion,
  closeQuestion,
  getActiveQuestion,
  getById,
  getNextPublishedDate,
  activateNextDue,
  getOrActivateActive,
};
