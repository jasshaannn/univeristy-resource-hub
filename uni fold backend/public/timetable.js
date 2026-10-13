// Campus Timetable Controller
(function() {
  'use strict';

  const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const DAY_SHORT = {
    MONDAY: 'MON',
    TUESDAY: 'TUE',
    WEDNESDAY: 'WED',
    THURSDAY: 'THU',
    FRIDAY: 'FRI',
    SATURDAY: 'SAT'
  };

  const TYPE_LABEL = {
    lecture: 'LECTURE',
    practical: 'PRACTICAL',
    tutorial: 'TUTORIAL',
    elective: 'ELECTIVE',
    other: 'SESSION'
  };

  let RAW_DATA = null;
  let DATA = {};
  const batchIndex = {};
  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function getTodayName() {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[new Date().getDay()];
  }

  function classify(subject, typeHint) {
    if (typeHint) {
      const th = String(typeHint).trim().toLowerCase();
      if (th === 'lecture') return 'lecture';
      if (th === 'practical' || th === 'lab') return 'practical';
      if (th === 'tutorial') return 'tutorial';
      if (th === 'elective') return 'elective';
    }
    if (!subject) return 'other';
    const s = String(subject).trim();
    if (/^[A-Z]{2,6}\d{2,4}[A-Z]$/.test(s)) {
      const last = s[s.length - 1];
      if (last === 'L') return 'lecture';
      if (last === 'P') return 'practical';
      if (last === 'T') return 'tutorial';
    }
    if (/^LAB/i.test(s) || /PRACTICAL/i.test(s)) return 'practical';
    if (/TUT/i.test(s)) return 'tutorial';
    if (/LEC/i.test(s)) return 'lecture';
    return 'other';
  }

  function timeToMinutes(t) {
    if (!t) return 0;
    const str = String(t).trim();
    const m = str.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  function fmtTime(t) {
    if (!t) return '';
    const str = String(t).trim();
    if (/AM|PM/i.test(str)) {
      // standard AM/PM format
      return str.replace(/^0(\d:)/, '$1');
    }
    const [hStr, mStr] = str.split(':');
    let h = Number(hStr);
    const m = Number(mStr || 0);
    const ap = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
  }

  function titleCase(s) {
    if (!s) return '';
    return String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  function showToast(msg) {
    let toast = $('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Normalizes diverse JSON structures into:
  // DATA[year][branch][batch] = { branch, days: { MONDAY: [ { time, subject, code, room, type } ] } }
  function normalizeData(source) {
    DATA = {};
    for (const [year, branchesOrBatches] of Object.entries(source)) {
      if (!DATA[year]) DATA[year] = {};

      for (const [key, value] of Object.entries(branchesOrBatches)) {
        // Case A: key is a branch name, value is an object of batches
        // e.g. { "CHEMICAL ENGG": { "1A11": { "Monday": [...] } } }
        if (value && typeof value === 'object' && !value.branch && !value.days && !Array.isArray(value)) {
          const branch = key;
          if (!DATA[year][branch]) DATA[year][branch] = {};

          for (const [batchCode, dayObj] of Object.entries(value)) {
            const normalizedDays = {};
            for (const [dName, sessionList] of Object.entries(dayObj || {})) {
              const normDay = dName.trim().toUpperCase();
              if (Array.isArray(sessionList)) {
                normalizedDays[normDay] = sessionList.map((item) => ({
                  time: item.time,
                  subject: item.name || item.subject || item.code || 'Session',
                  code: item.code || '',
                  room: item.room || '',
                  type: classify(item.code || item.name || item.subject, item.type)
                }));
              }
            }
            DATA[year][branch][batchCode] = {
              branch,
              days: normalizedDays
            };
            batchIndex[batchCode.toUpperCase()] = {
              year,
              branch,
              code: batchCode,
              info: DATA[year][branch][batchCode]
            };
          }
        }
        // Case B: flattened batches with a branch property:
        // e.g. { "1A11": { branch: "CHEMICAL ENGG", days: { ... } } }
        else if (value && typeof value === 'object') {
          const batchCode = key;
          const branch = value.branch || 'General';
          if (!DATA[year][branch]) DATA[year][branch] = {};

          const normalizedDays = {};
          const daysSource = value.days || value;
          for (const [dName, sessionList] of Object.entries(daysSource || {})) {
            const normDay = dName.trim().toUpperCase();
            if (Array.isArray(sessionList)) {
              normalizedDays[normDay] = sessionList.map((item) => ({
                time: item.time,
                subject: item.name || item.subject || item.code || 'Session',
                code: item.code || '',
                room: item.room || '',
                type: classify(item.code || item.name || item.subject, item.type)
              }));
            }
          }

          DATA[year][branch][batchCode] = {
            branch,
            days: normalizedDays
          };
          batchIndex[batchCode.toUpperCase()] = {
            year,
            branch,
            code: batchCode,
            info: DATA[year][branch][batchCode]
          };
        }
      }
    }
  }

  let currentViewMode = localStorage.getItem('tt_view_mode') || 'day';
  let activeDay = localStorage.getItem('tt_active_day') || 'TODAY';

  function fmtEndTime(t, durationMinutes = 50) {
    const startMin = timeToMinutes(t);
    const endMin = startMin + durationMinutes;
    const h = Math.floor(endMin / 60);
    const m = endMin % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
  }

  function calculateTotalHours(sessions) {
    const totalMins = sessions.length * 50;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m class time`;
    if (m === 0) return `${h}h class time`;
    return `${h}h ${m}m class time`;
  }

  function formatMinutesUntil(mins) {
    if (mins <= 1) return 'starting now';
    if (mins < 60) return `in ${mins} mins`;
    const h = Math.floor(mins / 60);
    const rem = mins % 60;
    return `in ${h}h ${rem > 0 ? rem + 'm' : ''}`;
  }

  function createGoogleCalEventUrl(item, dayName, batchCode) {
    const dayMap = {
      MONDAY: { offset: 0, byDay: 'MO' },
      TUESDAY: { offset: 1, byDay: 'TU' },
      WEDNESDAY: { offset: 2, byDay: 'WE' },
      THURSDAY: { offset: 3, byDay: 'TH' },
      FRIDAY: { offset: 4, byDay: 'FR' },
      SATURDAY: { offset: 5, byDay: 'SA' }
    };
    const conf = dayMap[dayName.toUpperCase()] || { offset: 0, byDay: 'MO' };
    const now = new Date();
    const nowDay = now.getDay();
    const diffToMon = nowDay === 0 ? -6 : 1 - nowDay;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
    const eventDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + conf.offset);

    const startMin = timeToMinutes(item.time);
    const endMin = startMin + 50;

    const startH = Math.floor(startMin / 60);
    const startM = startMin % 60;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;

    const pad = (n) => String(n).padStart(2, '0');
    const dStr = `${eventDate.getFullYear()}${pad(eventDate.getMonth() + 1)}${pad(eventDate.getDate())}`;
    const tStart = `${pad(startH)}${pad(startM)}00`;
    const tEnd = `${pad(endH)}${pad(endM)}00`;

    const title = `${item.code ? item.code + ' - ' : ''}${item.subject} (${TYPE_LABEL[item.type] || 'Session'})`;
    const details = `Batch: ${batchCode}\nCourse: ${item.subject}\nCode: ${item.code || ''}\nType: ${TYPE_LABEL[item.type] || 'Session'}\nRoom: ${item.room || ''}\nTimetable: Campus Resource Hub`;
    const location = item.room || '';

    const untilDate = new Date(monday.getTime() + 18 * 7 * 24 * 60 * 60 * 1000);
    const untilStr = `${untilDate.getUTCFullYear()}${pad(untilDate.getUTCMonth() + 1)}${pad(untilDate.getUTCDate())}T235959Z`;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${dStr}T${tStart}/${dStr}T${tEnd}`,
      details: details,
      location: location,
      ctz: 'Asia/Kolkata',
      recur: `RRULE:FREQ=WEEKLY;UNTIL=${untilStr}`
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  async function loadTimetableData() {
    if (window.TT_DATA) {
      return window.TT_DATA;
    }
    try {
      const res = await fetch('/api/timetable/data');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API /api/timetable/data failed, trying fallback...', e);
    }
    try {
      const res = await fetch('/data/timetable.json');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch /data/timetable.json', e);
    }
    return null;
  }

  async function init() {
    els.yearSelect = $('yearSelect');
    els.branchSelect = $('branchSelect');
    els.batchSelect = $('batchSelect');
    els.searchInput = $('searchInput');
    els.grid = $('grid');
    els.emptyState = $('emptyState');
    els.batchMeta = $('batchMeta');
    els.legend = $('legend');
    els.shareBtn = $('shareBtn');
    els.printBtn = $('printBtn');
    els.calendarBtn = $('calendarBtn');

    // View controls & day navigation
    els.viewDayBtn = $('viewDayBtn');
    els.viewWeekBtn = $('viewWeekBtn');
    els.dayNavBar = $('dayNavBar');
    els.dayPills = $('dayPills');
    els.prevDayBtn = $('prevDayBtn');
    els.nextDayBtn = $('nextDayBtn');

    // Day & week containers
    els.dayViewContainer = $('dayViewContainer');
    els.dayHeaderCard = $('dayHeaderCard');
    els.dayTimeline = $('dayTimeline');
    els.weekViewContainer = $('weekViewContainer');

    // Calendar modal elements
    els.calendarModal = $('calendarModal');
    els.modalBatchTag = $('modalBatchTag');
    els.closeCalendarModal = $('closeCalendarModal');
    els.appleSubscribeBtn = $('appleSubscribeBtn');
    els.appleDownloadBtn = $('appleDownloadBtn');
    els.googleSubscribeBtn = $('googleSubscribeBtn');
    els.googleImportSettingsBtn = $('googleImportSettingsBtn');
    els.calFeedInput = $('calFeedInput');
    els.copyCalFeedBtn = $('copyCalFeedBtn');

    RAW_DATA = await loadTimetableData();
    if (!RAW_DATA) {
      if (els.emptyState) {
        els.emptyState.style.display = 'flex';
        els.emptyState.querySelector('h3').textContent = 'Timetable data not loaded';
        els.emptyState.querySelector('p').textContent = 'Could not find timetable JSON data. Please verify your backend server.';
      }
      return;
    }

    normalizeData(RAW_DATA);
    populateYears();

    els.yearSelect.addEventListener('change', () => {
      populateBranches();
      populateBatches();
      render();
    });

    els.branchSelect.addEventListener('change', () => {
      populateBatches();
      render();
    });

    els.batchSelect.addEventListener('change', () => {
      persistSelection();
      render();
    });

    els.searchInput.addEventListener('input', onSearch);

    if (els.shareBtn) {
      els.shareBtn.addEventListener('click', shareTimetable);
    }

    if (els.printBtn) {
      els.printBtn.addEventListener('click', () => window.print());
    }

    if (els.calendarBtn) {
      els.calendarBtn.addEventListener('click', openCalendarModal);
    }

    if (els.viewDayBtn) {
      els.viewDayBtn.addEventListener('click', () => setViewMode('day'));
    }

    if (els.viewWeekBtn) {
      els.viewWeekBtn.addEventListener('click', () => setViewMode('week'));
    }

    if (els.prevDayBtn) {
      els.prevDayBtn.addEventListener('click', () => navigateDay(-1));
    }

    if (els.nextDayBtn) {
      els.nextDayBtn.addEventListener('click', () => navigateDay(1));
    }

    if (els.closeCalendarModal) {
      els.closeCalendarModal.addEventListener('click', closeCalendarModal);
    }

    if (els.calendarModal) {
      els.calendarModal.addEventListener('click', (e) => {
        if (e.target === els.calendarModal) closeCalendarModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCalendarModal();
    });

    if (els.copyCalFeedBtn) {
      els.copyCalFeedBtn.addEventListener('click', copyCalFeedUrl);
    }

    // Handle deep-link or stored batch
    const params = new URLSearchParams(window.location.search);
    const targetBatch = params.get('batch');
    const targetYear = params.get('year');
    const targetBranch = params.get('branch');
    const targetView = params.get('view');
    const targetDay = params.get('day');

    if (targetView && (targetView === 'day' || targetView === 'week')) {
      currentViewMode = targetView;
    }
    if (targetDay) {
      activeDay = targetDay.toUpperCase();
    }

    if (targetBatch && selectByBatchCode(targetBatch)) {
      // successfully selected from query parameter
    } else if (targetYear && DATA[targetYear]) {
      els.yearSelect.value = targetYear;
      populateBranches();
      if (targetBranch && DATA[targetYear][targetBranch]) {
        els.branchSelect.value = targetBranch;
      }
      populateBatches();
      render();
    } else {
      const savedBatch = localStorage.getItem('tt_last_batch');
      if (savedBatch && selectByBatchCode(savedBatch)) {
        // loaded from localStorage
      } else {
        populateBranches();
        populateBatches();
        render();
      }
    }
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('tt_view_mode', mode);
    updateViewSwitchButtons();
    render();
  }

  function updateViewSwitchButtons() {
    if (els.viewDayBtn) {
      els.viewDayBtn.classList.toggle('active', currentViewMode === 'day');
      els.viewDayBtn.setAttribute('aria-selected', currentViewMode === 'day');
    }
    if (els.viewWeekBtn) {
      els.viewWeekBtn.classList.toggle('active', currentViewMode === 'week');
      els.viewWeekBtn.setAttribute('aria-selected', currentViewMode === 'week');
    }
  }

  function setActiveDay(day) {
    activeDay = day;
    localStorage.setItem('tt_active_day', day);
    render();
  }

  function navigateDay(direction) {
    const today = getTodayName();
    const effectiveDay = (activeDay === 'TODAY' || activeDay === 'ALL') ? today : activeDay;
    let idx = DAY_ORDER.indexOf(effectiveDay);
    if (idx === -1) idx = 0;
    idx = (idx + direction + DAY_ORDER.length) % DAY_ORDER.length;
    setActiveDay(DAY_ORDER[idx]);
  }

  function openCalendarModal() {
    const batchCode = els.batchSelect.value;
    if (!batchCode) {
      showToast('Please select a batch first');
      return;
    }
    const yd = currentYearData();
    const branch = els.branchSelect.value;
    const year = els.yearSelect.value;

    if (els.modalBatchTag) {
      els.modalBatchTag.textContent = `${batchCode} · ${titleCase(branch)} (${year})`;
    }

    const host = window.location.host;
    const origin = window.location.origin;
    const icsPath = `/api/timetable/batch/${encodeURIComponent(batchCode)}/calendar.ics`;
    const httpsFeedUrl = `${origin}${icsPath}`;
    const webcalFeedUrl = `webcal://${host}${icsPath}`;

    // Apple / iOS Calendar options
    if (els.appleSubscribeBtn) {
      els.appleSubscribeBtn.href = webcalFeedUrl;
    }
    if (els.appleDownloadBtn) {
      els.appleDownloadBtn.href = icsPath;
      els.appleDownloadBtn.setAttribute('download', `${batchCode}-timetable.ics`);
    }

    // Google Calendar 1-click subscription option
    if (els.googleSubscribeBtn) {
      els.googleSubscribeBtn.href = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalFeedUrl)}`;
    }

    // Feed URL input
    if (els.calFeedInput) {
      els.calFeedInput.value = httpsFeedUrl;
    }

    if (els.calendarModal) {
      els.calendarModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCalendarModal() {
    if (els.calendarModal) {
      els.calendarModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function copyCalFeedUrl() {
    if (!els.calFeedInput) return;
    const val = els.calFeedInput.value;
    if (!val) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val).then(
        () => showToast('Calendar Feed URL copied!'),
        () => showToast('Press Ctrl+C to copy')
      );
    } else {
      els.calFeedInput.select();
      document.execCommand('copy');
      showToast('Calendar Feed URL copied!');
    }
  }

  function populateYears() {
    const years = Object.keys(DATA);
    els.yearSelect.innerHTML = years
      .map((y) => `<option value="${escapeAttr(y)}">${escapeHtml(y)}</option>`)
      .join('');
  }

  function currentYearData() {
    return DATA[els.yearSelect.value] || {};
  }

  function populateBranches() {
    const yd = currentYearData();
    const branches = Object.keys(yd).sort();
    els.branchSelect.innerHTML = branches
      .map((b) => `<option value="${escapeAttr(b)}">${escapeHtml(titleCase(b))}</option>`)
      .join('');
  }

  function populateBatches() {
    const yd = currentYearData();
    const branch = els.branchSelect.value;
    const batchGroup = yd[branch] || {};
    const codes = Object.keys(batchGroup).sort();
    els.batchSelect.innerHTML = codes
      .map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`)
      .join('');
  }

  function selectByBatchCode(code) {
    if (!code) return false;
    const clean = code.trim().toUpperCase();
    const entry = batchIndex[clean];
    if (!entry) return false;

    els.yearSelect.value = entry.year;
    populateBranches();
    els.branchSelect.value = entry.branch;
    populateBatches();
    els.batchSelect.value = entry.code;
    persistSelection();
    render();
    return true;
  }

  function onSearch() {
    const q = els.searchInput.value.trim().toUpperCase();
    if (!q) return;
    if (selectByBatchCode(q)) {
      // Matched exact batch code
      return;
    }
    // Prefix search
    const match = Object.keys(batchIndex).find((c) => c.startsWith(q));
    if (match) {
      selectByBatchCode(match);
    }
  }

  function persistSelection() {
    const batch = els.batchSelect.value;
    if (batch) {
      localStorage.setItem('tt_last_batch', batch);
    }
  }

  function shareTimetable() {
    const batch = els.batchSelect.value;
    if (!batch) return;
    const url = new URL(window.location.href);
    url.searchParams.set('batch', batch);
    url.searchParams.set('view', currentViewMode);
    if (currentViewMode === 'day' && activeDay !== 'TODAY') {
      url.searchParams.set('day', activeDay);
    } else {
      url.searchParams.delete('day');
    }
    window.history.replaceState({}, '', url.toString());

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url.toString()).then(
        () => showToast(`Link copied for batch ${batch}!`),
        () => showToast(`Share URL: ${url.search}`)
      );
    } else {
      showToast(`Batch URL ready: ${url.search}`);
    }
  }

  function render() {
    const yd = currentYearData();
    const branch = els.branchSelect.value;
    const batchCode = els.batchSelect.value;
    const info = (yd[branch] || {})[batchCode];

    if (!info) {
      if (els.emptyState) els.emptyState.style.display = 'flex';
      if (els.dayViewContainer) els.dayViewContainer.style.display = 'none';
      if (els.weekViewContainer) els.weekViewContainer.style.display = 'none';
      if (els.batchMeta) els.batchMeta.innerHTML = '';
      return;
    }

    if (els.emptyState) els.emptyState.style.display = 'none';
    if (els.batchMeta) {
      els.batchMeta.innerHTML = `
        <span class="meta-batch">${escapeHtml(batchCode)}</span>
        <span class="meta-sep">&middot;</span>
        <span class="meta-branch">${escapeHtml(titleCase(branch))}</span>
      `;
    }

    updateViewSwitchButtons();

    if (currentViewMode === 'day') {
      if (els.dayViewContainer) els.dayViewContainer.style.display = 'flex';
      if (els.weekViewContainer) els.weekViewContainer.style.display = 'none';
      if (els.dayNavBar) els.dayNavBar.style.display = 'flex';
      renderDayView(info, batchCode, branch);
    } else {
      if (els.dayViewContainer) els.dayViewContainer.style.display = 'none';
      if (els.weekViewContainer) els.weekViewContainer.style.display = 'block';
      if (els.dayNavBar) els.dayNavBar.style.display = 'none';
      renderWeekView(info);
    }
  }

  function renderDayView(info, batchCode, branch) {
    const today = getTodayName();
    const daysPresent = DAY_ORDER.filter((d) => info.days[d] && info.days[d].length > 0);

    // Populate day pills
    if (els.dayPills) {
      els.dayPills.innerHTML = '';

      // "Today" pill
      const isTodayActive = (activeDay === 'TODAY' || activeDay === today);
      const todayPill = document.createElement('button');
      todayPill.type = 'button';
      todayPill.className = `day-pill is-today ${isTodayActive ? 'active' : ''}`;
      const todayCount = (info.days[today] || []).length;
      todayPill.innerHTML = `<span>🌟 Today (${DAY_SHORT[today] || 'Sun'})</span> <span class="pill-count">${todayCount}</span>`;
      todayPill.onclick = () => setActiveDay('TODAY');
      els.dayPills.appendChild(todayPill);

      // Days of the week
      DAY_ORDER.forEach((d) => {
        const isSelected = (activeDay === d) || (activeDay === 'TODAY' && d === today);
        const isToday = (d === today);
        const count = (info.days[d] || []).length;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `day-pill ${isToday ? 'is-today' : ''} ${isSelected ? 'active' : ''}`;
        pill.innerHTML = `<span>${DAY_SHORT[d]}</span> <span class="pill-count">${count}</span>`;
        pill.onclick = () => setActiveDay(d);
        els.dayPills.appendChild(pill);
      });

      // "All Days" pill
      const allPill = document.createElement('button');
      allPill.type = 'button';
      allPill.className = `day-pill ${activeDay === 'ALL' ? 'active' : ''}`;
      allPill.innerHTML = `<span>All Days</span>`;
      allPill.onclick = () => setActiveDay('ALL');
      els.dayPills.appendChild(allPill);
    }

    // Render "All Days" mode
    if (activeDay === 'ALL') {
      let totalAllClasses = 0;
      daysPresent.forEach((d) => totalAllClasses += (info.days[d] || []).length);

      els.dayHeaderCard.innerHTML = `
        <div class="day-header-top">
          <div class="day-header-title-wrap">
            <h3 class="day-header-title">All Days Schedule</h3>
          </div>
          <div class="day-meta-chips">
            <span class="day-meta-chip">📅 ${daysPresent.length} Active Days</span>
            <span class="day-meta-chip">📚 ${totalAllClasses} Total Classes</span>
          </div>
        </div>
      `;

      els.dayTimeline.innerHTML = '';
      if (daysPresent.length === 0) {
        els.dayTimeline.innerHTML = `
          <div class="day-free-card">
            <div class="day-free-glyph">📅</div>
            <h4>No sessions scheduled</h4>
            <p>This batch has no sessions in the timetable dataset.</p>
          </div>
        `;
        return;
      }

      daysPresent.forEach((d) => {
        const sessions = (info.days[d] || []).slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
        const isToday = (d === today);

        const sec = document.createElement('div');
        sec.className = 'stacked-day-section';

        const head = document.createElement('div');
        head.className = 'stacked-day-header';
        head.innerHTML = `
          <h4 class="stacked-day-title">
            <span>${titleCase(d)}</span>
            ${isToday ? '<span class="day-today-badge">✨ TODAY</span>' : ''}
          </h4>
          <span class="day-meta-chip">📚 ${sessions.length} Classes</span>
        `;
        sec.appendChild(head);

        const list = document.createElement('div');
        list.className = 'day-timeline';

        const now = new Date();
        const currMin = now.getHours() * 60 + now.getMinutes();

        sessions.forEach((item, idx) => {
          let status = '';
          if (isToday) {
            const startMin = timeToMinutes(item.time);
            const endMin = startMin + 50;
            if (currMin >= startMin && currMin < endMin) {
              status = 'live';
            } else if (currMin < startMin && (idx === 0 || currMin >= timeToMinutes(sessions[idx - 1].time) + 50)) {
              status = 'upnext';
            } else if (currMin >= endMin) {
              status = 'done';
            }
          }
          list.appendChild(makeTimelineCard(item, d, batchCode, status));
        });

        sec.appendChild(list);
        els.dayTimeline.appendChild(sec);
      });
      return;
    }

    // Single Day Mode
    const targetDay = (activeDay === 'TODAY' ? today : activeDay);
    const isToday = (targetDay === today);
    const sessions = (info.days[targetDay] || []).slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    els.dayTimeline.innerHTML = '';

    if (sessions.length === 0) {
      els.dayHeaderCard.innerHTML = `
        <div class="day-header-top">
          <div class="day-header-title-wrap">
            <h3 class="day-header-title">${titleCase(targetDay)}'s Schedule</h3>
            ${isToday ? '<span class="day-today-badge">✨ TODAY</span>' : ''}
          </div>
          <div class="day-meta-chips">
            <span class="day-meta-chip">☕ Free Day</span>
          </div>
        </div>
      `;

      els.dayTimeline.innerHTML = `
        <div class="day-free-card">
          <div class="day-free-glyph">🌴</div>
          <h4>No classes scheduled for ${titleCase(targetDay)}!</h4>
          <p>You have no lectures or labs scheduled on this day. Use this time to catch up on coursework, work on projects, or relax!</p>
        </div>
      `;
      return;
    }

    const firstTime = fmtTime(sessions[0].time);
    const lastTime = fmtEndTime(sessions[sessions.length - 1].time);
    const totalTimeText = calculateTotalHours(sessions);

    // Live status banner for today
    let liveBannerHtml = '';
    const now = new Date();
    const currMin = now.getHours() * 60 + now.getMinutes();
    let currentLiveSession = null;
    let nextUpcomingSession = null;
    let nextMinsUntil = 0;
    let allFinished = true;

    if (isToday) {
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        const sMin = timeToMinutes(s.time);
        const eMin = sMin + 50;

        if (currMin >= sMin && currMin < eMin) {
          currentLiveSession = s;
          allFinished = false;
        } else if (currMin < sMin) {
          allFinished = false;
          if (!nextUpcomingSession) {
            nextUpcomingSession = s;
            nextMinsUntil = sMin - currMin;
          }
        }
      }

      if (currentLiveSession) {
        liveBannerHtml = `
          <div class="day-live-banner ongoing">
            <span class="pulse-dot"></span>
            <span><strong>NOW IN CLASS:</strong> ${escapeHtml(currentLiveSession.subject)} (${escapeHtml(currentLiveSession.code)}) in <strong>${escapeHtml(currentLiveSession.room || 'TBD')}</strong> &middot; Ends at ${fmtEndTime(currentLiveSession.time)}</span>
          </div>
        `;
      } else if (nextUpcomingSession) {
        liveBannerHtml = `
          <div class="day-live-banner upcoming">
            <span>⏰ <strong>NEXT CLASS:</strong> ${escapeHtml(nextUpcomingSession.subject)} at <strong>${fmtTime(nextUpcomingSession.time)}</strong> (${formatMinutesUntil(nextMinsUntil)}) &middot; Room: <strong>${escapeHtml(nextUpcomingSession.room || 'TBD')}</strong></span>
          </div>
        `;
      } else if (allFinished) {
        liveBannerHtml = `
          <div class="day-live-banner done">
            <span>🎉 All classes for today have finished! Have a great evening.</span>
          </div>
        `;
      }
    }

    els.dayHeaderCard.innerHTML = `
      <div class="day-header-top">
        <div class="day-header-title-wrap">
          <h3 class="day-header-title">${titleCase(targetDay)}'s Schedule</h3>
          ${isToday ? '<span class="day-today-badge">✨ TODAY</span>' : ''}
        </div>
        <div class="day-meta-chips">
          <span class="day-meta-chip">📚 ${sessions.length} Classes</span>
          <span class="day-meta-chip">⏰ ${firstTime} – ${lastTime}</span>
          <span class="day-meta-chip">⏳ ${totalTimeText}</span>
        </div>
      </div>
      ${liveBannerHtml}
    `;

    // Render timeline cards
    sessions.forEach((item) => {
      let status = '';
      if (isToday) {
        const startMin = timeToMinutes(item.time);
        const endMin = startMin + 50;
        if (currMin >= startMin && currMin < endMin) {
          status = 'live';
        } else if (nextUpcomingSession && item === nextUpcomingSession) {
          status = 'upnext';
        } else if (currMin >= endMin) {
          status = 'done';
        }
      }
      els.dayTimeline.appendChild(makeTimelineCard(item, targetDay, batchCode, status));
    });
  }

  function makeTimelineCard(item, dayName, batchCode, status) {
    const type = item.type || 'other';
    const card = document.createElement('div');
    card.className = `timeline-card timeline-card--${type} ${status === 'live' ? 'is-live' : ''}`;

    // Time column
    const timeCol = document.createElement('div');
    timeCol.className = 'timeline-time-col';
    timeCol.innerHTML = `
      <div class="timeline-time-start">${fmtTime(item.time)}</div>
      <div class="timeline-time-end">to ${fmtEndTime(item.time)}</div>
      <div class="timeline-duration-badge">50 min</div>
    `;
    card.appendChild(timeCol);

    // Main details column
    const mainCol = document.createElement('div');
    mainCol.className = 'timeline-main-col';

    const badgesRow = document.createElement('div');
    badgesRow.className = 'timeline-badges-row';

    const typePill = document.createElement('span');
    typePill.className = `timeline-type-pill ${type}`;
    typePill.textContent = TYPE_LABEL[type] || 'SESSION';
    badgesRow.appendChild(typePill);

    if (item.code) {
      const codePill = document.createElement('span');
      codePill.className = 'timeline-code-pill';
      codePill.textContent = item.code;
      badgesRow.appendChild(codePill);
    }

    if (status === 'live') {
      const liveTag = document.createElement('span');
      liveTag.className = 'timeline-status-tag live';
      liveTag.innerHTML = '<span class="pulse-dot"></span> LIVE NOW';
      badgesRow.appendChild(liveTag);
    } else if (status === 'upnext') {
      const upnextTag = document.createElement('span');
      upnextTag.className = 'timeline-status-tag upnext';
      upnextTag.textContent = '⏳ UP NEXT';
      badgesRow.appendChild(upnextTag);
    } else if (status === 'done') {
      const doneTag = document.createElement('span');
      doneTag.className = 'timeline-status-tag done';
      doneTag.textContent = '✓ Completed';
      badgesRow.appendChild(doneTag);
    }
    mainCol.appendChild(badgesRow);

    const titleEl = document.createElement('h4');
    titleEl.className = 'timeline-subject';
    titleEl.textContent = item.subject;
    mainCol.appendChild(titleEl);

    if (item.room) {
      const detailsRow = document.createElement('div');
      detailsRow.className = 'timeline-details-row';
      const roomBadge = document.createElement('span');
      roomBadge.className = 'timeline-room-badge';
      roomBadge.textContent = `📍 ${item.room}`;
      detailsRow.appendChild(roomBadge);
      mainCol.appendChild(detailsRow);
    }
    card.appendChild(mainCol);

    // Actions column
    const actionsCol = document.createElement('div');
    actionsCol.className = 'timeline-actions-col';

    const gcalBtn = document.createElement('a');
    gcalBtn.className = 'timeline-action-btn gcal';
    gcalBtn.href = createGoogleCalEventUrl(item, dayName, batchCode);
    gcalBtn.target = '_blank';
    gcalBtn.rel = 'noopener noreferrer';
    gcalBtn.title = 'Add this recurring class to Google Calendar';
    gcalBtn.innerHTML = '<span>🗓️</span> <span>+ Google Cal</span>';
    actionsCol.appendChild(gcalBtn);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'timeline-action-btn';
    copyBtn.title = 'Copy class details';
    copyBtn.innerHTML = '<span>📋</span> <span>Copy</span>';
    copyBtn.onclick = () => {
      const text = `${item.subject} (${item.code || ''}) | ${fmtTime(item.time)} - ${fmtEndTime(item.time)} | Room: ${item.room || 'TBD'} | Batch: ${batchCode}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => showToast(`Copied details for ${item.subject}!`),
          () => showToast('Failed to copy')
        );
      } else {
        showToast(`Details: ${text}`);
      }
    };
    actionsCol.appendChild(copyBtn);

    card.appendChild(actionsCol);
    return card;
  }

  function renderWeekView(info) {
    els.grid.innerHTML = '';

    const daysPresent = DAY_ORDER.filter((d) => info.days[d] && info.days[d].length > 0);
    if (daysPresent.length === 0) {
      els.grid.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="glyph">📅</div>
          <h3>No sessions scheduled</h3>
          <p>This batch has no scheduled sessions in the timetable dataset.</p>
        </div>
      `;
      return;
    }

    // Unique sorted times
    const timeSet = new Set();
    daysPresent.forEach((d) => {
      info.days[d].forEach((it) => timeSet.add(it.time));
    });
    const times = [...timeSet].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

    // Lookup day -> time -> items
    const lookup = {};
    daysPresent.forEach((d) => {
      lookup[d] = {};
      info.days[d].forEach((it) => {
        (lookup[d][it.time] = lookup[d][it.time] || []).push(it);
      });
    });

    const today = getTodayName();

    const table = document.createElement('div');
    table.className = 'timetable';
    table.style.setProperty('--num-days', daysPresent.length);

    // Header row
    const headRow = document.createElement('div');
    headRow.className = 'row head-row';
    headRow.appendChild(makeCell('corner-cell', 'Time'));
    daysPresent.forEach((d) => {
      const c = document.createElement('div');
      c.className = 'day-head' + (d === today ? ' today' : '');
      c.textContent = DAY_SHORT[d];
      headRow.appendChild(c);
    });
    table.appendChild(headRow);

    // Time slot rows
    times.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'row';

      const timeCell = document.createElement('div');
      timeCell.className = 'time-cell';
      timeCell.innerHTML = `<span>${fmtTime(t)}</span>`;
      row.appendChild(timeCell);

      daysPresent.forEach((d) => {
        const cell = document.createElement('div');
        cell.className = 'day-cell' + (d === today ? ' today' : '');
        const items = (lookup[d] && lookup[d][t]) || [];
        items.forEach((it) => {
          cell.appendChild(makeCard(it));
        });
        row.appendChild(cell);
      });

      table.appendChild(row);
    });

    els.grid.appendChild(table);
  }

  function makeCell(cls, text) {
    const c = document.createElement('div');
    c.className = cls;
    c.textContent = text;
    return c;
  }

  function makeCard(item) {
    const type = item.type || 'other';
    const card = document.createElement('div');
    card.className = `card card--${type}`;

    const top = document.createElement('div');
    top.className = 'card-top';

    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = TYPE_LABEL[type] || 'SESSION';
    top.appendChild(label);

    if (item.code) {
      const codeBadge = document.createElement('div');
      codeBadge.className = 'card-code';
      codeBadge.textContent = item.code;
      top.appendChild(codeBadge);
    }
    card.appendChild(top);

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.subject;
    card.appendChild(title);

    if (item.room) {
      const room = document.createElement('div');
      room.className = 'card-room';
      room.textContent = `📍 ${item.room}`;
      card.appendChild(room);
    }

    return card;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
