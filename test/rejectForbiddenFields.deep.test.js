// test/rejectForbiddenFields.deep.test.js
const request = require('supertest');
const express = require('express');
const rejectForbiddenFields = require('../src/middleware/rejectForbiddenFields');

describe('deep rejectForbiddenFields middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.post(
      '/test',
      rejectForbiddenFields(['stock', 'cost'], { maxDepth: 10, maxNodes: 10000 }),
      (req, res) => { res.status(200).json({ ok: true }); }
    );
  });

  test('allows nested structures without forbidden keys', async () => {
    const payload = { a: { b: { c: [{ d: 1 }] } } };
    const res = await request(app).post('/test').send(payload);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('rejects when forbidden key appears nested deep', async () => {
    const payload = { a: { b: { c: [{ d: { cost: 100 } }] } } };
    const res = await request(app).post('/test').send(payload);
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('cost');
    expect(res.body.error).toBe('forbidden_fields_present');
  });

  test('rejects when forbidden key appears in array of objects', async () => {
    const payload = { items: [{ name: 'x' }, { stock: 5 }] };
    const res = await request(app).post('/test').send(payload);
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('stock');
  });

  test('respects maxDepth limit — cost beyond depth 2 is NOT detected', async () => {
    const deep = { a: { b: { c: { d: { cost: 1 } } } } };
    const app2 = express();
    app2.use(express.json());
    app2.post(
      '/limit',
      rejectForbiddenFields(['cost'], { maxDepth: 2, maxNodes: 1000 }),
      (req, res) => res.status(200).json({ ok: true })
    );
    const res = await request(app2).post('/limit').send(deep);
    expect(res.statusCode).toBe(200);
  });

  test('stops scanning when node budget exceeded', async () => {
    const big = { arr: [] };
    for (let i = 0; i < 1000; i++) {
      big.arr.push({ idx: i, nested: { x: i } });
    }
    const app3 = express();
    app3.use(express.json());
    app3.post(
      '/budget',
      rejectForbiddenFields(['never'], { maxDepth: 10, maxNodes: 10 }),
      (req, res) => res.status(200).json({ ok: true })
    );
    const res = await request(app3).post('/budget').send(big);
    expect(res.statusCode).toBe(200);
  });

  test('allows empty body', async () => {
    const res = await request(app).post('/test').send({});
    expect(res.statusCode).toBe(200);
  });

  test('rejects multiple forbidden keys and reports all of them', async () => {
    const payload = { a: { stock: 5 }, b: { cost: 20 } };
    const res = await request(app).post('/test').send(payload);
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('stock');
    expect(res.body.forbidden).toContain('cost');
    expect(res.body.forbidden).toHaveLength(2);
  });

  test('rejects forbidden key at root level', async () => {
    const res = await request(app).post('/test').send({ stock: 99 });
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('stock');
  });

  test('passes through when body is not JSON object', async () => {
    const res = await request(app)
      .post('/test')
      .set('Content-Type', 'text/plain')
      .send('just a string');
    expect(res.statusCode).toBe(200);
  });
});
