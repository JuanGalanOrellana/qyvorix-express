import { Router } from 'express';
import {
  validateLogin,
  validateRegister,
  validateForgotPasswordEmail,
  validateResetPassword,
  validateGoogleLogin,
  validateUser,
  validateEmailVerification,
} from '@/middlewares/user.middleware';
import { loadRoles } from '@/middlewares/roles.middleware';
import userController from '@/controllers/user.controller';

const userRouter = Router();

userRouter.post('/login', validateLogin, userController.login);
userRouter.post('/register', validateRegister, userController.register);
userRouter.post(
  '/forgot-password',
  validateForgotPasswordEmail,
  userController.forgotPasswordEmail
);
userRouter.patch('/reset-password', validateResetPassword, userController.resetPassword);
userRouter.post('/google-login', validateGoogleLogin, userController.googleLogin);

userRouter.use(
  ['/profile', '/update', '/logout', '/send-verification-email', '/email-verification'],
  validateUser,
  loadRoles
);

userRouter.get('/profile', userController.getUserData);
userRouter.patch('/update', userController.updateUserData);
userRouter.post('/logout', userController.logout);
userRouter.post('/send-verification-email', userController.sendVerificationEmail);
userRouter.get('/email-verification', validateEmailVerification, userController.emailVerification);

export default userRouter;
