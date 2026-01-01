import { Router } from 'express';
import { validateUser } from '@/middlewares/user.middleware';
import { loadRoles, requireRoles } from '@/middlewares/roles.middleware';
import { validateCreateQuestion } from '@/middlewares/question.middleware';
import * as questionsController from '@/controllers/questions.controller';

const questionsRouter = Router();

questionsRouter.post(
  '/',
  validateUser,
  loadRoles,
  requireRoles('ADMIN'),
  validateCreateQuestion,
  questionsController.createQuestion
);

export default questionsRouter;
