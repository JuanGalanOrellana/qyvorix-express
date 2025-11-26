import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { queryRows, queryInsertion } from '@/config/db';
import { insertRow } from '@/helpers';

export interface BadgeRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string;
  rarity: 'common'|'rare'|'epic'|'legendary';
}

export const getBadgeByCode = (code: string) =>
  queryRows<BadgeRow>('SELECT * FROM badges WHERE code = ?', [code]);

export const upsertBadge = async (b: Omit<BadgeRow,'id'>) => {
  const [row] = await getBadgeByCode(b.code);
  if (row) return row.id;
  const r = await insertRow('badges', b);
  return r.insertId;
};

export const grantBadge = (userId: number, badgeId: number) =>
  queryInsertion<ResultSetHeader>(
    `INSERT INTO user_badges (user_id, badge_id, meta_json) VALUES (?, ?, JSON_OBJECT())`,
    [userId, badgeId]
  );

export default { getBadgeByCode, upsertBadge, grantBadge };
