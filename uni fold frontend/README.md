# UniFold

UniFold is a web application designed for college campus life. It brings together academic study material, past examination questions (PYQs), weekly class timetables, student societies, and campus event tracking into a single portal.

The application includes an authentication flow, a resource directory with search and bookmarking capabilities, and an Obsidian Emerald dark mode.

---

## Features

- **Theme Engine**: Toggle between Light Mode (editorial campus layout) and Dark Mode (Obsidian Emerald high-contrast palette). Automatically detects system preferences and persists selection in `localStorage`.
- **Identity & Navigation**: Custom vector mark, responsive sidebar navigation, and mobile drawer layout.
- **Resource Repository**: Search and filter course modules, lecture notes, formula sheets, and past examination papers.
- **Bookmarking**: Save courses and resources to a local saved list.
- **Campus Schedule**: Weekly timetable view showing class locations, timings, and instructor details.
- **Events & Societies**: Directory of active student societies, workshop listings, and RSVP confirmations.
- **Authentication**: Portal sign-in form with college email validation and single sign-on (SSO) support.

---

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Vanilla CSS (Custom design tokens, Flexbox, Grid)
- **Fonts**: DM Sans, Manrope

---

## Local Development Setup

### Prerequisites

Ensure you have Node.js (v18 or higher) installed on your system.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/suhani-nagpal/unifold-app.git
   cd unifold-app
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. The development server runs at:
   ```text
   http://localhost:5173
   ```

---

## Project Structure

```text
unifold-app/
├── public/              # Favicon and static assets
├── src/
│   ├── assets/          # Application graphics
│   ├── App.css          # Design tokens and component stylesheets
│   ├── App.jsx          # Root application and page views
│   ├── index.css        # Typography and global resets
│   └── main.jsx         # Application entry point
├── package.json         # Package configuration and dependencies
└── vite.config.js       # Vite build configuration
```

