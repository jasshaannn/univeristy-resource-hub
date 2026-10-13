require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

require('./db'); // creates the tables on first run
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded files are viewable directly: http://localhost:5000/files/<file_name>
app.use('/files', express.static(UPLOAD_DIR));

// Simple admin page (upload / add data without Postman)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/timetable', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'timetable.html')));
app.get('/resources', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'resources.html')));
app.get('/societies', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'societies.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/', (_req, res) => res.redirect('/timetable'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const { timetables, societies } = require('./routes/links');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/timetables', timetables);
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/societies', societies);
app.use('/api/stats', require('./routes/stats'));
app.use('/api/drive', require('./routes/drive'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route not found' }));

// Central error handler (upload errors become clean 400s)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err.message && err.message.includes('is not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const adminId = process.env.ADMIN_ID || process.env.ADMIN_USERNAME || 'admin';
    console.log(`API running on http://localhost:${PORT}`);
    console.log(`Timetable:       http://localhost:${PORT}/timetable`);
    console.log(`Resources:       http://localhost:${PORT}/resources`);
    console.log(`Societies:       http://localhost:${PORT}/societies`);
    console.log(`Admin Portal:    http://localhost:${PORT}/admin`);
    console.log(`Admin Login:     ID="${adminId}" (Password configured in .env)`);
  });
}

module.exports = app;
