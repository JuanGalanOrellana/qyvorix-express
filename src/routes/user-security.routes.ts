import { Router } from 'express';
import {
  validateUserSecurity,
  validateUserSecurityLogin,
  validateLogin2FA,
} from '@/middlewares/user-security.middleware';
import { loadRoles } from '@/middlewares/roles.middleware';
import userSecurityController from '@/controllers/user-security.controller';

const userSecurityRouter = Router();

userSecurityRouter.post(
  '/login',
  validateUserSecurityLogin,
  validateLogin2FA,
  userSecurityController.login2faUserSecurity
);
userSecurityRouter.use(validateUserSecurity, loadRoles);
userSecurityRouter.post('/logout', userSecurityController.logoutUserSecurity);

export default userSecurityRouter;
