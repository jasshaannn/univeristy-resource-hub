// UniFold API Service Client
// Handles communication between the React frontend and the Express/SQLite backend.

export const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Resolves a file or download URL correctly (handling relative backend paths and external links).
 */
export function resolveFileUrl(url) {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn(`[API] Request failed for ${endpoint}:`, err.message);
    throw err;
  }
}

// 1. Backend Health Check
export async function checkBackendHealth() {
  return request('/api/health');
}

// 2. Stats
export async function getStats() {
  return request('/api/stats');
}

// 3. Subjects
export async function getSubjects(params = {}) {
  const query = new URLSearchParams();
  if (params.year) query.append('year', params.year);
  if (params.semester) query.append('semester', params.semester);
  if (params.branch) query.append('branch', params.branch);
  if (params.q) query.append('q', params.q);

  const qs = query.toString();
  return request(`/api/subjects${qs ? `?${qs}` : ''}`);
}

export async function getSubjectDetails(subjectId) {
  return request(`/api/subjects/${subjectId}`);
}

// 4. Resources
export async function getResources(params = {}) {
  const query = new URLSearchParams();
  if (params.year) query.append('year', params.year);
  if (params.subject_id) query.append('subject_id', params.subject_id);
  if (params.type) query.append('type', params.type);
  if (params.q) query.append('q', params.q);

  const qs = query.toString();
  return request(`/api/resources${qs ? `?${qs}` : ''}`);
}

// 5. Societies
export async function getSocieties(params = {}) {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);

  const qs = query.toString();
  return request(`/api/societies${qs ? `?${qs}` : ''}`);
}

// 6. Timetables
export async function getTimetableHierarchy() {
  return request('/api/timetable/years');
}

export async function getTimetableBatches(year, branch) {
  const query = new URLSearchParams();
  if (year) query.append('year', year);
  if (branch) query.append('branch', branch);
  return request(`/api/timetable/batches?${query.toString()}`);
}

export async function getTimetableBatch(batchCode) {
  return request(`/api/timetable/batch/${encodeURIComponent(batchCode)}`);
}

export async function getFullTimetableData(year) {
  const qs = year ? `?year=${encodeURIComponent(year)}` : '';
  return request(`/api/timetable/data${qs}`);
}

// 7. Authentication
export async function loginUser(id, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  });
}
