import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { queryRows, queryInsertion } from '@/config/db';

export interface RoleRow extends RowDataPacket {
  id: number;
  name: string;
}

export const getRoleByName = async (name: string): Promise<RoleRow | null> => {
  const rows = await queryRows<RoleRow>('SELECT * FROM roles WHERE name = ?', [name]);
  return rows[0] ?? null;
};

export const assignRoleToUserByName = async (
  userId: number,
  roleName: string
): Promise<ResultSetHeader> => {
  const role = await getRoleByName(roleName);
  if (!role) throw new Error(`Role not found: ${roleName}`);
  return queryInsertion<ResultSetHeader>(
    'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
    [userId, role.id]
  );
};

export const getRolesByUserId = async (userId: number): Promise<RoleRow[]> => {
  return queryRows<RoleRow>(
    `SELECT r.id, r.name
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?`,
    [userId]
  );
};
