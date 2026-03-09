// src/app.js
'use strict';

const express               = require('express');
const cors                  = require('cors');
const rejectForbiddenFields = require('./middleware/rejectForbiddenFields');

const productsRouter = require('./routes/products');
const servicesRouter = require('./routes/services');
const leadsRouter    = require('./routes/leads');
const reviewsRouter  = require('./routes/reviews');
const ordersRouter   = require('./routes/orders');

const app = express();

// ── CORS
app.use(cors({
  origin: [
    'https://thekoshermoor.com',
    'https://www.thekoshermoor.com',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Field protection
app.use('/api/products', rejectForbiddenFields(['stock', 'cost'], { maxDepth: 6, maxNodes: 5000 }));
app.use('/api/services', rejectForbiddenFields(['cost'], { maxDepth: 4, maxNodes: 2000 }));
app.use('/api/leads',    rejectForbiddenFields(['status', 'owner'], { maxDepth: 4, maxNodes: 2000 }));
app.use('/api/reviews',  rejectForbiddenFields(['status', 'owner'], { maxDepth: 4, maxNodes: 2000 }));
app.use('/api/orders',   rejectForbiddenFields(['status', 'total'], { maxDepth: 6, maxNodes: 5000 }));

// ── Routers
app.use('/api/products', productsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/leads',    leadsRouter);
app.use('/api/reviews',  reviewsRouter);
app.use('/api/orders',   ordersRouter);

// ── 404
app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// ── Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.code || 'internal_server_error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
