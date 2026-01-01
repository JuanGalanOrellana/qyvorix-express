import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { queryInsertion, queryRows } from '@/config/db';
import { insertRow, updateRow } from '@/helpers';
import bcrypt from 'bcrypt';

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string;
  user_password: string;
  phone: string | null;
  avatar_url: string | null;
  email_verified?: boolean;
  register_time: string;
}

export type UserRegister = Omit<
  User,
  'id' | 'register_time' | 'phone' | 'avatar_url' | 'display_name'
>;

export type UserLogin = Pick<User, 'email' | 'user_password'>;

export type UserSensitiveData = Omit<
  User,
  'email' | 'user_password' | 'register_time' | 'email_verified'
>;

export type UserResponse = User & RowDataPacket;

const getByEmail = async (email: string): Promise<UserResponse[]> => {
  return await queryRows<UserResponse>('SELECT * FROM users WHERE email = ?', [email]);
};

const getById = async (id: number): Promise<UserResponse[]> => {
  return await queryRows<UserResponse>('SELECT * FROM users WHERE id = ?', [id]);
};

const isEmailTaken = async (email: string): Promise<boolean> => {
  const user = await getByEmail(email);
  return user.length > 0;
};

const createUser = async (user: UserRegister): Promise<ResultSetHeader> => {
  const bcryptSalt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(user.user_password, bcryptSalt);

  const userData: UserRegister & { email_verified?: boolean } = {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    user_password: passwordHash,
  };

  if ((user as unknown as { email_verified?: boolean }).email_verified === true) {
    userData.email_verified = true;
  }

  return await insertRow<typeof userData>('users', userData);
};

const updateUserData = async (
  id: number,
  user: Partial<UserSensitiveData>
): Promise<ResultSetHeader> => {
  return await updateRow<UserSensitiveData>('users', user, 'id = ?', [id]);
};

const verifyEmail = async (email: string): Promise<ResultSetHeader> => {
  return await queryInsertion('UPDATE users SET email_verified = true WHERE email = ?', [email]);
};

const changePassword = async (id: number, password: string): Promise<ResultSetHeader> => {
  const bcryptSalt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, bcryptSalt);
  return await queryInsertion('UPDATE users SET user_password = ? WHERE id = ?', [
    passwordHash,
    id,
  ]);
};

export default {
  getByEmail,
  getById,
  isEmailTaken,
  createUser,
  updateUserData,
  verifyEmail,
  changePassword,
};
