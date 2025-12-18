import generator from 'generate-password';
import User, { UserRegister, UserSensitiveData } from '@/models/user';
import { RequestHandler } from 'express';
import { createJwt, cookieOptions } from '@/utils/jwt';
import { OAuth2Client } from 'google-auth-library';
import { assignRoleToUserByName } from '@/models/role';
import { insertRow } from '@/helpers';
import crypto from 'crypto';
import { queryRows, queryInsertion } from '@/config/db';
import * as EmailVerifications from '@/models/email-verification';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/utils/mailer';
import { hashCode, random6Digits } from '@/utils/emailCode';

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const toSqlDateLocal = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

async function issueEmailVerificationCode(userId: number) {
  const code = random6Digits();
  const tokenHash = hashCode(code);

  await EmailVerifications.invalidateAll(userId);
  await EmailVerifications.createCode(userId, tokenHash);

  return { code };
}

export const register: RequestHandler = async (req, res) => {
  const user: UserRegister = req.body;

  try {
    const existing = await User.getByEmail(user.email.trim().toLowerCase());

    if (existing.length) {
      const ev = (existing[0] as { email_verified?: unknown }).email_verified;
      const isVerified = ev === 1 || ev === true || ev === '1';

      if (isVerified) {
        res.status(409).json({ message: 'Email is already in use' });
        return;
      }

      const { code } = await issueEmailVerificationCode(existing[0].id);
      await sendVerificationEmail(user.email.trim().toLowerCase(), code);

      res.status(200).json({
        message: 'Account exists. Verification code sent.',
      });
      return;
    }

    const createdUser = await User.createUser(user);
    await assignRoleToUserByName(createdUser.insertId, 'USER');

    const { code } = await issueEmailVerificationCode(createdUser.insertId);
    await sendVerificationEmail(user.email.trim().toLowerCase(), code);

    res.status(201).json({
      message: 'User registered. Verification code sent.',
    });
  } catch (error) {
    console.error('[register]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    const userId = res.locals.user.id as number;

    const token = createJwt({ id: userId }, process.env.JWT_SECRET!, 1);
    res.cookie('token', token, cookieOptions(req));

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

    const { user_password, ...safe } = userData[0];
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

export const resendVerificationEmail: RequestHandler = async (req, res) => {
  try {
    const email = (req.body?.email as string | undefined)?.trim().toLowerCase();
    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    const q = await User.getByEmail(email);
    if (!q.length) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const userId = q[0].id;
    const ev = (q[0] as { email_verified?: unknown }).email_verified;
    const isVerified = ev === 1 || ev === true || ev === '1';

    if (isVerified) {
      res.status(200).json({ message: 'Email already verified' });
      return;
    }

    const last = await EmailVerifications.lastSentAt(userId);
    if (last.length) {
      const lastAt = new Date(last[0].created_at).getTime();
      if (Date.now() - lastAt < 60_000) {
        res.status(429).json({ message: 'Please wait before requesting another code' });
        return;
      }
    }

    const { code } = await issueEmailVerificationCode(userId);
    await sendVerificationEmail(email, code);

    res.status(200).json({
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('[resendVerificationEmail]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const verifyEmailCode: RequestHandler = async (req, res) => {
  try {
    const { email, code } = req.body as { email?: string; code?: string };

    if (!email || !code) {
      res.status(400).json({ message: 'email and code are required' });
      return;
    }

    const normEmail = email.trim().toLowerCase();
    const users = await User.getByEmail(normEmail);

    if (!users.length) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const user = users[0];
    const tokenHash = hashCode(code.trim());

    const rows = await EmailVerifications.findValidCode(user.id, tokenHash);
    if (!rows.length) {
      res.status(401).json({ message: 'Invalid or expired code' });
      return;
    }

    await EmailVerifications.markUsed(rows[0].id);
    await EmailVerifications.invalidateAll(user.id);

    await User.verifyEmail(normEmail);

    const token = createJwt({ id: user.id }, process.env.JWT_SECRET!, 1);
    res.cookie('token', token, cookieOptions(req));

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('[verifyEmailCode]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const forgotPasswordEmail: RequestHandler = async (req, res) => {
  const email = (req.body?.email as string | undefined)?.trim().toLowerCase();

  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  try {
    const q = await User.getByEmail(email);

    if (q.length === 0) {
      res.status(200).json({ message: 'If the email exists, we sent instructions' });
      return;
    }

    const token = randomToken();
    const tokenHash = hashToken(token);

    await queryInsertion('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [
      q[0].id,
    ]);

    await insertRow('password_resets', {
      user_id: q[0].id,
      token_hash: tokenHash,
      expires_at: toSqlDateLocal(new Date(Date.now() + 1000 * 60 * 60)),
      used: 0,
      created_at: toSqlDateLocal(new Date()),
    });

    const frontBase = process.env.FRONTEND_URL ?? 'http://localhost:4200';
    const resetUrl = `${frontBase}/reset-password?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail(email, resetUrl);

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('[forgotPasswordEmail]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const resetPassword: RequestHandler = async (req, res) => {
  const token = (req.body?.token as string | undefined)?.trim();
  const newPassword = req.body?.user_password;

  if (!token) {
    res.status(400).json({ message: 'Token is required' });
    return;
  }

  if (!newPassword) {
    res.status(400).json({ message: 'user_password is required' });
    return;
  }

  try {
    const tokenHash = hashToken(token);

    const rows = await queryRows(
      'SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at >= UTC_TIMESTAMP() LIMIT 1',
      [tokenHash]
    );

    if (!rows?.length) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    const userId = (rows as { user_id: number }[])[0].user_id;
    const r = await User.changePassword(userId, newPassword);

    if (r.affectedRows === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    await queryInsertion('UPDATE password_resets SET used = 1 WHERE id = ?', [
      (rows as { id: number }[])[0].id,
    ]);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('[resetPassword]', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const googleLogin: RequestHandler = async (req, res) => {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const { credential } = req.body as { credential?: string };

  if (!credential) {
    res.status(400).json({ message: 'Missing credential' });
    return;
  }

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

    const setSessionCookie = (userId: number) => {
      const token = createJwt({ id: userId }, process.env.JWT_SECRET!, 1);
      res.cookie('token', token, cookieOptions(req));
    };

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
      setSessionCookie(created.insertId);

      const [user] = await User.getById(created.insertId);
      const { user_password, ...safe } = user;

      res.status(201).json({ message: 'User created and logged in successfully', data: safe });
      return;
    }

    await assignRoleToUserByName(q[0].id, 'USER');
    const ev = (q[0] as { email_verified?: unknown }).email_verified;
    const isVerified = ev === 1 || ev === true || ev === '1';

    if (!isVerified) {
      await User.verifyEmail(q[0].email);
    }

    setSessionCookie(q[0].id);

    const [user] = await User.getById(q[0].id);
    const { user_password, ...safe } = user;

    res.status(200).json({ message: 'User logged in successfully', data: safe });
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
  resendVerificationEmail,
  verifyEmailCode,
  forgotPasswordEmail,
  resetPassword,
  googleLogin,
};

export default userController;
