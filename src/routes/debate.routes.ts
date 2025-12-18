import { Router } from 'express';
import debateController from '@/controllers/debate.controller';
import { validateUser } from '@/middlewares/user.middleware';
import { loadRoles } from '@/middlewares/roles.middleware';
import { loadActiveQuestion, requireActiveQuestionById } from '@/middlewares/question.middleware';
import { validateCreateAnswer, createAnswerMw } from '@/middlewares/answer.middleware';
import {
  preventDuplicateParticipation,
  recordParticipationMw,
} from '@/middlewares/participation.middleware';
import {
  validateAnswerIdParam,
  preventSelfLike,
  likeAnswerMw,
  unlikeAnswerMw,
} from '@/middlewares/like.middleware';

const debateRouter = Router();

debateRouter.get('/question/active', loadActiveQuestion, debateController.getActiveQuestion);

debateRouter.post(
  '/question/:id/answer',
  validateUser,
  requireActiveQuestionById,
  preventDuplicateParticipation,
  validateCreateAnswer,
  createAnswerMw,
  recordParticipationMw,
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

debateRouter.get('/question/:id/answers', debateController.listAnswers);

debateRouter.get('/question/:id/results', debateController.getResults);

debateRouter.get('/question/:id/my-answer', validateUser, debateController.getMyAnswer);

export default debateRouter;
