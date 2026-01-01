import { Request, Response, NextFunction } from 'express';
import { cookie, validationResult } from 'express-validator';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User from '@/models/user';

export const hasJwtSecret = (_req: Request, res: Response, next: NextFunction) => {
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }

  next();
};

export const validateCookieToken =
  (cookieName: string, localKey: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokenValid = cookie(cookieName).exists().isJWT();

      await tokenValid.run(req);

      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        res.status(401).json({ message: 'Not Authorized' });
        return;
      }

      res.locals[localKey] = req.cookies[cookieName];

      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
      return;
    }
  };

export const verifyToken = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const decoded = jwt.verify(res.locals.token as string, process.env.JWT_SECRET!) as JwtPayload;

    const queryResult = await User.getById(decoded.id);

    if (queryResult.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.locals = {
      ...res.locals,
      user: queryResult[0],
    };
    next();
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: 'Not Authorized' });
    return;
  }
};

export const tryValidateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req as any).cookies?.token;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    const rows = await User.getById(decoded.id);
    if (!rows.length) {
      return next();
    }

    res.locals.user = rows[0];
    return next();
  } catch (_e) {
    return next();
  }
};
