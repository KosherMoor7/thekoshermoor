// src/middleware/rejectForbiddenFields.js
'use strict';

function rejectForbiddenFields(forbidden = [], opts = {}) {
  const maxDepth     = opts.maxDepth ?? 6;
  const maxNodes     = opts.maxNodes ?? 5000;
  const forbiddenSet = new Set(forbidden.map(k => String(k)));

  if (forbiddenSet.size === 0) {
    return (_req, _res, next) => next();
  }

  function scan(value, depth, state) {
    if (state.nodes >= maxNodes) return;
    if (depth > maxDepth)        return;
    if (value === null || typeof value !== 'object') return;

    const isArray = Array.isArray(value);
    const entries = isArray ? value : Object.entries(value);

    if (isArray) {
      for (let i = 0; i < entries.length; i++) {
        state.nodes++;
        if (state.nodes >= maxNodes) return;
        const child = entries[i];
        if (child !== null && typeof child === 'object') {
          scan(child, depth + 1, state);
        }
      }
    } else {
      for (const [key, child] of entries) {
        state.nodes++;
        if (state.nodes >= maxNodes) return;
        if (forbiddenSet.has(key)) {
          state.found.add(key);
        }
        if (child !== null && typeof child === 'object') {
          scan(child, depth + 1, state);
        }
      }
    }
  }

  return function rejectForbiddenFieldsMiddleware(req, res, next) {
    if (!req.body || typeof req.body !== 'object') return next();

    const state = { nodes: 0, found: new Set() };
    scan(req.body, 0, state);

    if (state.found.size > 0) {
      const foundArray = Array.from(state.found);
      return res.status(400).json({
        error:     'forbidden_fields_present',
        forbidden: foundArray,
        message:   `Request contains forbidden field(s): ${foundArray.join(', ')}.`,
      });
    }

    next();
  };
}

module.exports = rejectForbiddenFields;
