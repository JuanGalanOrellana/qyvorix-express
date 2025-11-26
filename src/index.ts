import http from 'http';
import app from './app';
import { startDailyQuestionScheduler } from '@/cron/dailyQuestionScheduler';

const server = http.createServer(app);

server.listen(8080, () => {
  console.log('✅ Server is running on http://localhost:8080');
  console.log('📘 Swagger docs: http://localhost:8080/api/docs');
  (async () => {
    startDailyQuestionScheduler();
  })();
});
