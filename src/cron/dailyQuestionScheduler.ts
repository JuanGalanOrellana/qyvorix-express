import cron from 'node-cron';
import Questions from '@/models/questions';

export function startDailyQuestionScheduler() {
  cron.schedule(
    '0 0 * * *',
    async () => {
      await Questions.activateNextDue();
    },
    { timezone: 'Europe/Madrid' }
  );

  console.log('🕛 Cron de preguntas diarias activo');
}
