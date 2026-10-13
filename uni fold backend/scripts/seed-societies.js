// Seed TIET student societies into the SQLite database
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const db = require('../src/db');

const societiesFile = path.join(__dirname, '..', 'data', 'societies.json');
if (!fs.existsSync(societiesFile)) {
  console.error(`Error: ${societiesFile} not found.`);
  process.exit(1);
}

const societies = JSON.parse(fs.readFileSync(societiesFile, 'utf-8'));

const insert = db.prepare(`
  INSERT INTO societies (name, category, description, instagram, website, logo_url)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Delete old placeholder rows if desired, or insert if empty
const count = db.prepare('SELECT COUNT(*) as n FROM societies').get().n;
if (count > 0) {
  console.log(`Clearing ${count} existing rows from societies table...`);
  db.prepare('DELETE FROM societies').run();
}

const insertMany = db.transaction((list) => {
  for (const s of list) {
    const displayName = s.shortName && s.shortName !== s.name 
      ? `${s.shortName} (${s.name})` 
      : s.name;
    insert.run(
      displayName,
      s.category || 'General',
      s.description || null,
      s.instagramUrl || s.handle || null,
      s.website || null,
      s.profilePhoto || s.fallbackPhoto || null
    );
  }
});

insertMany(societies);

const total = db.prepare('SELECT COUNT(*) as n FROM societies').get().n;
console.log(`Successfully seeded ${total} TIET societies into database!`);
