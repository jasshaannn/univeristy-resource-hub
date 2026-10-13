const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const TIMETABLE_FILE = path.join(__dirname, '../../public/data/timetable.json');

let cachedData = null;
let cachedHierarchy = null;
let batchIndex = null;
let lastMtime = 0;

function loadData() {
  if (!fs.existsSync(TIMETABLE_FILE)) {
    return null;
  }
  const stat = fs.statSync(TIMETABLE_FILE);
  if (cachedData && stat.mtimeMs === lastMtime) {
    return cachedData;
  }

  try {
    const raw = fs.readFileSync(TIMETABLE_FILE, 'utf8');
    cachedData = JSON.parse(raw);
    lastMtime = stat.mtimeMs;

    // Build hierarchy and lookup index
    batchIndex = new Map();
    cachedHierarchy = [];

    for (const [year, branches] of Object.entries(cachedData)) {
      const yearObj = { year, branches: [] };
      for (const [branch, batches] of Object.entries(branches)) {
        const batchList = Object.keys(batches).sort();
        yearObj.branches.push({
          branch,
          batchCount: batchList.length,
          batches: batchList,
        });
        for (const [code, days] of Object.entries(batches)) {
          batchIndex.set(code.toUpperCase(), {
            year,
            branch,
            code,
            days,
          });
        }
      }
      cachedHierarchy.push(yearObj);
    }

    return cachedData;
  } catch (err) {
    console.error('Failed to load timetable.json:', err);
    return null;
  }
}

// Ensure loaded initially
loadData();

// GET /api/timetable/data - Full timetable dataset (or single year via ?year=)
router.get('/data', (req, res) => {
  const data = loadData();
  if (!data) {
    return res.status(404).json({ error: 'Timetable data not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');

  const { year } = req.query;
  if (year) {
    const yrKey = Object.keys(data).find(
      (y) => y.toLowerCase() === year.toLowerCase() || y.startsWith(year)
    );
    if (!yrKey) {
      return res.status(404).json({ error: `Year ${year} not found` });
    }
    return res.json({ [yrKey]: data[yrKey] });
  }

  res.json(data);
});

// GET /api/timetable/years - Returns years, branches, and batch counts
router.get('/years', (_req, res) => {
  loadData();
  if (!cachedHierarchy) {
    return res.status(404).json({ error: 'Timetable data not available' });
  }
  res.json(
    cachedHierarchy.map((y) => ({
      year: y.year,
      branches: y.branches.map((b) => ({
        branch: b.branch,
        batchCount: b.batchCount,
      })),
    }))
  );
});

// GET /api/timetable/batches - Filter batches by year and branch
router.get('/batches', (req, res) => {
  loadData();
  const { year, branch } = req.query;
  if (!cachedHierarchy) {
    return res.status(404).json({ error: 'Timetable data not available' });
  }

  let results = [];
  for (const y of cachedHierarchy) {
    if (year && y.year.toLowerCase() !== year.toLowerCase() && !y.year.startsWith(year)) {
      continue;
    }
    for (const b of y.branches) {
      if (branch && b.branch.toLowerCase() !== branch.toLowerCase()) {
        continue;
      }
      results.push(...b.batches.map((code) => ({ code, year: y.year, branch: b.branch })));
    }
  }

  res.json(results);
});

// GET /api/timetable/batch/:code - Fast lookup of a single batch schedule
router.get('/batch/:code', (req, res) => {
  loadData();
  const code = (req.params.code || '').trim().toUpperCase();
  if (!batchIndex || !batchIndex.has(code)) {
    return res.status(404).json({ error: `Batch code ${code} not found` });
  }

  const batch = batchIndex.get(code);
  res.json({
    found: true,
    code: batch.code,
    year: batch.year,
    branch: batch.branch,
    days: batch.days,
  });
});

// GET /api/timetable/search?q=1A - Batch search
router.get('/search', (req, res) => {
  loadData();
  const q = (req.query.q || '').trim().toUpperCase();
  if (!q) {
    return res.json([]);
  }

  const results = [];
  for (const [code, info] of batchIndex.entries()) {
    if (code.includes(q)) {
      results.push({
        code: info.code,
        year: info.year,
        branch: info.branch,
      });
      if (results.length >= 25) break;
    }
  }

  res.json(results);
});

function timeToMinutes(t) {
  if (!t) return 0;
  const m = String(t).match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function escapeIcs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}${m}${day}T${h}${min}${s}`;
}

const DAY_OFFSETS = {
  MONDAY: { offset: 0, byDay: 'MO' },
  TUESDAY: { offset: 1, byDay: 'TU' },
  WEDNESDAY: { offset: 2, byDay: 'WE' },
  THURSDAY: { offset: 3, byDay: 'TH' },
  FRIDAY: { offset: 4, byDay: 'FR' },
  SATURDAY: { offset: 5, byDay: 'SA' },
  SUNDAY: { offset: 6, byDay: 'SU' }
};

function generateIcsCalendar(batch, options = {}) {
  const weeks = parseInt(options.weeks, 10) || 18;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//University Resource Hub//Campus Timetable//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Timetable - Batch ${batch.code}`,
    'X-WR-TIMEZONE:Asia/Kolkata',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Kolkata',
    'X-LIC-LOCATION:Asia/Kolkata',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  const now = new Date();
  const nowDay = now.getDay();
  const diffToMon = nowDay === 0 ? -6 : 1 - nowDay;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);

  const untilDate = new Date(monday.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const untilStr = `${untilDate.getUTCFullYear()}${pad(untilDate.getUTCMonth() + 1)}${pad(untilDate.getUTCDate())}T235959Z`;
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  let eventIdx = 0;
  for (const [dayName, sessionList] of Object.entries(batch.days || {})) {
    const normDay = dayName.trim().toUpperCase();
    const dayConfig = DAY_OFFSETS[normDay];
    if (!dayConfig || !Array.isArray(sessionList)) continue;

    const eventDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dayConfig.offset);

    for (const session of sessionList) {
      eventIdx++;
      const startMin = timeToMinutes(session.time);
      const endMin = startMin + 50;

      const startH = Math.floor(startMin / 60);
      const startM = startMin % 60;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;

      const startDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), startH, startM, 0);
      const endDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), endH, endM, 0);

      const dtstart = formatIcsDateTime(startDate);
      const dtend = formatIcsDateTime(endDate);

      const summary = `${session.code ? session.code + ' - ' : ''}${session.name || session.subject || 'Class'} (${session.type || 'Session'})`;
      const room = session.room || 'TBD';
      const description = `Batch: ${batch.code}\nCourse: ${session.name || session.subject || ''}\nCode: ${session.code || ''}\nType: ${session.type || 'Session'}\nRoom: ${room}\nTime: ${session.time}\nCampus Timetable - University Resource Hub`;
      const uid = `tt-${batch.code}-${normDay}-${startH}${startM}-${eventIdx}@campus-resource-hub`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;TZID=Asia/Kolkata:${dtstart}`);
      lines.push(`DTEND;TZID=Asia/Kolkata:${dtend}`);
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${dayConfig.byDay};UNTIL=${untilStr}`);
      lines.push(`SUMMARY:${escapeIcs(summary)}`);
      lines.push(`LOCATION:${escapeIcs(room)}`);
      lines.push(`DESCRIPTION:${escapeIcs(description)}`);
      lines.push('STATUS:CONFIRMED');
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Class reminder: ${escapeIcs(session.name || session.subject || 'Class')}`);
      lines.push('TRIGGER:-PT15M');
      lines.push('END:VALARM');
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function handleIcsExport(req, res) {
  loadData();
  const rawCode = (req.params.code || '').replace(/\.ics$/i, '');
  const code = rawCode.trim().toUpperCase();
  if (!batchIndex || !batchIndex.has(code)) {
    return res.status(404).json({ error: `Batch code ${code} not found` });
  }

  const batch = batchIndex.get(code);
  const icsData = generateIcsCalendar(batch, req.query);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${batch.code}-timetable.ics"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(icsData);
}

// iCalendar export endpoints
router.get('/batch/:code/calendar.ics', handleIcsExport);
router.get('/batch/:code/export.ics', handleIcsExport);
router.get('/batch/:code.ics', handleIcsExport);
router.get('/export/:code.ics', handleIcsExport);

module.exports = router;
