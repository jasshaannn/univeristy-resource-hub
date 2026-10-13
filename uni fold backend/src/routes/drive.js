const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAdmin = require('../middleware/auth');
const { runSync } = require('../../scripts/sync-drive');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '../../public/data');

function readJsonFile(filename, fallback = {}) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return fallback;
  }
}

// GET /api/drive/tree
router.get('/tree', (_req, res) => {
  const tree = readJsonFile('tree.json', { name: 'Empty', children: {} });
  res.json(tree);
});

// GET /api/drive/files
router.get('/files', (_req, res) => {
  const files = readJsonFile('files.json', {});
  res.json(files);
});

// GET /api/drive/stats
router.get('/stats', (_req, res) => {
  const stats = readJsonFile('stats.json', {
    totalFolders: 0,
    totalFiles: 0,
    lastSyncTime: null,
    totalStorageSize: '0 KB'
  });
  res.json(stats);
});

// GET /api/drive/search?q=chemistry
router.get('/search', (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  const searchIndex = readJsonFile('search.json', []);

  if (!query) {
    return res.json(searchIndex);
  }

  const results = searchIndex.filter(item =>
    (item.name && item.name.toLowerCase().includes(query)) ||
    (item.path && item.path.toLowerCase().includes(query))
  );

  res.json(results);
});

// POST /api/drive/sync
let isSyncing = false;
router.post('/sync', requireAdmin, async (req, res) => {
  if (isSyncing) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }

  isSyncing = true;
  try {
    const syncDb = req.body && req.body.syncDb !== false;
    console.log(`[API] Manual Drive sync triggered (syncDb=${syncDb})`);
    const result = await runSync({ syncDb });
    res.json({
      success: true,
      stats: result.stats
    });
  } catch (err) {
    console.error('[API] Sync error:', err);
    res.status(500).json({ error: err.message || 'Drive sync failed' });
  } finally {
    isSyncing = false;
  }
});

module.exports = router;
