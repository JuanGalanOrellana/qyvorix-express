import { RowDataPacket } from 'mysql2';
import { queryRows } from '@/config/db';
import { insertRow, updateRow } from '@/helpers';
import { getTomorrowDateIso } from '@/utils/date';
import { settleQuestionPower } from '@/models/power';

export interface QuestionRow extends RowDataPacket {
  id: number;
  text: string;
  option_a: string;
  option_b: string;
  published_date: string;
  status: 'scheduled' | 'active' | 'closed' | 'archived';
  created_at: string | Date;
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

  return row?.next ?? tomorrow;
}

function todayInMadridIso(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

function toIsoDate(d: unknown): string {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

async function getNextDueQuestion(): Promise<QuestionRow | null> {
  const rows = await queryRows<QuestionRow>(`
    SELECT *
    FROM questions
    WHERE status = 'scheduled'
      AND published_date <= DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', 'Europe/Madrid'))
    ORDER BY published_date ASC, id ASC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

async function closeActiveAndSettle(): Promise<void> {
  const [active] = await queryRows<QuestionRow>(`
    SELECT *
    FROM questions
    WHERE status = 'active'
    ORDER BY published_date DESC, id DESC
    LIMIT 1
  `);

  if (!active) return;

  await settleQuestionPower(active.id);

  await updateRow('questions', { status: 'closed' }, 'id = ? AND status = "active"', [active.id]);
}

export const activateNextDue = async (): Promise<void> => {
  await closeActiveAndSettle();

  const next = await getNextDueQuestion();
  if (!next) return;

  await updateRow('questions', { status: 'active' }, 'id = ?', [next.id]);
};

export const getOrActivateActive = async (): Promise<QuestionRow[]> => {
  const today = todayInMadridIso();

  const current = await getActiveQuestion();
  if (current.length) {
    const active = current[0];
    const published = toIsoDate(active.published_date);

    if (published && published < today) {
      await activateNextDue();
      return getActiveQuestion();
    }

    return current;
  }

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
