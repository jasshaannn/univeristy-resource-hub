# UniFold - University Resource Hub (Fullstack)

A modern campus operating system connecting students with academic study materials, timetable schedules, campus societies, and events.

- **Frontend**: React 19 + Vite (Port `5173`)
- **Backend**: Express + SQLite (better-sqlite3) + Multer (Port `5001`)

---

## ⚡ Quick Start (Run Both in 1 Step)

From the root project directory:

```bash
npm run dev
```
*(or `node start.js`)*

This starts both the backend API and the frontend development server concurrently with color-coded unified terminal output!

- 💻 **Frontend App**: [http://localhost:5173](http://localhost:5173)
- ⚙️ **Backend API**: [http://localhost:5001](http://localhost:5001)
- 🛡️ **Admin Portal**: [http://localhost:5001/admin](http://localhost:5001/admin)

Press `Ctrl + C` at any time to gracefully stop both servers.

---

## 🛠️ Running Services Separately (Optional)

If you or your friend prefer running each part in its own terminal window:

### 1. Terminal 1 - Backend
```bash
cd "uni fold backend"
npm run dev
```
Runs on `http://localhost:5001`.

### 2. Terminal 2 - Frontend
```bash
cd "uni fold frontend"
npm run dev
```
Runs on `http://localhost:5173`.

---

## 🔗 How the Frontend and Backend are Connected

1. **Vite Development Proxy (`vite.config.js`)**:
   - Any request to `/api/*` or `/files/*` from the frontend is automatically forwarded to the backend at `http://localhost:5001`.
   - Avoids any CORS issues during local development.

2. **Frontend Environment Variable (`.env`)**:
   - `VITE_API_URL=http://localhost:5001` is configured in `uni fold frontend/.env`.

3. **API Client Service (`src/services/api.js`)**:
   - Provides clean helper functions for fetching stats, subjects, resource documents, societies, timetable batches, and authentication.

4. **Live Connected Features**:
   - **Live Stats**: Shows total subjects (23), files & PYQs (467), active societies (41), and batches (500+).
   - **Study Material**: Live subjects from the database with Year filter (All, Year 1, Year 2, Year 3, Year 4), search, and a dialog showing all downloadable PDF, PPT, and Notes files.
   - **Timetable**: Real schedule data for 500+ batches across years and branches (e.g., `1C11`, `1A1`, etc.).
   - **Societies**: Real university societies loaded from the database with category filters, descriptions, and direct links to official Instagram handles.
   - **Authentication**: Supports both student demo preview and secure Administrator login.

---

## 🔐 Admin Credentials & Security

To upload new files, add subjects, or manage societies:
- Configure your credentials in `uni fold backend/.env` (which is git-ignored and never committed to GitHub):
  - `ADMIN_ID=your_admin_id`
  - `ADMIN_PASSWORD=your_strong_password`
  - `ADMIN_KEY=your_secret_token_key`
- In production (e.g. Render / Railway / Vercel), set these in your hosting provider's **Environment Variables** dashboard.
