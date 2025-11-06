import UserSecurity, { UserSecurityAttempts, UserSecurity as UserSecurityInterface } from '@/models/user-security';
import { Request, Response, NextFunction } from 'express';
import { checkErrors } from './common.middleware';
import { body } from 'express-validator';
import { hasJwtSecret, validateCookieToken, verifyToken } from './jwt.middleware';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import {
  emailValid,
  currentPasswordValid,
  loadUserByEmail,
  isPasswordCorrect,
} from './user.middleware';

export const tokenValid2FA = async (req: Request, _res: Response, next: NextFunction) => {
  const twoFAToken = body('token')
    .exists()
    .withMessage('Token in body is required')
    .bail()
    .isLength({ min: 6, max: 6 })
    .withMessage('Token must be 6 digits')
    .bail()
    .isNumeric()
    .withMessage('Token must be numeric')
    .trim();
  await twoFAToken.run(req);
  return next();
};

const validate2FAToken = async (req: Request, res: Response, next: NextFunction) => {
  const token: string = req.body.token;
  const userSecurity: UserSecurityInterface = res.locals.userSecurity;

  if (!userSecurity.secret_2fa) {
    res.status(400).json({ message: 'UserSecurity does not have 2FA enabled' });
    return;
  }

  authenticator.options = {
    step: 30,
    window: [1, 1],
  };

  const secret = userSecurity.secret_2fa.trim();

  const isValid = authenticator.check(token, secret);

  if (!isValid) {
    const remaining = Math.max(0, userSecurity.attempts - 1);

    const userSecurityAttempts: UserSecurityAttempts = {
      id: userSecurity.id,
      attempts: remaining,
    };

    await UserSecurity.updateAttemptsLeft(userSecurityAttempts);

    res.status(401).json({ message: `Invalid 2FA token, attempts left: ${remaining}` });
    return;
  }
  next();
};

const getUserSecurityByUserId = async (_req: Request, res: Response, next: NextFunction) => {
  const user = res.locals.id;

  try {
    const queryResult = await UserSecurity.getByUserId(user);

    if (queryResult.length === 0) {
      res.status(403).json({ message: 'Not an userSecurity' });
      return;
    }

    res.locals = {
      ...res.locals,
      userSecurity: queryResult[0],
    };

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

const check2FA = async (req: Request, res: Response, next: NextFunction) => {
  const userSecurity: UserSecurityInterface = res.locals.userSecurity;
  const token: string = req.body.token;

  if (!userSecurity.secret_2fa) {
    const secret2fa = authenticator.generateSecret();
    await UserSecurity.insert2faUserSecurity({
      id: userSecurity.id,
      secret_2fa: secret2fa,
    });

    const otpauth = authenticator.keyuri('', 'DebatiX: UserSecurity', secret2fa);

    let qrCodeUrl: string;
    try {
      qrCodeUrl = await qrcode.toDataURL(otpauth);
    } catch (error) {
      console.error('Error generating QR code:', error);
      res.status(500).json({ message: 'Error generating QR code' });
      return;
    }
    res.status(201).json({
      requires2FA: true,
      message: 'UserSecurity registered with 2FA successfully',
      QRCode: qrCodeUrl,
    });
    return;
  }

  if (!token) {
    res.status(200).json({
      requires2FA: true,
      message: 'UserSecurity logged in, please provide the 2FA token',
    });
    return;
  }

  next();
};

export const validateUserSecurity = [
  hasJwtSecret,
  validateCookieToken('token', 'token'),
  verifyToken,
  getUserSecurityByUserId,
];

export const validateUserSecurityLogin = [
  emailValid,
  currentPasswordValid,
  checkErrors,
  loadUserByEmail,
  getUserSecurityByUserId,
  isPasswordCorrect,
  check2FA,
];

export const validateLogin2FA = [tokenValid2FA, checkErrors, validate2FAToken];
