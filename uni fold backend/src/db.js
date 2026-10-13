const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const isVercel = !!process.env.VERCEL;
const baseDataDir = path.join(__dirname, '..', 'data');
const dataDir = isVercel ? '/tmp/uni-data' : baseDataDir;
fs.mkdirSync(dataDir, { recursive: true });

const bundledDb = path.join(baseDataDir, 'resources.db');
const activeDb = path.join(dataDir, 'resources.db');

if (isVercel && fs.existsSync(bundledDb) && !fs.existsSync(activeDb)) {
  try {
    fs.copyFileSync(bundledDb, activeDb);
  } catch (e) {
    console.warn('Could not copy bundled DB to /tmp:', e.message);
  }
}

const db = new Database(activeDb);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS subjects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  code       TEXT,                          -- e.g. UTA018
  year       INTEGER NOT NULL CHECK (year BETWEEN 1 AND 5),
  semester   INTEGER CHECK (semester BETWEEN 1 AND 10),
  branch     TEXT    DEFAULT 'ALL',         -- e.g. CSE, ECE or ALL for common subjects
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resources (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id     INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title          TEXT    NOT NULL,
  type           TEXT    NOT NULL CHECK (type IN ('pdf','ppt','notes','other')),
  file_name      TEXT    NOT NULL,          -- stored name on disk
  original_name  TEXT    NOT NULL,          -- name the uploader had
  mime_type      TEXT,
  size_bytes     INTEGER,
  downloads      INTEGER NOT NULL DEFAULT 0,
  uploaded_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timetables (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,                 -- e.g. "2nd Year CSE Timetable"
  url        TEXT NOT NULL,                 -- link to the official timetable website
  year       INTEGER CHECK (year BETWEEN 1 AND 5),
  branch     TEXT DEFAULT 'ALL',
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS societies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  category    TEXT,                         -- technical, cultural, sports...
  description TEXT,
  instagram   TEXT,
  linkedin    TEXT,
  website     TEXT,
  email       TEXT,
  logo_url    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subjects_year      ON subjects(year);
CREATE INDEX IF NOT EXISTS idx_resources_subject  ON resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_type     ON resources(type);
`);

// Seed initial admin from env if table is empty
try {
  const row = db.prepare('SELECT COUNT(*) as count FROM admins').get();
  if (row && row.count === 0) {
    const defaultUser = process.env.ADMIN_ID || process.env.ADMIN_USERNAME || 'admin';
    const defaultPass = process.env.ADMIN_PASSWORD;
    if (defaultPass) {
      db.prepare('INSERT OR IGNORE INTO admins (username, password) VALUES (?, ?)').run(defaultUser, defaultPass);
    }
  }
} catch (e) {
  console.error('Admins table init warning:', e.message);
}

// Auto-seed datasets from public/data on fresh deploy if tables are empty
try {
  const subCount = db.prepare('SELECT COUNT(*) as count FROM subjects').get()?.count || 0;
  if (subCount === 0) {
    const filesPath = path.join(__dirname, '..', 'public', 'data', 'files.json');
    if (fs.existsSync(filesPath)) {
      const files = JSON.parse(fs.readFileSync(filesPath, 'utf8'));
      const findSubjectStmt = db.prepare('SELECT id FROM subjects WHERE name = ? AND year = ?');
      const insertSubjectStmt = db.prepare('INSERT INTO subjects (name, code, year, semester, branch) VALUES (?, ?, ?, ?, ?)');
      const insertResourceStmt = db.prepare(
        `INSERT INTO resources (subject_id, title, type, file_name, original_name, mime_type, size_bytes, preview_url, download_url, drive_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      function guessType(name) {
        const ext = path.extname(name).toLowerCase();
        if (ext === '.pdf') return 'pdf';
        if (['.ppt', '.pptx'].includes(ext)) return 'ppt';
        if (['.doc', '.docx', '.txt', '.md'].includes(ext)) return 'notes';
        return 'other';
      }

      function parseSubjectFromPath(filePath) {
        const parts = filePath.split('/');
        let year = 1;
        let branch = 'ALL';
        let subjectName = 'General';
        let subjectCode = null;
        for (const p of parts) {
          const yMatch = p.match(/Year\s*([1-5])/i);
          if (yMatch) year = parseInt(yMatch[1], 10);
        }
        if (parts.length >= 2) {
          const candidate = parts[parts.length - 2];
          const codeMatch = candidate.match(/^(.*?)[_\s]+([A-Z]{2,4}\d{3,4})$/i);
          if (codeMatch) {
            subjectName = codeMatch[1].trim();
            subjectCode = codeMatch[2].trim();
          } else {
            subjectName = candidate;
          }
          if (parts.some((p) => p.includes('Computer Science') || p.includes('CSE'))) branch = 'CSE';
          else if (parts.some((p) => p.includes('BioTechnology'))) branch = 'BT';
          else if (parts.some((p) => p.includes('Data Science'))) branch = 'DS';
          else if (parts.some((p) => p.includes('Pool A') || p.includes('Pool B'))) branch = 'ALL';
        }
        return { year, branch, subjectName, subjectCode };
      }

      const initTx = db.transaction(() => {
        for (const file of Object.values(files)) {
          const { year, branch, subjectName, subjectCode } = parseSubjectFromPath(file.path);
          let subject = findSubjectStmt.get(subjectName, year);
          if (!subject) {
            const semester = year * 2 - 1;
            const info = insertSubjectStmt.run(subjectName, subjectCode, year, semester, branch);
            subject = { id: info.lastInsertRowid };
          }
          const type = guessType(file.name);
          const title = file.name.replace(/\.[^/.]+$/, '');
          const fakeFileName = `drive_${file.id}${path.extname(file.name) || '.pdf'}`;
          insertResourceStmt.run(
            subject.id,
            title,
            type,
            fakeFileName,
            file.name,
            file.mimeType,
            file.sizeBytes || 0,
            file.previewUrl,
            file.downloadUrl,
            file.id
          );
        }
      });
      initTx();
    }

    const societiesFile = path.join(__dirname, '..', 'public', 'data', 'societies.json');
    if (fs.existsSync(societiesFile)) {
      const societies = JSON.parse(fs.readFileSync(societiesFile, 'utf8'));
      const insertSociety = db.prepare(`
        INSERT INTO societies (name, category, description, instagram, website, logo_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const socTx = db.transaction(() => {
        for (const s of societies) {
          const displayName = s.shortName && s.shortName !== s.name ? `${s.shortName} (${s.name})` : s.name;
          insertSociety.run(
            displayName,
            s.category || 'General',
            s.description || null,
            s.instagramUrl || s.handle || null,
            s.website || null,
            s.profilePhoto || s.fallbackPhoto || null
          );
        }
      });
      socTx();
    }

    db.prepare('INSERT INTO timetables (title, url, year, branch, note) VALUES (?,?,?,?,?)').run(
      'Campus Interactive Timetable', '/timetable', null, 'ALL', 'Interactive timetable viewer with all batches'
    );
  }
} catch (seedErr) {
  console.warn('Auto-seed warning:', seedErr.message);
}

// Safe migrations for Drive integration
try { db.exec('ALTER TABLE resources ADD COLUMN preview_url TEXT;'); } catch (_) {}
try { db.exec('ALTER TABLE resources ADD COLUMN download_url TEXT;'); } catch (_) {}
try { db.exec('ALTER TABLE resources ADD COLUMN drive_id TEXT;'); } catch (_) {}

module.exports = db;
