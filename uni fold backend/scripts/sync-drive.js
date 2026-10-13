/* global process */
const fs = require('fs');
const path = require('path');

loadDotEnv(path.join(__dirname, '../.env'));

const DEFAULT_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1_Trg4SuokK5TVUA6JKE0PVL1lGvC-S2U?usp=sharing';
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const API_KEY_ENV = process.env.GOOGLE_API_KEY;
const FOLDER_URL_ENV = process.env.DRIVE_FOLDER_URL || DEFAULT_DRIVE_FOLDER_URL;

function loadDotEnv(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return;
  }
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex < 1) continue;
    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Create output directory if not exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function extractFolderIdFromUrl(folderUrlOrId) {
  if (!folderUrlOrId) return null;
  if (!folderUrlOrId.includes('/')) return folderUrlOrId.trim();
  const folderMatch = folderUrlOrId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) return folderMatch[1];
  const queryMatch = folderUrlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch && queryMatch[1]) return queryMatch[1];
  return null;
}

/**
 * Fetches children using Google Drive API v3 (when API Key is provided)
 */
async function listPublicFolderChildren(apiKey, folderId, pageToken) {
  const queryParams = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)',
    pageSize: '1000',
    key: apiKey
  });

  if (pageToken) {
    queryParams.set('pageToken', pageToken);
  }

  const filesRes = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`);
  if (!filesRes.ok) {
    const errText = await filesRes.text();
    throw new Error(`Failed to list files for folder ${folderId}: ${errText}`);
  }

  return filesRes.json();
}

/**
 * Sync using Google Drive API key
 */
async function syncRealDrive(apiKey, rootFolderId) {
  console.log(`Using public Drive folder id: ${rootFolderId} with Google Drive API v3`);
  const tree = { id: rootFolderId, name: 'Root', type: 'folder', path: '', children: {} };
  const files = {};
  const searchIndex = [];
  let folderCount = 0;
  let fileCount = 0;
  let totalBytes = 0;

  const queue = [{ id: rootFolderId, node: tree, path: '' }];

  while (queue.length > 0) {
    const current = queue.shift();
    console.log(`Traversing folder: ${current.node.name} (${current.id})`);

    let pageToken = null;
    do {
      const data = await listPublicFolderChildren(apiKey, current.id, pageToken);
      pageToken = data.nextPageToken;

      for (const file of data.files || []) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

        if (isFolder) {
          folderCount++;
          const folderPath = current.path ? `${current.path}/${file.name}` : file.name;
          const subFolderNode = {
            id: file.id,
            name: file.name,
            type: 'folder',
            path: folderPath,
            children: {}
          };
          current.node.children[file.name] = subFolderNode;
          queue.push({ id: file.id, node: subFolderNode, path: folderPath });
        } else {
          fileCount++;
          const sizeInBytes = parseInt(file.size || '0', 10);
          totalBytes += sizeInBytes;

          let readableSize = '0 KB';
          if (sizeInBytes > 0) {
            const sizeKb = sizeInBytes / 1024;
            if (sizeKb > 1024) {
              readableSize = (sizeKb / 1024).toFixed(1) + ' MB';
            } else {
              readableSize = Math.round(sizeKb) + ' KB';
            }
          }

          const filePath = current.path ? `${current.path}/${file.name}` : file.name;

          files[file.id] = {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: readableSize,
            sizeBytes: sizeInBytes,
            modifiedTime: file.modifiedTime || new Date().toISOString(),
            parent: current.id,
            path: filePath,
            previewUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/preview`,
            downloadUrl: file.webContentLink || `https://drive.google.com/uc?export=download&id=${file.id}`
          };

          searchIndex.push({
            id: file.id,
            name: file.name,
            path: filePath,
            mimeType: file.mimeType,
            parent: current.id
          });
        }
      }
    } while (pageToken);
  }

  let finalStorageSize = '0 KB';
  const totalKb = totalBytes / 1024;
  if (totalKb > 1024) {
    finalStorageSize = (totalKb / 1024).toFixed(1) + ' MB';
  } else {
    finalStorageSize = Math.round(totalKb) + ' KB';
  }

  const stats = {
    totalFolders: folderCount,
    totalFiles: fileCount,
    lastSyncTime: new Date().toISOString(),
    totalStorageSize: finalStorageSize,
    syncSource: 'google-api'
  };

  saveDatasets(tree, files, searchIndex, stats);
  return { tree, files, searchIndex, stats };
}

/**
 * Public Drive Web Crawler: fetches items from publicly shared folder without needing API key!
 */
async function fetchPublicDriveItems(folderId) {
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching folder ${folderId}`);
  }

  const text = await res.text();
  const initData = [...text.matchAll(/AF_initDataCallback\((.*?)\);\s*<\/script>/gs)];
  const ds4 = initData.find(m => m[1].includes('ds:4'));
  if (!ds4) return [];

  let parsed;
  try {
    const fn = new Function('return (' + ds4[1] + ')');
    parsed = fn();
  } catch {
    return [];
  }

  const items = [];
  function search(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      if (Array.isArray(obj[0]) && obj[0][0] === null && typeof obj[0][1] === 'string' && obj[0][1].length > 15 && typeof obj[4] === 'string') {
        const id = obj[0][1];
        const mimeType = obj[4];
        let name = obj[35]?.[0]?.[0]?.[0] || 'Untitled';
        let size = '0 KB';
        let sizeBytes = 0;
        let modified = '';

        if (Array.isArray(obj[24]?.[2])) {
          for (const col of obj[24][2]) {
            if (col[0] === 1) size = col[2]?.[1]?.[0]?.[0]?.[0] || col[2]?.[0]?.[0]?.[0] || size;
            if (col[0] === 2) modified = col[2]?.[1]?.[0]?.[0]?.[0] || col[2]?.[0]?.[0]?.[0] || modified;
            if (col[0] === 16 && (name === 'Untitled' || !name)) name = col[2]?.[1]?.[0]?.[0]?.[0] || name;
          }
        }

        // Parse approximate size bytes
        if (size.includes('MB')) {
          sizeBytes = Math.round(parseFloat(size) * 1024 * 1024);
        } else if (size.includes('KB')) {
          sizeBytes = Math.round(parseFloat(size) * 1024);
        } else if (size.includes('GB')) {
          sizeBytes = Math.round(parseFloat(size) * 1024 * 1024 * 1024);
        }

        items.push({ id, mimeType, name, size, sizeBytes, modified });
        return;
      }
      for (const child of obj) search(child);
    }
  }

  search(parsed.data);
  return items;
}

/**
 * Sync using Public Drive Web Crawler
 */
async function syncPublicDriveWeb(rootFolderId) {
  console.log(`--- Syncing with Public Google Drive Web Crawler (Folder: ${rootFolderId}) ---`);
  const tree = { id: rootFolderId, name: 'university resources', type: 'folder', path: '', children: {} };
  const files = {};
  const searchIndex = [];
  let folderCount = 0;
  let fileCount = 0;
  let totalBytes = 0;

  const queue = [{ id: rootFolderId, node: tree, path: '' }];
  const visited = new Set([rootFolderId]);

  while (queue.length > 0) {
    const current = queue.shift();
    console.log(`Traversing folder: ${current.node.name} (${current.id})`);

    const children = await fetchPublicDriveItems(current.id);

    for (const item of children) {
      const isFolder = item.mimeType === 'application/vnd.google-apps.folder';

      if (isFolder) {
        if (!visited.has(item.id)) {
          visited.add(item.id);
          folderCount++;
          const folderPath = current.path ? `${current.path}/${item.name}` : item.name;
          const subFolderNode = {
            id: item.id,
            name: item.name,
            type: 'folder',
            path: folderPath,
            children: {}
          };
          current.node.children[item.name] = subFolderNode;
          queue.push({ id: item.id, node: subFolderNode, path: folderPath });
        }
      } else {
        fileCount++;
        totalBytes += item.sizeBytes || 0;
        const filePath = current.path ? `${current.path}/${item.name}` : item.name;

        files[item.id] = {
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          size: item.size,
          sizeBytes: item.sizeBytes,
          modifiedTime: item.modified || new Date().toISOString(),
          parent: current.id,
          path: filePath,
          previewUrl: `https://drive.google.com/file/d/${item.id}/preview`,
          downloadUrl: `https://drive.google.com/uc?export=download&id=${item.id}`
        };

        searchIndex.push({
          id: item.id,
          name: item.name,
          path: filePath,
          mimeType: item.mimeType,
          parent: current.id
        });
      }
    }
  }

  let finalStorageSize = '0 KB';
  const totalKb = totalBytes / 1024;
  if (totalKb > 1024) {
    finalStorageSize = (totalKb / 1024).toFixed(1) + ' MB';
  } else {
    finalStorageSize = Math.round(totalKb) + ' KB';
  }

  const stats = {
    totalFolders: folderCount,
    totalFiles: fileCount,
    lastSyncTime: new Date().toISOString(),
    totalStorageSize: finalStorageSize,
    syncSource: 'public-drive-crawler'
  };

  saveDatasets(tree, files, searchIndex, stats);
  return { tree, files, searchIndex, stats };
}

/**
 * Saves JSON files to public/data/
 */
function saveDatasets(tree, files, searchIndex, stats) {
  fs.writeFileSync(path.join(OUTPUT_DIR, 'tree.json'), JSON.stringify(tree, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), JSON.stringify(files, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'search.json'), JSON.stringify(searchIndex, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'stats.json'), JSON.stringify(stats, null, 2));
  console.log(`Datasets saved to ${OUTPUT_DIR}/ (Total: ${stats.totalFolders} folders, ${stats.totalFiles} files).`);
}

/**
 * Local fallback mock data generator
 */
function generateMockData() {
  const rootFolderId = 'folder_root';
  const tree = {
    id: rootFolderId,
    name: 'Root',
    type: 'folder',
    path: '',
    children: {
      'Year 1': {
        id: 'folder_year1',
        name: 'Year 1',
        type: 'folder',
        path: 'Year 1',
        children: {
          'Chemistry': {
            id: 'folder_chem',
            name: 'Chemistry_UCB009',
            type: 'folder',
            path: 'Year 1/Chemistry_UCB009',
            children: {}
          }
        }
      }
    }
  };

  const files = {
    'mock_file_1': {
      id: 'mock_file_1',
      name: '0. Syllabus.pdf',
      mimeType: 'application/pdf',
      size: '80 KB',
      sizeBytes: 81920,
      modifiedTime: new Date().toISOString(),
      parent: 'folder_chem',
      path: 'Year 1/Chemistry_UCB009/0. Syllabus.pdf',
      previewUrl: 'https://drive.google.com/file/d/mock_file_1/preview',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=mock_file_1'
    }
  };

  const searchIndex = Object.values(files).map(f => ({
    id: f.id,
    name: f.name,
    path: f.path,
    mimeType: f.mimeType,
    parent: f.parent
  }));

  const stats = {
    totalFolders: 2,
    totalFiles: 1,
    lastSyncTime: new Date().toISOString(),
    totalStorageSize: '80 KB',
    syncSource: 'mock-fallback'
  };

  saveDatasets(tree, files, searchIndex, stats);
  return { tree, files, searchIndex, stats };
}

/**
 * Syncs the crawled Drive hierarchy into the SQLite database (`subjects` and `resources` tables)
 */
function syncToDatabase(tree, files) {
  try {
    const db = require('../src/db');
    console.log('--- Syncing Drive data into SQLite Database ---');

    // Parse subject info helper
    function parseSubjectFromPath(filePath) {
      const parts = filePath.split('/');
      let year = 1;
      let branch = 'ALL';
      let subjectName = 'General';
      let subjectCode = null;

      // Check year
      for (const p of parts) {
        const yMatch = p.match(/Year\s*([1-5])/i);
        if (yMatch) year = parseInt(yMatch[1], 10);
      }

      // If parts length >= 2
      if (parts.length >= 2) {
        // e.g. Year 1/Pool A/Chemistry_UCB009/file.pdf -> Chemistry_UCB009
        // e.g. Year 1/BioTechnology/file.pdf -> BioTechnology
        const candidate = parts[parts.length - 2];
        const codeMatch = candidate.match(/^(.*?)[_\s]+([A-Z]{2,4}\d{3,4})$/i);
        if (codeMatch) {
          subjectName = codeMatch[1].trim();
          subjectCode = codeMatch[2].trim();
        } else {
          subjectName = candidate;
        }

        // Branch detection
        if (parts.some(p => p.includes('Computer Science') || p.includes('CSE'))) branch = 'CSE';
        else if (parts.some(p => p.includes('BioTechnology'))) branch = 'BT';
        else if (parts.some(p => p.includes('Data Science'))) branch = 'DS';
        else if (parts.some(p => p.includes('Pool A') || p.includes('Pool B'))) branch = 'ALL';
      }

      return { year, branch, subjectName, subjectCode };
    }

    // Helper to guess resource type
    function guessType(name) {
      const ext = path.extname(name).toLowerCase();
      if (ext === '.pdf') return 'pdf';
      if (['.ppt', '.pptx'].includes(ext)) return 'ppt';
      if (['.doc', '.docx', '.txt', '.md'].includes(ext)) return 'notes';
      return 'other';
    }

    const findSubjectStmt = db.prepare('SELECT id FROM subjects WHERE name = ? AND year = ?');
    const insertSubjectStmt = db.prepare('INSERT INTO subjects (name, code, year, semester, branch) VALUES (?, ?, ?, ?, ?)');
    const findResourceStmt = db.prepare('SELECT id FROM resources WHERE drive_id = ?');
    const insertResourceStmt = db.prepare(
      `INSERT INTO resources (subject_id, title, type, file_name, original_name, mime_type, size_bytes, preview_url, download_url, drive_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let insertedSubjects = 0;
    let insertedResources = 0;

    const fileEntries = Object.values(files);

    const transaction = db.transaction(() => {
      for (const file of fileEntries) {
        const { year, branch, subjectName, subjectCode } = parseSubjectFromPath(file.path);

        let subject = findSubjectStmt.get(subjectName, year);
        if (!subject) {
          const semester = year * 2 - 1; // default odd sem
          const info = insertSubjectStmt.run(subjectName, subjectCode, year, semester, branch);
          subject = { id: info.lastInsertRowid };
          insertedSubjects++;
        }

        const existingRes = findResourceStmt.get(file.id);
        if (!existingRes) {
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
          insertedResources++;
        }
      }
    });

    transaction();
    console.log(`SQLite DB Updated! Inserted ${insertedSubjects} new subjects and ${insertedResources} resources.`);
  } catch (err) {
    console.error('Failed to sync to database:', err.message);
  }
}

/**
 * Main execution function
 */
async function runSync(options = {}) {
  const rootFolderId = extractFolderIdFromUrl(FOLDER_URL_ENV);
  if (!rootFolderId) {
    console.error('Invalid DRIVE_FOLDER_URL:', FOLDER_URL_ENV);
    return generateMockData();
  }

  let result;
  if (API_KEY_ENV) {
    try {
      console.log('--- Attempting sync with Google Drive API v3 key ---');
      result = await syncRealDrive(API_KEY_ENV, rootFolderId);
    } catch (apiErr) {
      console.warn('Google Drive API failed, falling back to public web crawler:', apiErr.message);
      result = await syncPublicDriveWeb(rootFolderId);
    }
  } else {
    try {
      result = await syncPublicDriveWeb(rootFolderId);
    } catch (crawlErr) {
      console.warn('Public crawler failed, falling back to mock data:', crawlErr.message);
      result = generateMockData();
    }
  }

  const shouldSyncDb = options.syncDb || process.argv.includes('--sync-db');
  if (shouldSyncDb && result) {
    syncToDatabase(result.tree, result.files);
  }

  return result;
}

if (require.main === module) {
  runSync().catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
}

module.exports = {
  runSync,
  syncPublicDriveWeb,
  syncRealDrive,
  syncToDatabase,
  extractFolderIdFromUrl,
  DEFAULT_DRIVE_FOLDER_URL
};
