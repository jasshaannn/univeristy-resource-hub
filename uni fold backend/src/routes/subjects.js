const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/auth');

const router = express.Router();

const COUNTS = `
  (SELECT COUNT(*) FROM resources r WHERE r.subject_id = s.id)                    AS total_resources,
  (SELECT COUNT(*) FROM resources r WHERE r.subject_id = s.id AND r.type='pdf')   AS pdf_count,
  (SELECT COUNT(*) FROM resources r WHERE r.subject_id = s.id AND r.type='ppt')   AS ppt_count,
  (SELECT COUNT(*) FROM resources r WHERE r.subject_id = s.id AND r.type='notes') AS notes_count
`;

// GET /api/subjects?year=2&semester=3&branch=CSE&q=data
router.get('/', (req, res) => {
  const where = [];
  const params = [];
  const { year, semester, branch, q } = req.query;

  if (year)     { where.push('s.year = ?');     params.push(Number(year)); }
  if (semester) { where.push('s.semester = ?'); params.push(Number(semester)); }
  if (branch)   { where.push("(s.branch = ? OR s.branch = 'ALL')"); params.push(branch); }
  if (q)        { where.push('(s.name LIKE ? OR s.code LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const sql = `
    SELECT s.*, ${COUNTS}
    FROM subjects s
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY s.year, s.semester, s.name`;
  res.json(db.prepare(sql).all(...params));
});

// GET /api/subjects/:id  -> subject + its resources grouped by type
router.get('/:id', (req, res) => {
  const subject = db.prepare(`SELECT s.*, ${COUNTS} FROM subjects s WHERE s.id = ?`).get(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const resources = db
    .prepare('SELECT * FROM resources WHERE subject_id = ? ORDER BY uploaded_at DESC')
    .all(req.params.id)
    .map((r) => ({ ...r, url: `/files/${r.file_name}`, download_url: `/api/resources/${r.id}/download` }));

  res.json({
    ...subject,
    resources: {
      pdf: resources.filter((r) => r.type === 'pdf'),
      ppt: resources.filter((r) => r.type === 'ppt'),
      notes: resources.filter((r) => r.type === 'notes'),
      other: resources.filter((r) => r.type === 'other'),
    },
  });
});

// POST /api/subjects  (admin)  body: { name, code?, year, semester?, branch? }
router.post('/', requireAdmin, (req, res) => {
  const { name, code, year, semester, branch } = req.body;
  if (!name || !year) return res.status(400).json({ error: 'name and year are required' });

  const info = db
    .prepare('INSERT INTO subjects (name, code, year, semester, branch) VALUES (?, ?, ?, ?, ?)')
    .run(name, code || null, Number(year), semester ? Number(semester) : null, branch || 'ALL');
  res.status(201).json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(info.lastInsertRowid));
});

// PUT /api/subjects/:id  (admin)
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subject not found' });

  const next = { ...existing, ...req.body };
  db.prepare('UPDATE subjects SET name=?, code=?, year=?, semester=?, branch=? WHERE id=?').run(
    next.name, next.code, Number(next.year), next.semester ? Number(next.semester) : null, next.branch, existing.id
  );
  res.json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(existing.id));
});

// DELETE /api/subjects/:id  (admin) - also deletes its resource rows (files are cleaned by resources route helper)
router.delete('/:id', requireAdmin, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const { UPLOAD_DIR } = require('../middleware/upload');

  const files = db.prepare('SELECT file_name FROM resources WHERE subject_id = ?').all(req.params.id);
  const info = db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Subject not found' });

  files.forEach((f) => fs.unlink(path.join(UPLOAD_DIR, f.file_name), () => {}));
  res.json({ deleted: true });
});

module.exports = router;
