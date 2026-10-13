import { useState, useEffect } from 'react'
import './App.css'
import {
  API_BASE,
  resolveFileUrl,
  checkBackendHealth,
  getStats,
  getSubjects,
  getSubjectDetails,
  getSocieties,
  getTimetableHierarchy,
  getTimetableBatch,
  loginUser,
} from './services/api'

// Fallback course images for cards
const courseImages = [
  'photo-1516321318423-f06f85e504b3',
  'photo-1509228468518-180dd4864904',
  'photo-1516321497487-e288fb19713f',
  'photo-1618005182384-a83a8bd57fbe',
  'photo-1532094349884-543bc11b234d',
  'photo-1507413245164-6160d8298b31',
  'photo-1526374965328-7f61d4dc18c5',
]

// Fallback demo courses in case backend is offline
const defaultCourses = [
  { id: 'cs101', name: 'Data Structures & Algorithms', detail: 'Notes, PYQs, visualizer & practice problems', image: 'photo-1516321318423-f06f85e504b3', tag: 'YEAR 2 • CSE', year: 2 },
  { id: 'math201', name: 'Engineering Mathematics', detail: 'Formula sheets, solved questions & lecture summaries', image: 'photo-1509228468518-180dd4864904', tag: 'YEAR 1 • ALL', year: 1 },
  { id: 'ee301', name: 'Digital Electronics & VLSI', detail: 'Circuit schematics, lab manual & study resources', image: 'photo-1516321497487-e288fb19713f', tag: 'YEAR 2 • ECE', year: 2 },
  { id: 'ai401', name: 'Machine Learning Fundamentals', detail: 'Datasets, Jupyter notebooks & Python guides', image: 'photo-1618005182384-a83a8bd57fbe', tag: 'YEAR 3 • CSE', year: 3 },
]

const events = [
  { id: 1, day: '18', month: 'OCT', name: 'Design Week Showcase', society: 'Design Society', time: '4:00 PM', location: 'Hall B' },
  { id: 2, day: '21', month: 'OCT', name: 'CodeSprint 2026 Hackathon', society: 'Creative Computing Society', time: '11:00 AM', location: 'Lab 4' },
  { id: 3, day: '24', month: 'OCT', name: 'Acoustic Open Mic Night', society: 'Cultural Society', time: '6:30 PM', location: 'Amphitheater' },
]

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Reusable Modern Logo Component
function Logo({ customSrc = null, collapsed = false, className = '' }) {
  if (customSrc) {
    return (
      <div className={`brand-logo ${className}`}>
        <img src={customSrc} alt="UniFold Logo" className="custom-logo-img" />
      </div>
    )
  }

  return (
    <div className={`brand-logo ${collapsed ? 'collapsed' : ''} ${className}`}>
      <div className="brand-icon-shield">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand-svg">
          <defs>
            <linearGradient id="foldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="foldGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="foldGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="100%" stopColor="#064e3b" />
            </linearGradient>
          </defs>
          <path d="M18 3L4 10.5V25.5L18 33L32 25.5V10.5L18 3Z" fill="url(#foldGrad3)" opacity="0.25" />
          <path d="M18 3L32 10.5L18 18L4 10.5L18 3Z" fill="url(#foldGrad2)" />
          <path d="M18 18V33L32 25.5V10.5L18 18Z" fill="url(#foldGrad1)" />
          <path d="M18 18V33L4 25.5V10.5L18 18Z" fill="url(#foldGrad2)" opacity="0.65" />
          <circle cx="18" cy="18" r="2.8" fill="#ffffff" />
          <circle cx="18" cy="18" r="1.4" fill="#047857" />
        </svg>
      </div>

      {!collapsed && (
        <div className="brand-text-lockup">
          <span className="brand-title">
            Uni<span className="brand-accent">Fold</span>
          </span>
          <span className="brand-pill">CAMPUS OS</span>
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="google-svg">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

function App() {
  const [page, setPage] = useState('Dashboard')
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('unifold_theme')
      if (stored) return stored
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    } catch {
      return 'light'
    }
  })

  const [loggedIn, setLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState([])
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [customLogoSrc, setCustomLogoSrc] = useState(null)

  // Real Backend Data State
  const [backendOnline, setBackendOnline] = useState(false)
  const [stats, setStats] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [selectedYear, setSelectedYear] = useState('ALL')
  const [subjectModal, setSubjectModal] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Societies State
  const [societiesList, setSocietiesList] = useState([])
  const [societyCategory, setSocietyCategory] = useState('ALL')

  // Timetable State
  const [timetableHierarchy, setTimetableHierarchy] = useState([])
  const [selectedTtYear, setSelectedTtYear] = useState('1st Year')
  const [selectedTtBranch, setSelectedTtBranch] = useState('')
  const [selectedTtBatch, setSelectedTtBatch] = useState('1C11')
  const [batchSchedule, setBatchSchedule] = useState(null)
  const [ttSearch, setTtSearch] = useState('')

  // Sync theme
  useEffect(() => {
    try {
      localStorage.setItem('unifold_theme', theme)
    } catch (e) {
      console.error(e)
    }
  }, [theme])

  // Initialize data from backend
  useEffect(() => {
    let mounted = true

    async function loadBackendData() {
      try {
        await checkBackendHealth()
        if (mounted) setBackendOnline(true)

        // Load stats
        const statsData = await getStats().catch(() => null)
        if (mounted && statsData) setStats(statsData)

        // Load subjects
        const subjectsData = await getSubjects().catch(() => [])
        if (mounted && subjectsData && subjectsData.length > 0) {
          setSubjects(subjectsData)
        }

        // Load societies
        const socData = await getSocieties().catch(() => [])
        if (mounted && socData && socData.length > 0) {
          setSocietiesList(socData)
        }

        // Load timetable hierarchy
        const ttYears = await getTimetableHierarchy().catch(() => [])
        if (mounted && ttYears && ttYears.length > 0) {
          setTimetableHierarchy(ttYears)
          const firstYear = ttYears[0]
          setSelectedTtYear(firstYear.year)
          if (firstYear.branches && firstYear.branches.length > 0) {
            const firstBranch = firstYear.branches.find(b => b.branch.includes('COMPUTER')) || firstYear.branches[0]
            setSelectedTtBranch(firstBranch.branch)
            if (firstBranch.batches && firstBranch.batches.length > 0) {
              const defaultBatch = firstBranch.batches.includes('1C11') ? '1C11' : firstBranch.batches[0]
              setSelectedTtBatch(defaultBatch)
              // Fetch batch schedule
              const sched = await getTimetableBatch(defaultBatch).catch(() => null)
              if (mounted && sched) setBatchSchedule(sched.schedule || sched)
            }
          }
        }
      } catch (err) {
        console.warn('Backend not yet reachable on port 5001:', err.message)
        if (mounted) setBackendOnline(false)
      }
    }

    loadBackendData()
    return () => { mounted = false }
  }, [])

  // When selected batch changes, fetch its schedule
  useEffect(() => {
    if (!selectedTtBatch) return
    let active = true
    getTimetableBatch(selectedTtBatch)
      .then((data) => {
        if (active && data) {
          setBatchSchedule(data.schedule || data)
        }
      })
      .catch((err) => console.warn('Could not fetch schedule for', selectedTtBatch, err.message))
    return () => { active = false }
  }, [selectedTtBatch])

  // Open modal to view a subject's documents
  const openSubjectModal = async (subject) => {
    setModalLoading(true)
    setSubjectModal({ ...subject, resources: { pdf: [], ppt: [], notes: [], other: [] } })
    try {
      const fullDetails = await getSubjectDetails(subject.id)
      setSubjectModal(fullDetails)
    } catch (err) {
      console.warn('Failed to load subject details:', err.message)
      setNotice(`Could not load files for ${subject.name}`)
    } finally {
      setModalLoading(false)
    }
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const navItems = [
    { title: 'Dashboard', icon: '⌂', group: 'OVERVIEW' },
    { title: 'Study Material', icon: '▤', group: 'LEARN' },
    { title: 'Timetable', icon: '▦', group: 'LEARN' },
    { title: 'Societies', icon: '♧', group: 'CAMPUS LIFE' },
    { title: 'Events', icon: '✳', group: 'CAMPUS LIFE' },
  ]

  const changePage = (nextPage) => {
    setPage(nextPage)
    setNotice('')
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Map backend subjects or fallback courses
  const displayedCourses = subjects.length > 0
    ? subjects.map((s, idx) => ({
        id: s.id,
        name: s.name,
        code: s.code || '',
        year: s.year,
        branch: s.branch || 'ALL',
        tag: `YEAR ${s.year} • ${s.code || s.branch || 'GENERAL'}`,
        detail: `${s.total_resources || 0} Materials (${s.pdf_count || 0} PDFs, ${s.ppt_count || 0} PPTs, ${s.notes_count || 0} Notes)`,
        image: courseImages[idx % courseImages.length],
        rawSubject: s,
      }))
    : defaultCourses

  const filteredCourses = displayedCourses.filter((course) => {
    const matchesSearch = `${course.name} ${course.tag} ${course.detail}`.toLowerCase().includes(search.toLowerCase())
    const matchesYear = selectedYear === 'ALL' || String(course.year) === String(selectedYear)
    return matchesSearch && matchesYear
  })

  // Filtered Societies
  const displayedSocieties = societiesList.length > 0 ? societiesList : [
    { id: 1, name: 'Creative Computing Society (CCS)', category: 'Technical & Computing', description: 'Competitive programming, open-source builds, and full-stack hackathons.', instagram: 'https://instagram.com/ccs_tiet', website: 'https://thapar.edu' },
    { id: 2, name: 'Design Society', category: 'Creative & Design', description: 'UI/UX design, visual branding, typography, and product design workshops.', instagram: null, website: null },
    { id: 3, name: 'Cultural Society', category: 'Cultural & Arts', description: 'Music, theater, dance, open mics, and campus cultural fest organizing.', instagram: null, website: null },
    { id: 4, name: 'Robotics & AI Guild', category: 'Technical & Computing', description: 'Autonomous drones, embedded robotics, and machine learning research projects.', instagram: null, website: null },
    { id: 5, name: 'Literary & Debate Club', category: 'Literary & Debating', description: 'Parliamentary debates, creative writing, and inter-university symposiums.', instagram: null, website: null },
    { id: 6, name: 'Entrepreneurship Cell', category: 'Entrepreneurship', description: 'Startup incubation, venture funding sessions, and founder meetups.', instagram: null, website: null },
  ]

  const societyCategories = ['ALL', ...Array.from(new Set(displayedSocieties.map((s) => s.category).filter(Boolean)))]

  const filteredSocieties = displayedSocieties.filter((soc) => {
    const matchesCat = societyCategory === 'ALL' || soc.category === societyCategory
    const matchesSearch = `${soc.name} ${soc.description || ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  // Timetable year & branches helpers
  const currentYearObj = timetableHierarchy.find((y) => y.year === selectedTtYear)
  const availableBranches = currentYearObj ? currentYearObj.branches : []
  const currentBranchObj = availableBranches.find((b) => b.branch === selectedTtBranch)
  const availableBatches = currentBranchObj ? currentBranchObj.batches : []

  const toggleSave = (name) => {
    setSaved((previous) =>
      previous.includes(name)
        ? previous.filter((item) => item !== name)
        : [...previous, name]
    )
  }

  // Handle Login (Supports both college student demo and Admin credentials)
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    const email = e.target['login-email']?.value?.trim() || ''
    const password = e.target['login-password']?.value?.trim() || ''

    if (email === 'admin' || email === 'admin@campus.edu') {
      try {
        const res = await loginUser(email, password)
        if (res && res.success) {
          setIsAdmin(true)
          setLoggedIn(true)
          setNotice(`Signed in as Administrator (${res.user?.id || 'admin'}). Full backend management enabled.`)
          return
        }
      } catch (err) {
        setNotice(`Admin login failed: ${err.message}. Signing in in student preview mode.`)
      }
    }

    setLoggedIn(true)
    setPage('Dashboard')
    setNotice(`Welcome back! Connected to campus resources.`)
  }

  return (
    <div className={`app ${theme}`}>
      {!loggedIn ? (
        <div className="login-page">
          <header className="login-topbar">
            <button className="brand-btn" onClick={() => setNotice('Welcome to UniFold!')}>
              <Logo customSrc={customLogoSrc} />
            </button>

            <div className="login-top-actions">
              <span className={`backend-status-pill ${backendOnline ? 'online' : ''}`}>
                <span className={`status-dot ${backendOnline ? 'pulse' : ''}`} />
                {backendOnline ? 'API Connected (5001)' : 'Offline / Standalone'}
              </span>

              <button
                className="icon-button theme-toggle-btn"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                onClick={toggleTheme}
                aria-label="Toggle color theme"
              >
                <span className="theme-icon">{theme === 'light' ? '☾' : '☀'}</span>
                <span className="theme-toggle-label">{theme === 'light' ? 'Dark' : 'Light'}</span>
              </button>

              <span className="login-account-cue">Already have an account?</span>
              <button
                className="login-top-link"
                onClick={() => document.getElementById('login-email')?.focus()}
              >
                Sign in ↗
              </button>
            </div>
          </header>

          <main className="login-main">
            <section className="login-intro">
              <div className="login-eyebrow">
                <span className="pulse-dot" />
                <span>YOUR CAMPUS, CONNECTED</span>
              </div>
              <h1>
                Your campus life,<br />
                all <em>in one place.</em>
              </h1>
              <p>
                Study smarter with {stats?.totals?.resources || 460}+ real lecture notes & PYQs, timetable schedules for 500+ batches, and 40+ student societies.
              </p>

              <div className="login-visual">
                <div className="login-visual-glow" />
                <div className="login-visual-circle circle-a" />
                <div className="login-visual-circle circle-b" />
                <div className="login-visual-copy">
                  <span>ONE CAMPUS ECOSYSTEM</span>
                  <strong>ENDLESS<br />POSSIBILITIES.</strong>
                </div>
                <span className="visual-star">✦</span>
              </div>

              <div className="login-benefits">
                <span className="benefit-pill">↗ {stats?.totals?.resources || 467} Verified Notes & PYQs</span>
                <span className="benefit-pill">↗ 500+ Live Timetable Batches</span>
                <span className="benefit-pill">↗ {stats?.totals?.societies || 41} Student Societies</span>
              </div>
            </section>

            <section className="login-card">
              <span className="section-kicker">PORTAL ACCESS</span>
              <h2>Good to have you here<span>.</span></h2>
              <p className="login-subtitle">
                Sign in with your student email or admin credentials.
              </p>

              <form onSubmit={handleLoginSubmit}>
                <label htmlFor="login-email">College Email or Admin ID</label>
                <input
                  id="login-email"
                  type="text"
                  defaultValue="student@campus.edu"
                  placeholder="student@campus.edu (or admin)"
                  required
                />

                <div className="password-heading">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    onClick={() => setNotice('Sign in with your student email or authorized campus administrator credentials.')}
                  >
                    Need help?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  defaultValue=""
                  placeholder="Enter your password"
                  required
                />

                <label className="remember-label">
                  <input type="checkbox" defaultChecked />
                  <span>Remember this device</span>
                </label>

                <button className="login-submit" type="submit">
                  <span>Sign into Campus OS</span>
                  <span className="arrow-icon">↗</span>
                </button>
              </form>

              <div className="login-divider">
                <span />
                <em>OR CONTINUE WITH</em>
                <span />
              </div>

              <button
                className="google-login"
                type="button"
                onClick={() => {
                  setLoggedIn(true)
                  setNotice('Signed in with Google Student ID.')
                }}
              >
                <GoogleIcon />
                <span>Continue with Google Student ID</span>
              </button>

              {notice && (
                <div className="login-notice-banner">
                  <span>ℹ️ {notice}</span>
                  <button type="button" onClick={() => setNotice('')}>×</button>
                </div>
              )}

              <p className="login-terms">
                By signing in, you agree to UniFold's <span>Terms of Service</span> and{' '}
                <span>Privacy Policy</span>.
              </p>
            </section>
          </main>

          <footer className="login-footer">
            <span>© 2026 UniFold Campus OS. Connected to Express/SQLite Backend.</span>
            <span className="footer-status">
              <span className={`status-indicator ${backendOnline ? '' : 'offline'}`} />{' '}
              {backendOnline ? 'BACKEND OPERATIONAL (PORT 5001)' : 'STANDALONE MODE'}
            </span>
          </footer>
        </div>
      ) : (
        <>
          {/* Mobile Overlay */}
          {mobileMenuOpen && (
            <div className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />
          )}

          <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header">
              <button className="brand" onClick={() => changePage('Dashboard')}>
                <Logo customSrc={customLogoSrc} />
              </button>
              <button
                className="close-mobile-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="campus-label">NAVIGATION MENU</div>

            {['OVERVIEW', 'LEARN', 'CAMPUS LIFE'].map((group) => (
              <div className="nav-group" key={group}>
                <p className="nav-heading">{group}</p>
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <button
                      key={item.title}
                      className={`nav-link ${page === item.title ? 'active' : ''}`}
                      onClick={() => changePage(item.title)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-text">{item.title}</span>
                      {item.title === 'Events' && <span className="nav-dot" title="Live updates" />}
                    </button>
                  ))}
              </div>
            ))}

            <div className="sidebar-bottom">
              <div className="help-card">
                <div className="help-header">
                  <span className="help-icon">✦</span>
                  <span className="help-tag">LIVE SYNC</span>
                </div>
                <p>Connected to Backend</p>
                <span>{stats?.totals?.resources || 467} notes & PYQs loaded live from database.</span>
              </div>

              <div className="profile-row">
                <span className="avatar">{isAdmin ? 'AD' : 'JD'}</span>
                <div className="profile-copy">
                  <strong>{isAdmin ? 'Administrator' : 'John Doe'}</strong>
                  <small>{isAdmin ? 'Admin Console' : 'Computer Science • Year 3'}</small>
                </div>
                <button
                  className="profile-menu"
                  title="Profile actions"
                  onClick={() => setNotice('Backend API is active on http://localhost:5001')}
                >
                  ···
                </button>
              </div>
            </div>
          </aside>

          <main className="main-area">
            <header className="topbar">
              <div className="topbar-left">
                <button
                  className="mobile-hamburger-btn"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation menu"
                >
                  ☰
                </button>
                <div className="breadcrumb">
                  <span className="brand-crumb">UniFold</span>
                  <span className="crumb-sep">/</span>
                  <span className="crumb-active">{page}</span>
                </div>

                <span className={`backend-status-pill ${backendOnline ? 'online' : ''}`}>
                  <span className={`status-dot ${backendOnline ? 'pulse' : ''}`} />
                  {backendOnline ? 'Backend Online (5001)' : 'Connecting...'}
                </span>
              </div>

              <div className="top-actions">
                <label className="search-box">
                  <span className="search-icon">⌕</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search courses, PYQs, societies..."
                  />
                  {search ? (
                    <button className="clear-search" onClick={() => setSearch('')}>×</button>
                  ) : (
                    <kbd>/</kbd>
                  )}
                </label>

                <button
                  className="icon-button theme-toggle-btn"
                  title={`Toggle ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                  onClick={toggleTheme}
                  aria-label="Toggle color theme"
                >
                  {theme === 'light' ? '☾' : '☀'}
                </button>

                <button
                  className="icon-button notification-button"
                  title="Notifications"
                  onClick={() => setNotice(`All systems online. ${subjects.length} subjects available.`)}
                >
                  <span>🔔</span>
                  <span className="bell-badge" />
                </button>

                <button
                  className="logout-button"
                  onClick={() => {
                    setLoggedIn(false)
                    setIsAdmin(false)
                    setNotice('')
                  }}
                >
                  <span>Log out</span>
                  <span className="logout-icon">↪</span>
                </button>
              </div>
            </header>

            {notice && (
              <div className="notice">
                <div className="notice-content">
                  <span className="notice-icon">✨</span>
                  <span>{notice}</span>
                </div>
                <button className="notice-close" onClick={() => setNotice('')}>×</button>
              </div>
            )}

            {page === 'Dashboard' && (
              <div className="page-content">
                <section className="welcome-banner">
                  <div className="banner-copy">
                    <span className="banner-label">
                      <span className="banner-pulse" /> SEMESTER 5 • LIVE CONNECTED
                    </span>
                    <h1>
                      Make your campus<br />life <em>effortlessly organized.</em>
                    </h1>
                    <p>
                      Access peer-verified notes, instant batch schedules for 500+ batches, and 40+ student societies directly connected to your campus backend.
                    </p>
                    <div className="banner-cta-group">
                      <button
                        className="banner-button primary"
                        onClick={() => changePage('Study Material')}
                      >
                        Explore resources <span>↗</span>
                      </button>
                      <button
                        className="banner-button secondary"
                        onClick={() => changePage('Timetable')}
                      >
                        View Schedule
                      </button>
                    </div>
                  </div>

                  <div className="banner-art">
                    <div className="art-orbit orbit-one" />
                    <div className="art-orbit orbit-two" />
                    <div className="art-circle">
                      <span className="circle-letter">U</span>
                    </div>
                    <span className="art-note note-one">STUDY SMART</span>
                    <span className="art-note note-two">CAMPUS READY</span>
                    <span className="art-spark">✦</span>
                  </div>

                  <span className="banner-index">SYS.V2.4 • UNIFOLD ACTIVE</span>
                </section>

                {/* Live Stats Strip */}
                <div className="stats-strip">
                  <div className="stats-card">
                    <span className="stats-num">{stats?.totals?.subjects ?? subjects.length}</span>
                    <span className="stats-label">Academic Subjects</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-num">{stats?.totals?.resources ?? 467}</span>
                    <span className="stats-label">Notes, PPTs & PYQs</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-num">{stats?.totals?.societies ?? societiesList.length}</span>
                    <span className="stats-label">Campus Societies</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-num">500+</span>
                    <span className="stats-label">Timetable Batches</span>
                  </div>
                </div>

                <section className="section-block">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">COURSE REPOSITORY</span>
                      <h2>Pick up where you left off<span>.</span></h2>
                    </div>
                    <div className="heading-right">
                      {saved.length > 0 && (
                        <span className="saved-counter">
                          ♥ {saved.length} Bookmarked
                        </span>
                      )}
                      <button className="view-all" onClick={() => changePage('Study Material')}>
                        All resources ↗
                      </button>
                    </div>
                  </div>

                  <div className="course-grid">
                    {filteredCourses.slice(0, 4).map((course, index) => (
                      <article className="course-card" key={course.id || course.name}>
                        <div
                          className={`course-image image-${(index % 4) + 1}`}
                          style={{
                            backgroundImage: `url(https://images.unsplash.com/${course.image}?auto=format&fit=crop&w=800&q=85)`,
                          }}
                        >
                          <div className="course-image-overlay" />
                          <span className="course-tag">{course.tag}</span>
                          <button
                            className={`save-button ${saved.includes(course.name) ? 'is-saved' : ''}`}
                            title={saved.includes(course.name) ? 'Remove bookmark' : 'Bookmark resource'}
                            onClick={() => toggleSave(course.name)}
                          >
                            {saved.includes(course.name) ? '♥' : '♡'}
                          </button>
                        </div>
                        <div className="course-info">
                          <h3>{course.name}</h3>
                          <p>{course.detail}</p>
                          <button
                            className="course-action-btn"
                            onClick={() => {
                              if (course.rawSubject) {
                                openSubjectModal(course.rawSubject)
                              } else {
                                setNotice(`Opening ${course.name} lecture repository...`)
                              }
                            }}
                          >
                            <span>Explore materials</span>
                            <span className="arrow">↗</span>
                          </button>
                        </div>
                      </article>
                    ))}
                    {filteredCourses.length === 0 && (
                      <div className="empty-state-box">
                        <span className="empty-icon">🔍</span>
                        <h3>No resources found matching "{search}"</h3>
                        <p>Try searching by subject name, course code, or department tags.</p>
                        <button className="reset-search-btn" onClick={() => setSearch('')}>
                          Clear search filter
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bottom-grid">
                  <div className="events-panel">
                    <div className="section-heading compact-heading">
                      <div>
                        <span className="section-kicker">CAMPUS CALENDAR</span>
                        <h2>Upcoming Events<span>.</span></h2>
                      </div>
                      <button className="view-all" onClick={() => changePage('Events')}>
                        All events ↗
                      </button>
                    </div>
                    {events.slice(0, 3).map((event) => (
                      <div className="event-row" key={event.id || event.name}>
                        <div className="event-date">
                          <span className="event-month">{event.month}</span>
                          <strong className="event-day">{event.day}</strong>
                        </div>
                        <div className="event-info">
                          <strong>{event.name}</strong>
                          <span className="event-society-tag">{event.society} • {event.location}</span>
                        </div>
                        <span className="event-time">{event.time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="quick-panel">
                    <span className="section-kicker">WORKFLOW SHORTCUTS</span>
                    <h2>Less searching.<br />More doing<span>.</span></h2>
                    <div className="quick-actions-list">
                      <button onClick={() => changePage('Timetable')}>
                        <span className="action-glyph">▦</span>
                        <div className="action-text">
                          <strong>Check weekly schedule</strong>
                          <small>View lecture halls & lab timings</small>
                        </div>
                        <span className="action-arr">↗</span>
                      </button>
                      <button onClick={() => changePage('Societies')}>
                        <span className="action-glyph">♧</span>
                        <div className="action-text">
                          <strong>Find campus societies</strong>
                          <small>Join clubs, tech groups & cultural wings</small>
                        </div>
                        <span className="action-arr">↗</span>
                      </button>
                      <button onClick={() => changePage('Events')}>
                        <span className="action-glyph">✳</span>
                        <div className="action-text">
                          <strong>Browse hackathons & fests</strong>
                          <small>RSVP to upcoming university activities</small>
                        </div>
                        <span className="action-arr">↗</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {page !== 'Dashboard' && (
              <div className="page-content inner-page">
                <span className="section-kicker">EXPLORE YOUR CAMPUS</span>
                <h1 className="inner-title">{page}<span>.</span></h1>
                <p className="inner-description">
                  {page === 'Study Material' && 'Handwritten notes, previous year solved question papers, and curated cheatsheets from university subjects.'}
                  {page === 'Timetable' && 'Track weekly lectures, tutorial batches, and lab sessions for 500+ batches synchronized live with the university master schedule.'}
                  {page === 'Societies' && 'Connect with 40+ student chapters, technical clubs, and creative organizations on campus.'}
                  {page === 'Events' && 'Browse upcoming workshops, tech fests, cultural nights, and campus activities.'}
                </p>

                {/* STUDY MATERIAL PAGE */}
                {page === 'Study Material' && (
                  <>
                    {/* Year Filter Pills */}
                    <div className="filter-bar">
                      {['ALL', '1', '2', '3', '4'].map((yr) => (
                        <button
                          key={yr}
                          className={`filter-btn ${selectedYear === yr ? 'active' : ''}`}
                          onClick={() => setSelectedYear(yr)}
                        >
                          {yr === 'ALL' ? 'All Years' : `Year ${yr}`}
                        </button>
                      ))}
                    </div>

                    <div className="course-grid inner-courses">
                      {filteredCourses.map((course, index) => (
                        <article className="course-card" key={course.id || course.name}>
                          <div
                            className={`course-image image-${(index % 4) + 1}`}
                            style={{
                              backgroundImage: `url(https://images.unsplash.com/${course.image}?auto=format&fit=crop&w=800&q=85)`,
                            }}
                          >
                            <div className="course-image-overlay" />
                            <span className="course-tag">{course.tag}</span>
                            <button
                              className={`save-button ${saved.includes(course.name) ? 'is-saved' : ''}`}
                              onClick={() => toggleSave(course.name)}
                            >
                              {saved.includes(course.name) ? '♥' : '♡'}
                            </button>
                          </div>
                          <div className="course-info">
                            <span className="section-kicker">{course.tag}</span>
                            <h3>{course.name}</h3>
                            <p>{course.detail}</p>
                            <button
                              className="course-action-btn"
                              onClick={() => {
                                if (course.rawSubject) {
                                  openSubjectModal(course.rawSubject)
                                } else {
                                  setNotice(`Accessing ${course.name} documents...`)
                                }
                              }}
                            >
                              <span>View files & syllabus</span>
                              <span>↗</span>
                            </button>
                          </div>
                        </article>
                      ))}
                      {filteredCourses.length === 0 && (
                        <div className="empty-state-box" style={{ gridColumn: '1 / -1' }}>
                          <span className="empty-icon">🔍</span>
                          <h3>No subjects found for Year {selectedYear}</h3>
                          <p>Try switching to "All Years" or clear your search.</p>
                          <button className="reset-search-btn" onClick={() => { setSelectedYear('ALL'); setSearch('') }}>
                            Reset filters
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* EVENTS PAGE */}
                {page === 'Events' && (
                  <div className="events-panel full-panel">
                    {events.map((event) => (
                      <div className="event-row" key={event.id || event.name}>
                        <div className="event-date">
                          <span className="event-month">{event.month}</span>
                          <strong className="event-day">{event.day}</strong>
                        </div>
                        <div className="event-info">
                          <strong>{event.name}</strong>
                          <span className="event-society-tag">{event.society} • {event.location}</span>
                        </div>
                        <span className="event-time">{event.time}</span>
                        <button
                          className="rsvp-button"
                          onClick={() => setNotice(`RSVP confirmed for ${event.name}!`)}
                        >
                          RSVP
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* TIMETABLE PAGE */}
                {page === 'Timetable' && (
                  <div className="timetable-container">
                    {/* Interactive Timetable Controls */}
                    <div className="timetable-controls-card">
                      <div className="timetable-selectors">
                        {/* Year Selector */}
                        <div className="control-field">
                          <label>Academic Year</label>
                          <select
                            className="control-select"
                            value={selectedTtYear}
                            onChange={(e) => {
                              const y = e.target.value
                              setSelectedTtYear(y)
                              const yo = timetableHierarchy.find((item) => item.year === y)
                              if (yo && yo.branches.length > 0) {
                                const b = yo.branches[0].branch
                                setSelectedTtBranch(b)
                                const bo = yo.branches[0]
                                if (bo.batches.length > 0) setSelectedTtBatch(bo.batches[0])
                              }
                            }}
                          >
                            {timetableHierarchy.map((y) => (
                              <option key={y.year} value={y.year}>{y.year}</option>
                            ))}
                          </select>
                        </div>

                        {/* Branch Selector */}
                        <div className="control-field">
                          <label>Department / Branch</label>
                          <select
                            className="control-select"
                            value={selectedTtBranch}
                            onChange={(e) => {
                              const b = e.target.value
                              setSelectedTtBranch(b)
                              const bo = availableBranches.find((item) => item.branch === b)
                              if (bo && bo.batches.length > 0) setSelectedTtBatch(bo.batches[0])
                            }}
                          >
                            {availableBranches.map((b) => (
                              <option key={b.branch} value={b.branch}>{b.branch} ({b.batchCount} batches)</option>
                            ))}
                          </select>
                        </div>

                        {/* Batch Selector */}
                        <div className="control-field">
                          <label>Batch Code</label>
                          <select
                            className="control-select"
                            value={selectedTtBatch}
                            onChange={(e) => setSelectedTtBatch(e.target.value)}
                          >
                            {availableBatches.map((bc) => (
                              <option key={bc} value={bc}>{bc}</option>
                            ))}
                          </select>
                        </div>

                        {/* Quick Search */}
                        <div className="control-field">
                          <label>Quick Find Batch</label>
                          <input
                            className="control-input"
                            placeholder="e.g. 1C11, 1A1, 2CO1..."
                            value={ttSearch}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase().trim()
                              setTtSearch(val)
                              if (val.length >= 3) {
                                setSelectedTtBatch(val)
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="batch-badge">
                        <span>Active Batch:</span>
                        <strong>{selectedTtBatch || 'None Selected'}</strong>
                      </div>
                    </div>

                    {/* Schedule Grid */}
                    <div className="timetable-grid">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
                        const sessions = batchSchedule && batchSchedule[day] ? batchSchedule[day] : []
                        return (
                          <div className="timetable-col" key={day}>
                            <div className="day-header">
                              <strong>{day}</strong>
                              <small>{sessions.length} {sessions.length === 1 ? 'class' : 'classes'}</small>
                            </div>

                            {sessions.map((slot, sIdx) => (
                              <div
                                className={`slot-card ${slot.type === 'Practical' || slot.type === 'Lab' ? 'highlight' : ''}`}
                                key={`${day}-${sIdx}`}
                              >
                                <span className="slot-time">{slot.time}</span>
                                <strong>{slot.name}</strong>
                                <small>
                                  {slot.room ? `Room ${slot.room}` : 'Classroom'} • {slot.code} • {slot.type || 'Lecture'}
                                </small>
                              </div>
                            ))}

                            {sessions.length === 0 && (
                              <div className="slot-card" style={{ opacity: 0.65 }}>
                                <small>No sessions scheduled</small>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* SOCIETIES PAGE */}
                {page === 'Societies' && (
                  <>
                    {/* Category Filter Pills */}
                    <div className="filter-bar">
                      {societyCategories.map((cat) => (
                        <button
                          key={cat}
                          className={`filter-btn ${societyCategory === cat ? 'active' : ''}`}
                          onClick={() => setSocietyCategory(cat)}
                        >
                          {cat === 'ALL' ? 'All Categories' : cat}
                        </button>
                      ))}
                    </div>

                    <div className="society-grid">
                      {filteredSocieties.map((soc, idx) => (
                        <article className="society-card" key={soc.id || soc.name}>
                          <div className="society-card-top">
                            <span>{String(idx + 1).padStart(2, '0')} / {soc.category || 'CAMPUS CHAPTER'}</span>
                            <span className="society-status-pill">Active</span>
                          </div>
                          <h2>{soc.name}</h2>
                          <p>{soc.description || 'Student run campus chapter focusing on member skill-development, workshops and university activities.'}</p>
                          <div className="society-meta">
                            <span>👥 {soc.category || 'General Member Wing'}</span>
                          </div>
                          {soc.instagram ? (
                            <a
                              href={soc.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: 'none' }}
                            >
                              <button type="button">
                                <span>Visit Instagram</span>
                                <span>↗</span>
                              </button>
                            </a>
                          ) : soc.website ? (
                            <a
                              href={soc.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: 'none' }}
                            >
                              <button type="button">
                                <span>Official Website</span>
                                <span>↗</span>
                              </button>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setNotice(`Applied to join ${soc.name}!`)}
                            >
                              <span>Join Society</span>
                              <span>↗</span>
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* SUBJECT RESOURCES MODAL */}
            {subjectModal && (
              <div className="modal-overlay" onClick={() => setSubjectModal(null)}>
                <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <h2>{subjectModal.name}</h2>
                      <p>
                        {subjectModal.code ? `${subjectModal.code} • ` : ''}Year {subjectModal.year} • {subjectModal.branch || 'ALL'}
                      </p>
                    </div>
                    <button
                      className="modal-close-btn"
                      onClick={() => setSubjectModal(null)}
                      aria-label="Close dialog"
                    >
                      ×
                    </button>
                  </div>

                  <div className="modal-body">
                    {modalLoading && (
                      <p style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                        Fetching study resources from server...
                      </p>
                    )}

                    {!modalLoading && (
                      <>
                        {/* PDFs */}
                        {subjectModal.resources?.pdf?.length > 0 && (
                          <div className="resource-category-section">
                            <span className="resource-category-title">
                              📄 PDF Documents & PYQs
                              <span className="resource-count-tag">{subjectModal.resources.pdf.length}</span>
                            </span>
                            {subjectModal.resources.pdf.map((res) => (
                              <div className="resource-item-card" key={res.id}>
                                <div className="resource-item-info">
                                  <span className="resource-icon-badge pdf">PDF</span>
                                  <div className="resource-text">
                                    <div className="resource-item-title">{res.title}</div>
                                    <div className="resource-item-meta">{formatFileSize(res.size_bytes)}</div>
                                  </div>
                                </div>
                                <div className="resource-actions">
                                  <a
                                    href={resolveFileUrl(res.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="action-pill-btn preview"
                                  >
                                    Preview ↗
                                  </a>
                                  <a
                                    href={resolveFileUrl(res.download_url)}
                                    download
                                    className="action-pill-btn download"
                                  >
                                    Download ⤓
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* PPTs */}
                        {subjectModal.resources?.ppt?.length > 0 && (
                          <div className="resource-category-section">
                            <span className="resource-category-title">
                              📊 Lecture Slides & PPTs
                              <span className="resource-count-tag">{subjectModal.resources.ppt.length}</span>
                            </span>
                            {subjectModal.resources.ppt.map((res) => (
                              <div className="resource-item-card" key={res.id}>
                                <div className="resource-item-info">
                                  <span className="resource-icon-badge ppt">PPT</span>
                                  <div className="resource-text">
                                    <div className="resource-item-title">{res.title}</div>
                                    <div className="resource-item-meta">{formatFileSize(res.size_bytes)}</div>
                                  </div>
                                </div>
                                <div className="resource-actions">
                                  <a
                                    href={resolveFileUrl(res.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="action-pill-btn preview"
                                  >
                                    Preview ↗
                                  </a>
                                  <a
                                    href={resolveFileUrl(res.download_url)}
                                    download
                                    className="action-pill-btn download"
                                  >
                                    Download ⤓
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Notes */}
                        {subjectModal.resources?.notes?.length > 0 && (
                          <div className="resource-category-section">
                            <span className="resource-category-title">
                              📝 Notes & Assignments
                              <span className="resource-count-tag">{subjectModal.resources.notes.length}</span>
                            </span>
                            {subjectModal.resources.notes.map((res) => (
                              <div className="resource-item-card" key={res.id}>
                                <div className="resource-item-info">
                                  <span className="resource-icon-badge notes">DOC</span>
                                  <div className="resource-text">
                                    <div className="resource-item-title">{res.title}</div>
                                    <div className="resource-item-meta">{formatFileSize(res.size_bytes)}</div>
                                  </div>
                                </div>
                                <div className="resource-actions">
                                  <a
                                    href={resolveFileUrl(res.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="action-pill-btn preview"
                                  >
                                    Preview ↗
                                  </a>
                                  <a
                                    href={resolveFileUrl(res.download_url)}
                                    download
                                    className="action-pill-btn download"
                                  >
                                    Download ⤓
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* If no files */}
                        {(!subjectModal.resources ||
                          (subjectModal.resources.pdf?.length === 0 &&
                            subjectModal.resources.ppt?.length === 0 &&
                            subjectModal.resources.notes?.length === 0 &&
                            subjectModal.resources.other?.length === 0)) && (
                          <div className="no-resources-msg">
                            No uploaded files found for this subject yet. You can upload files via the Admin portal at http://localhost:5001/admin!
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <footer className="footer">
              <div className="footer-left">
                <span className="footer-brand">UniFold.</span>
                <span>The Modern Student Campus Platform.</span>
              </div>
              <div className="footer-right">
                <span className="footer-pill">
                  {backendOnline ? 'BACKEND CONNECTED: PORT 5001' : 'DISCONNECTED'}
                </span>
                <span>MADE FOR CAMPUS LIFE.</span>
              </div>
            </footer>
          </main>
        </>
      )}
    </div>
  )
}

export default App
