// Timetable websites and society handles. Both are simple "list + add + edit + delete" resources,
// so one small factory builds the routes for each.
const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/auth');

function crud({ table, fields, required, orderBy, filters = [] }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const where = [];
    const params = [];
    for (const f of filters) {
      if (req.query[f] !== undefined && req.query[f] !== '') {
        where.push(f === 'branch' ? "(branch = ? OR branch = 'ALL')" : `${f} = ?`);
        params.push(req.query[f]);
      }
    }
    const sql = `SELECT * FROM ${table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy}`;
    res.json(db.prepare(sql).all(...params));
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  router.post('/', requireAdmin, (req, res) => {
    const missing = required.filter((f) => !req.body[f]);
    if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

    const values = fields.map((f) => (req.body[f] === '' ? null : req.body[f] ?? null));
    const info = db
      .prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`)
      .run(...values);
    res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid));
  });

  router.put('/:id', requireAdmin, (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const next = { ...existing, ...req.body };
    db.prepare(`UPDATE ${table} SET ${fields.map((f) => `${f}=?`).join(',')} WHERE id=?`).run(
      ...fields.map((f) => next[f] ?? null),
      existing.id
    );
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(existing.id));
  });

  router.delete('/:id', requireAdmin, (req, res) => {
    const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  });

  return router;
}

const timetables = crud({
  table: 'timetables',
  fields: ['title', 'url', 'year', 'branch', 'note'],
  required: ['title', 'url'],
  orderBy: 'year, title',
  filters: ['year', 'branch'],
});

const societies = crud({
  table: 'societies',
  fields: ['name', 'category', 'description', 'instagram', 'linkedin', 'website', 'email', 'logo_url'],
  required: ['name'],
  orderBy: 'name',
  filters: ['category'],
});

module.exports = { timetables, societies };
