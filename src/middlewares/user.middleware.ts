import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import User, { UserLogin } from '@/models/user';
import UserSecurity, { UserSecurityAttempts } from '@/models/user-security';
import { checkErrors } from './common.middleware';
import { hasJwtSecret, validateCookieToken, verifyToken } from './jwt.middleware';

export const emailValid = async (req: Request, _res: Response, next: NextFunction) => {
  const email = body('email')
    .exists()
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Enter a valid email address')
    .normalizeEmail()
    .trim();

  await email.run(req);
  next();
};

const credentialValid = async (req: Request, _res: Response, next: NextFunction) => {
  const credential = body('credential')
    .exists()
    .withMessage('Credential is required')
    .bail()
    .isString()
    .withMessage('Credential must be a string')
    .trim();
  await credential.run(req);
  next();
};

const passwordValid = async (req: Request, _res: Response, next: NextFunction) => {
  const password = body('user_password')
    .exists()
    .withMessage('Password is required')
    .bail()
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    })
    .withMessage(
      'Password must be at least 8 characters long, contain a lowercase letter, an uppercase letter, and a number'
    );

  await password.run(req);
  next();
};

export const currentPasswordValid = async (req: Request, _res: Response, next: NextFunction) => {
  const currentPassword = body('user_password')
    .exists()
    .withMessage('Current password is required')
    .bail()
    .isString()
    .withMessage('Current password must be a string');

  await currentPassword.run(req);
  next();
};

const validSensitiveData = async (req: Request, _res: Response, next: NextFunction) => {
  const sensitiveData = [
    body('first_name')
      .optional()
      .isString()
      .bail()
      .withMessage('First name must be a string')
      .isLength({ min: 2 })
      .withMessage('First name must be at least 2 characters long'),
    body('last_name')
      .optional()
      .isString()
      .bail()
      .withMessage('Last name must be a string')
      .isLength({ min: 2 })
      .withMessage('Last name must be at least 2 characters long'),
    body('address')
      .optional()
      .isString()
      .bail()
      .withMessage('Address must be a string')
      .isLength({ min: 5 })
      .withMessage('Address must be at least 5 characters long'),
    body('phone')
      .optional()
      .isString()
      .bail()
      .withMessage('Phone number must be a string')
      .isLength({ min: 9 })
      .withMessage('Phone number must be at least 9 characters long'),
  ];

  for (const validation of sensitiveData) {
    await validation.run(req);
  }

  next();
};

export const loadUserByEmail = async (req: Request, res: Response, next: NextFunction) => {
  const { email }: { email: string } = req.body;

  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  try {
    const queryResult = await User.getByEmail(email);

    if (queryResult.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.locals.user = queryResult[0];
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const requireEmailVerified = (_req: Request, res: Response, next: NextFunction) => {
  const v = res.locals?.user?.email_verified;

  const isVerified = v === true || v === 1 || v === '1';

  if (!isVerified) {
    res.status(403).json({ message: 'Email not verified' });
    return;
  }

  next();
};

export const isPasswordCorrect = async (req: Request, res: Response, next: NextFunction) => {
  const user = res.locals.user as { user_password: string };
  const { user_password }: UserLogin = req.body;
  const userSecurity = res.locals?.userSecurity;

  try {
    if (userSecurity && userSecurity.attempts <= 0) {
      res.status(401).json({ message: 'UserSecurity locked' });
      return;
    }

    const passwordMatch = await bcrypt.compare(user_password, user.user_password);

    if (!passwordMatch) {
      if (userSecurity) {
        const remaining = Math.max(0, userSecurity.attempts - 1);
        const userSecurityAttempts: UserSecurityAttempts = {
          id: userSecurity.id,
          attempts: remaining,
        };
        await UserSecurity.updateAttemptsLeft(userSecurityAttempts);

        res.locals = {};

        if (remaining <= 0) {
          res.status(401).json({ message: 'UserSecurity locked' });
          return;
        }

        res.status(401).json({
          message: `Incorrect password, you have ${remaining} attempts left`,
        });
        return;
      }

      res.status(401).json({ message: 'Incorrect password' });
      return;
    }

    if (userSecurity && userSecurity.attempts < 5) {
      await UserSecurity.updateAttemptsLeft({ id: userSecurity.id, attempts: 5 });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const resetTokenValid = async (req: Request, _res: Response, next: NextFunction) => {
  const token = body('token')
    .exists()
    .withMessage('Token is required')
    .bail()
    .isString()
    .withMessage('Token must be a string')
    .trim();

  await token.run(req);
  next();
};

export const codeValid = async (req: Request, _res: Response, next: NextFunction) => {
  const code = body('code')
    .exists()
    .withMessage('code is required')
    .bail()
    .isString()
    .withMessage('code must be a string')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('code must be 6 digits');

  await code.run(req);
  next();
};

export const validateUser = [hasJwtSecret, validateCookieToken('token', 'token'), verifyToken];

export const validateRegister = [emailValid, passwordValid, checkErrors];

export const validateLogin = [
  emailValid,
  currentPasswordValid,
  checkErrors,
  loadUserByEmail,
  requireEmailVerified,
  isPasswordCorrect,
];

export const validateGoogleLogin = [credentialValid, checkErrors];

export const validateUpdate = [...validateUser, validSensitiveData, checkErrors];

export const validateForgotPasswordEmail = [emailValid, checkErrors, loadUserByEmail];

export const validateResetPasswordFromBody = [resetTokenValid, passwordValid, checkErrors];

export const validateResendVerificationEmail = [emailValid, checkErrors];

export const validateVerifyEmailCode = [emailValid, codeValid, checkErrors];
