import { Router } from 'express';
import userRouter from './user.routes';
import userSecurityRouter from './user-security.routes';

const router = Router();

router.use('/user', userRouter);

router.use('/user-security', userSecurityRouter);

export default router;
