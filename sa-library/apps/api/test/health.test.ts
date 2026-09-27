import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
describe('API foundation', () => {
  it('GET /api/health reports service status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'sa-library-api' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('returns a consistent JSON 404', async () => {
    const response = await request(app).get('/api/missing');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
  it('handles malformed JSON centrally', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });
});
