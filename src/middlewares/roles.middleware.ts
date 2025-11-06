import { Request, Response, NextFunction } from 'express';
import { getRolesByUserId, RoleRow } from '@/models/role';

export const loadRoles = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = res.locals.user?.id ?? res.locals.userSecurity?.user_id ?? null;
    if (!userId) {
      res.status(401).json({ message: 'Not Authorized' });
      return;
    }

    const rows: RoleRow[] = await getRolesByUserId(userId);
    res.locals.roles = rows.map((r: RoleRow) => r.name);
    return next();
  } catch (error) {
    console.error('[loadRoles]', error);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
};

export const requireRoles =
  (...allowed: string[]) =>
  (_req: Request, res: Response, next: NextFunction): void => {
    const roles: string[] = res.locals.roles || [];
    const hasRole = allowed.some((role) => roles.includes(role));
    if (!hasRole) {
      res.status(403).json({ message: 'Forbidden: missing role' });
      return;
    }
    return next();
  };
