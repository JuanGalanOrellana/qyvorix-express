import { ResultSetHeader } from 'mysql2';
import { queryInsertion } from '@/config/db';

const VALID_COLUMNS: Record<string, string[]> = {
  users: [
    'id',
    'first_name',
    'last_name',
    'email',
    'user_password',
    'phone',
    'email_verified',
    'register_time',
  ],
  user_security: ['id', 'user_id', 'secret_2fa', 'attempts', 'register_time'],
  roles: ['id', 'name'],
  user_roles: ['user_id', 'role_id'],
  password_resets: ['id', 'user_id', 'token_hash', 'expires_at', 'used', 'created_at'],
  email_verifications: ['id', 'user_id', 'token_hash', 'expires_at', 'used', 'created_at'],
  questions: ['id', 'text', 'option_a', 'option_b', 'published_date', 'status', 'created_at'],
  answers: [
    'id',
    'question_id',
    'user_id',
    'side',
    'body',
    'likes_count',
    'created_at',
  ],
  answer_likes: ['id', 'answer_id', 'user_id', 'created_at'],
  participations: ['id', 'user_id', 'question_id', 'created_at'],
  user_stats: [
    'user_id',
    'total_xp',
    'influence_total',
    'power_majority_hits',
    'power_participations',
    'streak_days',
    'last_participation_date',
    'weekly_grace_tokens',
    'updated_at',
  ],
  daily_user_influence: [
    'id',
    'question_id',
    'user_id',
    'likes_sum',
    'rank_position',
    'created_at',
  ],
};

const VALID_TABLES = new Set(Object.keys(VALID_COLUMNS));

function escapeId(id: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(id)) throw new Error('Invalid identifier');
  return `\`${id}\``;
}

export async function updateRow<T extends object>(
  table: string,
  data: Partial<T> | Partial<T>[],
  where: string,
  params: unknown[]
): Promise<ResultSetHeader> {
  if (!VALID_TABLES.has(table)) throw new Error('Invalid table');

  if (Array.isArray(data)) {
    if (
      data.length !== 1 ||
      typeof data[0] !== 'object' ||
      data[0] === null ||
      Array.isArray(data[0])
    ) {
      throw new Error('Data must be an object or an array containing exactly one object.');
    }
    data = data[0];
  }

  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) throw new Error('No fields provided to update.');

  const allowed = VALID_COLUMNS[table];
  const fieldsParts: string[] = [];
  const values: any[] = [];

  for (const [key, value] of entries) {
    if (!allowed.includes(key)) throw new Error(`Invalid column for ${table}: ${key}`);
    fieldsParts.push(`${escapeId(key)} = ?`);
    values.push(value);
  }

  const fields = fieldsParts.join(', ');
  const sql = `UPDATE ${escapeId(table)} SET ${fields} WHERE ${where}`;
  return await queryInsertion<ResultSetHeader>(sql, values.concat(params));
}

export async function insertRow<T extends object>(
  table: string,
  data: T
): Promise<ResultSetHeader> {
  if (!VALID_TABLES.has(table)) throw new Error('Invalid table');

  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) throw new Error('No fields provided to insert.');

  const allowed = VALID_COLUMNS[table];
  const fields: string[] = [];
  const placeholders: string[] = [];
  const values: any[] = [];

  for (const [key, value] of entries) {
    if (!allowed.includes(key)) throw new Error(`Invalid column for ${table}: ${key}`);
    fields.push(escapeId(key));
    placeholders.push('?');
    values.push(value);
  }

  const sql = `INSERT INTO ${escapeId(table)} (${fields.join(',')}) VALUES (${placeholders.join(
    ','
  )})`;
  return await queryInsertion<ResultSetHeader>(sql, values);
}

export async function insertAllRows<T extends object>(
  table: string,
  data: T[]
): Promise<ResultSetHeader> {
  if (!VALID_TABLES.has(table)) throw new Error('Invalid table');
  if (!Array.isArray(data) || data.length === 0) throw new Error('No rows provided to insert.');

  // validate that every row has the same set of keys
  const keys = Object.keys(data[0]).filter((k) => (data[0] as any)[k] !== undefined);
  if (keys.length === 0) throw new Error('No fields provided to insert.');

  const allowed = VALID_COLUMNS[table];
  for (const k of keys)
    if (!allowed.includes(k)) throw new Error(`Invalid column for ${table}: ${k}`);

  const fieldsEsc = keys.map((k) => escapeId(k)).join(',');
  const placeholdersGroup = `(${keys.map(() => '?').join(',')})`;
  const allPlaceholders = data.map(() => placeholdersGroup).join(',');

  const values = data.flatMap((row) => keys.map((k) => (row as any)[k]));
  const sql = `INSERT INTO ${escapeId(table)} (${fieldsEsc}) VALUES ${allPlaceholders}`;
  return await queryInsertion<ResultSetHeader>(sql, values);
}
