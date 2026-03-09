// src/routes/orders.js
'use strict';

const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const FORBIDDEN = ['id', 'created_at', 'status', 'total'];

function sanitize(body) {
  const clean = { ...body };
  FORBIDDEN.forEach(f => delete clean[f]);
  return clean;
}

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

// GET /api/orders — admin
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders').select('*')
      .order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:ref — lookup by order reference
router.get('/:ref', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('order_ref, customer_name, items, total, payment_method, status, created_at')
      .eq('order_ref', req.params.ref).single();
    if (error) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders
router.post('/', async (req, res) => {
  const body = sanitize(req.body);
  if (!body.order_ref || !String(body.order_ref).trim()) {
    return res.status(400).json({ error: 'order_ref is required' });
  }
  if (!body.customer_name || !String(body.customer_name).trim()) {
    return res.status(400).json({ error: 'customer_name is required' });
  }
  if (!isValidEmail(body.customer_email)) {
    return res.status(400).json({ error: 'Valid customer_email is required' });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  // Server-side total — never trust client
  const computedTotal = body.items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const qty   = parseInt(item.qty, 10) || 1;
    return sum + price * qty;
  }, 0);

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_ref:      String(body.order_ref).trim().slice(0, 40),
        customer_name:  String(body.customer_name).trim().slice(0, 120),
        customer_email: body.customer_email.trim().toLowerCase(),
        items:          body.items,
        total:          Math.round(computedTotal * 100) / 100,
        payment_method: (body.payment_method || 'card').slice(0, 30),
        status:         'Confirmed',
      })
      .select('id, order_ref, total, status').single();
    if (error) throw error;
    res.status(201).json({ message: 'Order placed', order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/status — admin
router.patch('/:id/status', async (req, res) => {
  const allowed = ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];
  const { status } = req.body;
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Allowed: ' + allowed.join(', ') });
  }
  try {
    const { data, error } = await supabase
      .from('orders').update({ status })
      .eq('id', req.params.id)
      .select('id, order_ref, status').single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order status updated', order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
