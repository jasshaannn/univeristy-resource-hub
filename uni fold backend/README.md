# University Resources Backend

Express + SQLite backend for the university resources website.
It stores year-wise **subjects**, their **PDFs / PPTs / notes** (real file uploads), **timetable website links** and **society handles**, and exposes them as a JSON API for the frontend.

## Quick start

```bash
cd uni-resources-backend
npm install
cp .env.example .env        # configure ADMIN_ID and ADMIN_PASSWORD
npm run seed                # optional: demo data
npm start                   # http://localhost:5001
```

Open **http://localhost:5001/admin** and sign in with your Admin credentials:
- **Admin ID**: `` (or whatever is set in `.env` `ADMIN_ID`)
- **Password**: `` (or whatever is set in `.env` `ADMIN_PASSWORD`)

Only when the entered ID and password match will access to the admin portal be granted:

1. Add a subject (pick the year)
2. Upload PDF / PPT / notes to that subject
3. Add timetable website links
4. Add society handles (Instagram, LinkedIn, etc.)

No Postman needed.

## Folder structure

```
src/
  server.js              app setup, CORS, static files, error handling
  db.js                  SQLite tables (auto-created on first run)
  middleware/auth.js     ADMIN_KEY check for write routes
  middleware/upload.js   multer config (allowed types, size limit)
  routes/subjects.js     subjects CRUD
  routes/resources.js    file upload / list / download / delete
  routes/links.js        timetables + societies CRUD
  routes/stats.js        counts for the home page
  routes/drive.js        Google Drive synced data endpoints (tree, files, search)
public/admin.html        upload & drive sync panel
public/data/             synced JSON datasets (tree.json, files.json, stats.json)
scripts/sync-drive.js    Google Drive crawler & SQLite syncer
uploads/                 uploaded files live here
data/resources.db        the database file
```

## API reference (what your frontend friend needs)

Base URL in development: `http://localhost:5000`

Reading is public. Writing needs the header `x-admin-key: <ADMIN_KEY>`.

### Stats (home page counters)

| Method | Route | Returns |
|---|---|---|
| GET | `/api/stats` | `{ totals: {subjects, resources, pdf, ppt, notes, timetables, societies, downloads}, years: [{year, subjects, resources, pdf, ppt, notes}] }` |

### Subjects

| Method | Route | Notes |
|---|---|---|
| GET | `/api/subjects?year=2&semester=3&branch=CSE&q=data` | All filters optional. Each subject has `total_resources`, `pdf_count`, `ppt_count`, `notes_count` |
| GET | `/api/subjects/:id` | Subject plus `resources: { pdf: [], ppt: [], notes: [], other: [] }` |
| POST | `/api/subjects` (admin) | JSON `{ name, code?, year, semester?, branch? }` |
| PUT | `/api/subjects/:id` (admin) | Any of the fields above |
| DELETE | `/api/subjects/:id` (admin) | Also deletes its files |

### Resources (files)

| Method | Route | Notes |
|---|---|---|
| GET | `/api/resources?year=2&subject_id=5&type=pdf&q=unit` | All filters optional |
| POST | `/api/resources` (admin) | `multipart/form-data`: `file`, `subject_id`, `title?`, `type?` (auto-detected from extension) |
| GET | `/api/resources/:id/download` | Forces download and increments the download counter |
| DELETE | `/api/resources/:id` (admin) | Removes the row and the file |

Each resource includes `url` (open in browser, e.g. `/files/abc.pdf`) and `download_url`. Prefix both with the API base URL.

- **Interactive Resources & Folder Explorer**: Available directly in the browser at [`/resources`](http://localhost:5001/resources). Allows students to browse year-wise subject folders, filter by file type (PDF/PPT/Notes), search files in real time, and download or preview resources across mobile and desktop.

### Timetables

- **Interactive Timetable UI**: Available directly in the browser at [`/timetable`](http://localhost:5001/timetable). Features full interactive schedule grids for 500+ batches, search/quick-find, day-highlighting, sticky mobile time column & weekday navigation tabs, direct URL sharing (`?batch=1A11`), and print/PDF support.

| Method | Route | Notes |
|---|---|---|
| GET | `/timetable` | Serves the interactive Timetable Web App |
| GET | `/api/timetable/data` | Full JSON dataset with 500+ batches across all years & branches (supports `?year=1st+Year`) |
| GET | `/api/timetable/years` | List of years, branches, and batch counts |
| GET | `/api/timetable/batches?year=1st+Year&branch=CIVIL` | Batches filtered by year/branch |
| GET | `/api/timetable/batch/:code` | Schedule for a specific batch (e.g. `/api/timetable/batch/1A11`) |
| GET | `/api/timetable/search?q=1A` | Search batches by code prefix |
| GET | `/api/timetables?year=2&branch=CSE` | External timetable website links |
| POST / PUT / DELETE | `/api/timetables[/:id]` (admin) | `{ title, url, year?, branch?, note? }` |

### Societies

| Method | Route | Notes |
|---|---|---|
| GET | `/api/societies?category=technical` | |
| POST / PUT / DELETE | `/api/societies[/:id]` (admin) | `{ name, category?, description?, instagram?, linkedin?, website?, email?, logo_url? }` |

### Example frontend calls

```js
const API = 'http://localhost:5000';

// year page: list of subjects with counts
const subjects = await fetch(`${API}/api/subjects?year=2`).then(r => r.json());

// subject page: files grouped by type
const subject = await fetch(`${API}/api/subjects/${id}`).then(r => r.json());
// <a href={API + file.url}>View</a>   <a href={API + file.download_url}>Download</a>

// home page counters
const { totals, years } = await fetch(`${API}/api/stats`).then(r => r.json());
```

## Merging with the frontend: step by step

**Option A (simplest while developing): run both separately**

1. You run `npm start` (port 5000). Your friend runs her frontend (Vite is 5173, Next.js / CRA is 3000).
2. In `.env` set `CORS_ORIGIN` to her dev URL (or leave `*`).
3. She uses the API base URL from the examples above. Put it in an env variable on her side, e.g. `VITE_API_URL=http://localhost:5000`.
4. Agree on the response shapes in this README; she can start building against the demo data from `npm run seed`.

**Option B: one repo**

1. Create a repo with two folders: `backend/` (this project) and `frontend/` (hers).
2. Commit each person's work on their own branch (`backend`, `frontend`), open a pull request into `main` and merge. Since the folders are separate there are no conflicts.
3. Add `.gitignore` entries (already included here) so `node_modules`, `.env`, the database and uploads never get committed.

**Option C: deploy**

1. Backend: deploy to Render or Railway as a Node web service. Set `ADMIN_KEY`, `CORS_ORIGIN` (your frontend URL), and attach a persistent disk for `data/` and `uploads/` (free tiers wipe the disk on redeploy, so uploaded files would vanish without one).
2. Frontend: deploy to Vercel or Netlify with `VITE_API_URL` (or equivalent) set to the backend URL.

## Notes

- Allowed upload types: pdf, ppt/pptx, doc/docx, txt, md, jpg/png, xls/xlsx, zip. Limit is 50 MB, changeable via `MAX_FILE_MB`.
- Never commit `.env`. Anyone with `ADMIN_KEY` can upload and delete.
- To back up everything, copy the `data/` and `uploads/` folders.
