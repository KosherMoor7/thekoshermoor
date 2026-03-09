// src/routes/reviews.js
'use strict';

const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const FORBIDDEN = ['id', 'created_at', 'updated_at', 'status', 'owner'];

function sanitize(body) {
  const clean = { ...body };
  FORBIDDEN.forEach(f => delete clean[f]);
  return clean;
}

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

// GET /api/reviews — published only
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, name, product, stars, review_text, recommendation, created_at')
      .eq('status', 'Published')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/all — all statuses (admin)
router.get('/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews').select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews
router.post('/', async (req, res) => {
  const body = sanitize(req.body);
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!body.review_text || !String(body.review_text).trim()) {
    return res.status(400).json({ error: 'review_text is required' });
  }
  const stars = parseInt(body.stars, 10);
  if (isNaN(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'stars must be 1-5' });
  }
  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        name:           String(body.name).trim().slice(0, 100),
        email:          isValidEmail(body.email) ? body.email.trim().toLowerCase() : '',
        product:        (body.product        || '').slice(0, 120),
        stars,
        review_text:    String(body.review_text).trim().slice(0, 2000),
        recommendation: (body.recommendation || '').slice(0, 200),
        owner:          isValidEmail(body.email) ? body.email.trim().toLowerCase() : null,
        status:         'Pending',
      })
      .select('id').single();
    if (error) throw error;
    res.status(201).json({ message: 'Review submitted — pending approval', id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reviews/:id/approve — admin
router.patch('/:id/approve', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .update({ status: 'Published' })
      .eq('id', req.params.id)
      .select('id, name, status').single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Review not found' });
    res.json({ message: 'Review approved', review: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reviews/:id — admin
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Review deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
