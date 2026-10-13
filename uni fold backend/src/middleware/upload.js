const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const EXT_TO_TYPE = {
  '.pdf': 'pdf',
  '.ppt': 'ppt',
  '.pptx': 'ppt',
  '.pps': 'ppt',
  '.ppsx': 'ppt',
  '.doc': 'notes',
  '.docx': 'notes',
  '.txt': 'notes',
  '.md': 'notes',
  '.jpg': 'notes',
  '.jpeg': 'notes',
  '.png': 'notes',
  '.zip': 'other',
  '.xls': 'other',
  '.xlsx': 'other',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const maxMb = Number(process.env.MAX_FILE_MB) || 50;

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!EXT_TO_TYPE[ext]) {
      return cb(new Error(`File type "${ext || 'unknown'}" is not allowed`));
    }
    cb(null, true);
  },
});

function guessType(originalName) {
  return EXT_TO_TYPE[path.extname(originalName).toLowerCase()] || 'other';
}

module.exports = { upload, guessType, UPLOAD_DIR };
