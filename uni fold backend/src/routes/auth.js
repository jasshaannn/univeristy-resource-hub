const express = require('express');
const router = express.Router();
const db = require('../db');
const { createAdminToken, requireAdmin, safeEqual } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Body: { id, password } or { username, password }
 * Validates admin credentials against .env and admins database table.
 */
router.post('/login', (req, res) => {
  const id = (req.body.id || req.body.username || '').trim();
  const password = (req.body.password || '').trim();

  if (!id || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both Admin ID and Password.'
    });
  }

  const envId = (process.env.ADMIN_ID || process.env.ADMIN_USERNAME || 'admin').trim();
  const envPassword = (process.env.ADMIN_PASSWORD || '').trim();

  let isValid = false;
  let username = '';

  // 1. Verify against .env configuration (only if ADMIN_PASSWORD is explicitly configured)
  if (envPassword && safeEqual(id, envId) && safeEqual(password, envPassword)) {
    isValid = true;
    username = envId;
  }

  // 2. Verify against database admins table
  if (!isValid) {
    try {
      const user = db.prepare('SELECT * FROM admins WHERE username = ? COLLATE NOCASE').get(id);
      if (user && safeEqual(password, user.password)) {
        isValid = true;
        username = user.username;
      }
    } catch (err) {
      console.error('Database query error during auth:', err.message);
    }
  }

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid Admin ID or Password. Access denied.'
    });
  }

  // Generate secure token
  const token = createAdminToken({ id: username, role: 'admin' });

  return res.json({
    success: true,
    message: 'Admin authentication successful',
    token,
    user: { id: username }
  });
});

/**
 * GET /api/auth/verify
 * Checks if current Bearer token or admin key is valid.
 */
router.get('/verify', requireAdmin, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: req.admin || { id: process.env.ADMIN_ID || 'admin' }
  });
});

/**
 * POST /api/auth/logout
 * Client-side clears the token; server confirms successful sign out.
 */
router.post('/logout', (_req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
