import request from 'supertest';
import app from '@/app';

describe('Integración de API', () => {
  it('Debería retornar 404 en la raíz', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
    expect(res.text).toContain('<pre>Cannot GET /</pre>');
  });
});
