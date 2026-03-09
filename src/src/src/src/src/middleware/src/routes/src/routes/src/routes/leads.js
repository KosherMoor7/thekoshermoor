// src/routes/leads.js
const express  = require('express');
const router   = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const FORBIDDEN = ['id', 'created_at', 'status'];

function sanitize(body) {
  const clean = { ...body };
  FORBIDDEN.forEach(f => delete clean[f]);
  return clean;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leads').select('*')
      .order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads
router.post('/', async (req, res) => {
  const body = sanitize(req.body);
  if (!isValidEmail(body.email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  try {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name:     (body.name     || '').trim().slice(0, 120),
        email:    body.email.trim().toLowerCase(),
        phone:    (body.phone    || '').trim().slice(0, 30),
        interest: (body.interest || 'General').slice(0, 255),
        source:   (body.source   || 'Website').slice(0, 100),
        msg:      (body.msg      || '').slice(0, 1000),
        status:   'New',
      })
      .select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Lead captured', id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id/status
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['New', 'Contacted', 'Qualified', 'Closed', 'Unsubscribed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Allowed: ' + allowed.join(', ') });
  }
  try {
    const { data, error } = await supabase
      .from('leads').update({ status })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Lead not found' });
    res.json({ message: 'Status updated', lead: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
