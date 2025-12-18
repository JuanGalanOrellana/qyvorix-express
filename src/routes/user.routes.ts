import { Router } from 'express';
import {
  validateLogin,
  validateRegister,
  validateForgotPasswordEmail,
  validateGoogleLogin,
  validateUser,
  validateVerifyEmailCode,
  validateResendVerificationEmail,
  validateResetPasswordFromBody,
} from '@/middlewares/user.middleware';
import { loadRoles } from '@/middlewares/roles.middleware';
import userController from '@/controllers/user.controller';

const userRouter = Router();

userRouter.post('/register', validateRegister, userController.register);
userRouter.post('/login', validateLogin, userController.login);
userRouter.post('/google-login', validateGoogleLogin, userController.googleLogin);

userRouter.post(
  '/forgot-password',
  validateForgotPasswordEmail,
  userController.forgotPasswordEmail
);

userRouter.patch('/reset-password', validateResetPasswordFromBody, userController.resetPassword);

userRouter.post(
  '/resend-verification-email',
  validateResendVerificationEmail,
  userController.resendVerificationEmail
);

userRouter.post('/verify-email-code', validateVerifyEmailCode, userController.verifyEmailCode);

userRouter.use(['/profile', '/update', '/logout'], validateUser, loadRoles);

userRouter.get('/profile', userController.getUserData);
userRouter.patch('/update', userController.updateUserData);
userRouter.post('/logout', userController.logout);

export default userRouter;
