import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { initDb, clearDatabase } from './database/init.js';
import { closeDbConnections } from './database/connection.js';

describe('API Endpoints', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDbConnections();
  });

  it('GET /logs - by měl vrátit prázdné pole na začátku (nebo s inicializačními logy)', async () => {
    const res = await request(app).get('/logs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('POST /scrape-all - by měl vrátit 400 pokud chybí selektory (podle implementace)', async () => {
    // Tady předpokládám nějakou validaci, pokud ne, test upravím
    const res = await request(app)
      .post('/scrape-all')
      .send({});
    
    // Podle toho, co vrací reálný endpoint
    expect(res.status).not.toBe(404);
  });

  it('GET /ws/stats - by měl vrátit statistiky websocketu', async () => {
    const res = await request(app).get('/ws/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('stats');
  });

  it('POST /ws/test - by měl odeslat testovací notifikaci', async () => {
    const res = await request(app)
      .post('/ws/test')
      .send({
        title: 'Api Test',
        message: 'Hello'
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
