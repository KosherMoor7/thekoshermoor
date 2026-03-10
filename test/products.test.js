// test/products.test.js
const request = require('supertest');

jest.mock('@supabase/supabase-js', () => {
  const mockInsert = jest.fn();
  const mockSingle = jest.fn().mockResolvedValue({
    data: { id: 1, name: 'Test Product', cat: 'tea', price: 9.99 },
    error: null,
  });
  const chain = {
    select:  () => chain,
    insert:  (v) => { mockInsert(v); return chain; },
    update:  ()  => chain,
    delete:  ()  => chain,
    eq:      ()  => chain,
    order:   ()  => chain,
    limit:   ()  => chain,
    single:  ()  => mockSingle(),
  };
  Object.defineProperty(chain, 'then', {
    get: () => (resolve) => resolve({ data: [{ id: 1, name: 'Mock', cat: 'tea', price: 9.99 }], error: null }),
  });
  return {
    createClient: () => ({ from: () => chain }),
    __mockInsert: mockInsert,
  };
});

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';

const app = require('../src/app');

describe('POST /api/products — rejectForbiddenFields', () => {
  test('rejects payload containing "stock"', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Tea', cat: 'tea', price: 9.99, stock: 999 });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('forbidden_fields_present');
    expect(res.body.forbidden).toContain('stock');
  });

  test('rejects payload containing "cost"', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Tea', cat: 'tea', price: 9.99, cost: 2.50 });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('forbidden_fields_present');
    expect(res.body.forbidden).toContain('cost');
  });

  test('rejects nested forbidden key', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Tea', cat: 'tea', price: 9.99, meta: { cost: 1 } });
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('cost');
  });

  test('allows valid product payload', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Rooibos Blend', cat: 'tea', price: 18.99, badge: 'New', description: 'Great tea' });
    expect([200, 201, 500]).toContain(res.statusCode);
    expect(res.body.error).not.toBe('forbidden_fields_present');
  });
});

describe('POST /api/reviews — forbidden fields', () => {
  test('rejects payload with "status" set by client', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Alice', review_text: 'Great!', stars: 5, status: 'Published' });
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('status');
  });

  test('rejects payload with "owner" set by client', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ name: 'Alice', review_text: 'Great!', stars: 5, owner: 'admin@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('owner');
  });
});

describe('POST /api/orders — forbidden fields', () => {
  test('rejects payload with "status" set by client', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        order_ref: 'KM-001',
        customer_name: 'Alice',
        customer_email: 'alice@test.com',
        items: [{ name: 'Tea', price: 18.99, qty: 1 }],
        status: 'Shipped',
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('status');
  });

  test('rejects payload with "total" set by client', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        order_ref: 'KM-002',
        customer_name: 'Bob',
        customer_email: 'bob@test.com',
        items: [{ name: 'Tea', price: 18.99, qty: 1 }],
        total: 0.01,
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.forbidden).toContain('total');
  });
});

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
