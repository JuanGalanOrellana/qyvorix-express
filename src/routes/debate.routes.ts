import { Router } from 'express';
import debateController from '@/controllers/debate.controller';
import { validateUser } from '@/middlewares/user.middleware';
import { loadRoles } from '@/middlewares/roles.middleware';
import { loadActiveQuestion, requireActiveQuestionById } from '@/middlewares/question.middleware';
import { validateCreateAnswer, createAnswerMw } from '@/middlewares/answer.middleware';
import { applyStreakOnAnswerMw } from '@/middlewares/streak.middleware';
import {
  validateAnswerIdParam,
  preventSelfLike,
  likeAnswerMw,
  unlikeAnswerMw,
} from '@/middlewares/like.middleware';
import { tryValidateUser } from '@/middlewares/jwt.middleware';

const debateRouter = Router();

debateRouter.get('/question/active', loadActiveQuestion, debateController.getActiveQuestion);

debateRouter.post(
  '/question/:id/answer',
  validateUser,
  requireActiveQuestionById,
  validateCreateAnswer,
  createAnswerMw,
  applyStreakOnAnswerMw,
  debateController.answer
);

debateRouter.post(
  '/answers/:answerId/like',
  validateUser,
  loadRoles,
  validateAnswerIdParam,
  preventSelfLike,
  likeAnswerMw,
  debateController.likeAnswer
);

debateRouter.delete(
  '/answers/:answerId/like',
  validateUser,
  loadRoles,
  validateAnswerIdParam,
  unlikeAnswerMw,
  debateController.unlikeAnswer
);

debateRouter.get('/question/:id/top', debateController.getTopAnswers);

debateRouter.get('/question/:id/answers', tryValidateUser, debateController.listAnswers);

debateRouter.get('/question/:id/results', debateController.getResults);

debateRouter.get('/question/:id/my-answer', validateUser, debateController.getMyAnswer);

debateRouter.get('/my-answers', validateUser, loadRoles, debateController.getMyAnswers);

debateRouter.get('/users/:userId/profile', debateController.getUserProfile);

debateRouter.get('/users/:userId/answers', tryValidateUser, debateController.getUserAnswers);

debateRouter.get('/my-likes', validateUser, loadRoles, debateController.getMyLikes);

debateRouter.get('/user/:userId/likes', tryValidateUser, debateController.getUserLikes);

export default debateRouter;
