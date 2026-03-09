// src/routes/products.js
const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const FORBIDDEN = ['id', 'created_at', 'updated_at', 'sales'];

function sanitize(body) {
  const clean = { ...body };
  FORBIDDEN.forEach(f => delete clean[f]);
  return clean;
}

function validate(body, res) {
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return false;
  }
  const price = parseFloat(body.price);
  if (isNaN(price) || price < 0) {
    res.status(400).json({ error: 'price must be a non-negative number' });
    return false;
  }
  return true;
}

// GET /api/products
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('products').select('*').order('id', { ascending: true });
    if (req.query.cat && req.query.cat !== 'all') {
      query = query.eq('cat', req.query.cat);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Product not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  const body = sanitize(req.body);
  if (!validate(body, res)) return;
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name:        body.name.trim(),
        cat:         body.cat         || 'other',
        price:       parseFloat(body.price),
        badge:       body.badge       || '',
        description: body.description || '',
        emoji:       body.emoji       || '📦',
        stock:       parseInt(body.stock, 10) || 100,
        image_url:   body.image_url   || '',
      })
      .select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Product created', product: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id
router.patch('/:id', async (req, res) => {
  const body = sanitize(req.body);
  if (Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  if (body.price !== undefined) body.price = parseFloat(body.price);
  if (body.stock !== undefined) body.stock = parseInt(body.stock, 10);
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product updated', product: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Product deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
