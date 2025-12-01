import generator from 'generate-password';
import User, { UserRegister, UserSensitiveData } from '@/models/user';
import { RequestHandler } from 'express';
import { createJwt, cookieOptions } from '@/utils/jwt';
import { OAuth2Client } from 'google-auth-library';
import { assignRoleToUserByName } from '@/models/role';
import { insertRow } from '@/helpers';
import crypto from 'crypto';
import { queryRows, queryInsertion } from '@/config/db';
import { attachAnonAnswersAndParticipations } from '@/helpers/userAnswers';

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const toSqlDate = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

export const register: RequestHandler = async (req, res) => {
  const user: UserRegister = req.body;
  try {
    const createdUser = await User.createUser(user);
    await assignRoleToUserByName(createdUser.insertId, 'USER');

    const token = createJwt({ id: createdUser.insertId }, process.env.JWT_SECRET!, 1);
    res.cookie('token', token, cookieOptions(req));

    await attachAnonAnswersAndParticipations(req, createdUser.insertId);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('[register]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    const userId = res.locals.id;
    const token = createJwt({ id: userId }, process.env.JWT_SECRET!, 1);
    res.cookie('token', token, cookieOptions(req));

    await attachAnonAnswersAndParticipations(req, userId);

    res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const logout: RequestHandler = async (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.status(200).json({ message: 'Session ended successfully' });
};

export const getUserData: RequestHandler = async (_req, res) => {
  const id: number = res.locals.user.id;
  try {
    const userData = await User.getById(id);
    if (userData.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const { user_password, ...safe } = userData[0] as any;
    const roles = res.locals.roles ?? [];
    res.status(200).json({
      message: 'User data obtained successfully',
      data: { ...safe, roles },
    });
  } catch (error) {
    console.error('[getUserData]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateUserData: RequestHandler = async (req, res) => {
  const id = res.locals.user.id;
  const user: Partial<UserSensitiveData> = req.body;
  try {
    const r = await User.updateUserData(id, user);
    if (!r || r.affectedRows === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json({ message: 'User data updated successfully' });
  } catch (error) {
    console.error('[updateUserData]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const sendVerificationEmail: RequestHandler = async (_req, res) => {
  try {
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('[sendVerificationEmail]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const emailVerification: RequestHandler = async (_req, res) => {
  const id: number = res.locals.id;
  try {
    const row = await User.getById(id);
    if (row.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const result = await User.verifyEmail(row[0].email);
    if (result.affectedRows === 0) {
      res.status(404).json({ message: 'Email not found' });
      return;
    }
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('[emailVerification]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const forgotPasswordEmail: RequestHandler = async (req, res) => {
  const email = req.body.email;
  try {
    const q = await User.getByEmail(email);
    if (q.length === 0) {
      res.status(404).json({ message: 'Email not found' });
      return;
    }
    const token = randomToken();
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = toSqlDate(new Date(now.getTime() + 1000 * 60 * 60));
    await insertRow('password_resets', {
      user_id: q[0].id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used: 0,
      created_at: toSqlDate(now),
    });
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('[forgotPasswordEmail]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const resetPassword: RequestHandler = async (req, res) => {
  const token = req.body.token as string | undefined;
  const newPassword = req.body.user_password;
  if (!token) {
    res.status(400).json({ message: 'Token is required' });
    return;
  }
  try {
    const tokenHash = hashToken(token);
    const rows = await queryRows(
      'SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at >= NOW() LIMIT 1',
      [tokenHash]
    );
    if (!rows || rows.length === 0) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
    const userId = (rows as any)[0].user_id;
    const r = await User.changePassword(userId, newPassword);
    if (r.affectedRows === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    await queryInsertion('UPDATE password_resets SET used = 1 WHERE id = ?', [(rows as any)[0].id]);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('[resetPassword]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const googleLogin: RequestHandler = async (req, res) => {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const { credential } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(401).json({ message: 'Invalid Google token' });
      return;
    }
    if (payload.email_verified === false) {
      res.status(403).json({ message: 'Google account not verified' });
      return;
    }

    const q = await User.getByEmail(payload.email);

    if (q.length === 0) {
      const created = await User.createUser({
        first_name: payload.given_name || 'NoName',
        last_name: payload.family_name || 'NoLastName',
        email: payload.email,
        user_password: generator.generate({
          length: 12,
          numbers: true,
          symbols: true,
          uppercase: true,
          lowercase: true,
        }),
        email_verified: true,
      });
      await assignRoleToUserByName(created.insertId, 'USER');

      const token = createJwt({ id: created.insertId }, process.env.JWT_SECRET!, 1);
      res.cookie('token', token, cookieOptions(req));

      await attachAnonAnswersAndParticipations(req, created.insertId);

      const [user] = await User.getById(created.insertId);
      const { user_password, ...safe } = user as any;
      res.status(201).json({ message: 'User created and logged in successfully', data: safe });
      return;
    } else {
      await assignRoleToUserByName(q[0].id, 'USER');
      if (q[0].email_verified === false) {
        await User.verifyEmail(q[0].email);
      }
      const token = createJwt({ id: q[0].id }, process.env.JWT_SECRET!, 1);
      res.cookie('token', token, cookieOptions(req));

      await attachAnonAnswersAndParticipations(req, q[0].id);

      const [user] = await User.getById(q[0].id);
      const { user_password, ...safe } = user as any;
      res.status(200).json({ message: 'User logged in successfully', data: safe });
    }
  } catch (error) {
    console.error('[googleLogin]', error);
    res.status(401).json({ message: 'Invalid Google credential' });
  }
};

const userController = {
  register,
  login,
  logout,
  getUserData,
  updateUserData,
  sendVerificationEmail,
  emailVerification,
  forgotPasswordEmail,
  resetPassword,
  googleLogin,
};

export default userController;
