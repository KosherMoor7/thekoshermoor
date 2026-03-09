// src/routes/services.js
const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const FORBIDDEN = ['id', 'created_at'];

function sanitize(body) {
  const clean = { ...body };
  FORBIDDEN.forEach(f => delete clean[f]);
  return clean;
}

// GET /api/services
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services').select('*').order('id', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/services
router.post('/', async (req, res) => {
  const body = sanitize(req.body);
  if (!body.name || !body.name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const { data, error } = await supabase
      .from('services')
      .insert({
        name:        body.name.trim(),
        description: body.description || '',
        icon:        body.icon        || '🔧',
        price:       body.price       || 'Contact for pricing',
        cat:         body.cat         || 'service',
      })
      .select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Service created', service: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/services/:id
router.patch('/:id', async (req, res) => {
  const body = sanitize(req.body);
  if (Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  try {
    const { data, error } = await supabase
      .from('services')
      .update(body).eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Service not found' });
    res.json({ message: 'Service updated', service: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/services/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('services').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Service deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
