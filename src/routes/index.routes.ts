import { Router } from 'express';
import userRouter from './user.routes';
import userSecurityRouter from './user-security.routes';
import debateRouter from './debate.routes';
import questionsRouter from './questions.routes';

const router = Router();

router.use('/user', userRouter);

router.use('/user-security', userSecurityRouter);

router.use('/debate', debateRouter);

router.use('/question', questionsRouter);

export default router;
