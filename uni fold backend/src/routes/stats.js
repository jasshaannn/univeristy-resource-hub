const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/stats  -> overall counts + a year-wise breakdown of PDFs / PPTs / notes
router.get('/', (_req, res) => {
  const one = (sql) => db.prepare(sql).get().n;

  const totals = {
    subjects: one('SELECT COUNT(*) n FROM subjects'),
    resources: one('SELECT COUNT(*) n FROM resources'),
    pdf: one("SELECT COUNT(*) n FROM resources WHERE type='pdf'"),
    ppt: one("SELECT COUNT(*) n FROM resources WHERE type='ppt'"),
    notes: one("SELECT COUNT(*) n FROM resources WHERE type='notes'"),
    timetables: one('SELECT COUNT(*) n FROM timetables'),
    societies: one('SELECT COUNT(*) n FROM societies'),
    downloads: one('SELECT COALESCE(SUM(downloads),0) n FROM resources'),
  };

  const years = db
    .prepare(
      `SELECT s.year,
              COUNT(DISTINCT s.id)                                   AS subjects,
              COUNT(r.id)                                            AS resources,
              COALESCE(SUM(r.type = 'pdf'), 0)                       AS pdf,
              COALESCE(SUM(r.type = 'ppt'), 0)                       AS ppt,
              COALESCE(SUM(r.type = 'notes'), 0)                     AS notes
       FROM subjects s LEFT JOIN resources r ON r.subject_id = s.id
       GROUP BY s.year ORDER BY s.year`
    )
    .all();

  res.json({ totals, years });
});

module.exports = router;
