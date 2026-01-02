import { Router } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import userRouter from './user.routes';
import userSecurityRouter from './user-security.routes';
import debateRouter from './debate.routes';
import questionsRouter from './questions.routes';
import { queryRows } from '@/config/db';

const router = Router();

interface HealthCheckRow extends RowDataPacket {
  ok: number;
}

router.get('/health/db', async (_req, res) => {
  try {
    const rows = await queryRows<HealthCheckRow>('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      database: rows[0],
    });
  } catch (e: any) {
    console.error('❌ DB health error:', e);
    res.status(500).json({
      status: 'error',
      message: e?.message ?? 'db error',
      code: e?.code,
    });
  }
});

router.use('/user', userRouter);
router.use('/user-security', userSecurityRouter);
router.use('/debate', debateRouter);
router.use('/question', questionsRouter);

export default router;
