import http from 'http';
import app from './app';
import { startDailyQuestionScheduler } from '@/cron/dailyQuestionScheduler';

const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 8080;

server.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📘 Swagger docs: http://localhost:${PORT}/api/docs`);
  startDailyQuestionScheduler();
});
