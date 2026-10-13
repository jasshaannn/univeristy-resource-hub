/* global process */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the common sync logic
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { runSync, DEFAULT_DRIVE_FOLDER_URL } = require('./sync-drive.js');

console.log(`Default Drive Folder: ${DEFAULT_DRIVE_FOLDER_URL}`);
runSync({ syncDb: true }).catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
