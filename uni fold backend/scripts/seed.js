// Optional: fills the database with a few demo rows so the frontend has something to show.
// Run with:  npm run seed
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const db = require('../src/db');

const subjects = db.prepare('SELECT COUNT(*) n FROM subjects').get().n;
if (subjects > 0) {
  console.log('Database already has data, skipping seed.');
  process.exit(0);
}

const addSubject = db.prepare('INSERT INTO subjects (name, code, year, semester, branch) VALUES (?,?,?,?,?)');
[
  ['Object Oriented Programming', 'UTA018', 1, 2, 'ALL'],
  ['Engineering Design Project', 'UTA016', 1, 2, 'ALL'],
  ['Data Structures and Algorithms', 'UCS406', 2, 3, 'CSE'],
].forEach((s) => addSubject.run(...s));

db.prepare('INSERT INTO timetables (title, url, year, branch, note) VALUES (?,?,?,?,?)').run(
  'Campus Interactive Timetable', '/timetable', null, 'ALL', 'Interactive timetable viewer with all batches, branches and quick search'
);

const societiesFile = path.join(__dirname, '..', 'data', 'societies.json');
let societiesCount = 0;
if (fs.existsSync(societiesFile)) {
  const societies = JSON.parse(fs.readFileSync(societiesFile, 'utf-8'));
  const insertSociety = db.prepare(`
    INSERT INTO societies (name, category, description, instagram, website, logo_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
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
  societiesCount = societies.length;
}

console.log(`Seeded demo subjects, 1 timetable link and ${societiesCount} TIET societies.`);
