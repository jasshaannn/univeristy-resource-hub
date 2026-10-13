const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const requireAdmin = require('../middleware/auth');
const { upload, guessType, UPLOAD_DIR } = require('../middleware/upload');

const router = express.Router();

const withUrls = (r) => ({
  ...r,
  url: r.preview_url || `/files/${r.file_name}`,                 // opens in browser or Google Drive preview
  download_url: r.download_url || `/api/resources/${r.id}/download`, // forces download + counts it
});

// GET /api/resources?year=2&subject_id=5&type=pdf&q=unit
router.get('/', (req, res) => {
  const where = [];
  const params = [];
  const { year, subject_id, type, q } = req.query;

  if (year)       { where.push('s.year = ?');       params.push(Number(year)); }
  if (subject_id) { where.push('r.subject_id = ?'); params.push(Number(subject_id)); }
  if (type)       { where.push('r.type = ?');       params.push(type); }
  if (q)          { where.push('(r.title LIKE ? OR s.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const rows = db
    .prepare(
      `SELECT r.*, s.name AS subject_name, s.code AS subject_code, s.year
       FROM resources r JOIN subjects s ON s.id = r.subject_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY r.uploaded_at DESC`
    )
    .all(...params);
  res.json(rows.map(withUrls));
});

// POST /api/resources  (admin)  multipart/form-data
// fields: subject_id, title?, type? (pdf|ppt|notes|other, auto-detected if empty), file (the file itself)
router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  const { subject_id, title, type } = req.body;

  const cleanup = () => req.file && fs.unlink(req.file.path, () => {});

  if (!req.file) return res.status(400).json({ error: 'file is required' });
  if (!subject_id) { cleanup(); return res.status(400).json({ error: 'subject_id is required' }); }

  const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(subject_id);
  if (!subject) { cleanup(); return res.status(404).json({ error: 'Subject not found' }); }

  const finalType = ['pdf', 'ppt', 'notes', 'other'].includes(type) ? type : guessType(req.file.originalname);
  const finalTitle = (title && title.trim()) || path.parse(req.file.originalname).name;

  const info = db
    .prepare(
      `INSERT INTO resources (subject_id, title, type, file_name, original_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(subject.id, finalTitle, finalType, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size);

  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(withUrls(row));
});

// GET /api/resources/:id/download  -> sends file as download (or redirects to Drive) and bumps counter
router.get('/:id/download', (req, res) => {
  const r = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Resource not found' });

  db.prepare('UPDATE resources SET downloads = downloads + 1 WHERE id = ?').run(r.id);

  if (r.download_url && r.download_url.startsWith('http')) {
    return res.redirect(r.download_url);
  }

  const full = path.join(UPLOAD_DIR, r.file_name);
  if (!fs.existsSync(full)) return res.status(410).json({ error: 'File missing on server' });

  res.download(full, r.original_name);
});

// DELETE /api/resources/:id  (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const r = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Resource not found' });

  db.prepare('DELETE FROM resources WHERE id = ?').run(r.id);
  fs.unlink(path.join(UPLOAD_DIR, r.file_name), () => {});
  res.json({ deleted: true });
});

module.exports = router;
