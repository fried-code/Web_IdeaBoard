# ⚡ IDEA//BOARD (Neo-Brutalist Edition)

A responsive, high-voltage **Neo-Brutalist Web Application** for organizing thoughts, notes, checklists, bullet lists, and image moodboards — powered by **Neon Serverless PostgreSQL** with user accounts and live multi-device synchronization.

---

## 🎨 Highlights & Features

- **Neo-Brutalism Design System:**
  - High-contrast aesthetic with thick ink-black borders (`3px solid #121212`), crisp drop shadows (`4px 4px 0px #121212`, `6px 6px 0px #121212`), tactile click/hover animations, and vibrant pop colors (Electric Yellow, Acid Mint, Bubblegum Pink, Sky Blue, Tangerine Orange, Hyper Lavender).
  - Warm vintage cream canvas (`#FAF7EE`) with a retro-modern dot matrix grid.
  - Bold typography powered by Google Fonts (*Space Grotesk*, *Plus Jakarta Sans*, *Patrick Hand*, *Caveat*, *Kalam*, *Courier Prime*).

- **Neon Serverless PostgreSQL Database:**
  - Fully integrated with Neon Cloud PostgreSQL (`users`, `boards`, and `notes` tables).
  - Realtime persistent storage: all sticky notes, to-dos, bullet lists, positions, fonts, colors, and uploaded photos/images are stored directly in your Neon database.
  - Robust driver layer running over standard HTTPS (port 443) to guarantee 100% connectivity across any network or firewall without port 5432 restrictions.

- **Account Creation & Login (User Authentication):**
  - Secure account registration and authentication with salted password hashing (`werkzeug.security`).
  - Each user has their own private workspace with multiple boards/pages.
  - Automatic onboarding: new accounts are automatically provisioned with a starter board featuring helpful welcome ideas and checklists.

- **Smartphone & Mobile Optimization:**
  - **Floating Action Button (FAB):** Chunky bottom-right `+` button opens a radial menu to instantly add Sticky Notes, To-Do Checklists, Bullet Lists, or Photos anywhere on mobile or desktop.
  - **Touch-Friendly Controls (No Right-Click Needed):** Each note has a dedicated drag grip (`⠿`) to easily move cards on touchscreens without page scroll interference, plus a note menu (`⋮`) for quick font, color, layer, or delete options.
  - **Layout View Switcher:** Toggle between **Freeform Canvas View** (drag-and-drop workspace) and **Responsive Card Grid View** (optimized single-column scrolling on smartphones).
  - **Direct Camera/Photo Upload:** Tap on any image note to upload photos from your smartphone camera or gallery.

- **Live Multi-Device Synchronization:**
  - Uses WebSockets (`Flask-SocketIO`) so updates across your phone, tablet, and desktop sync in real time without refreshing.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+ (or Python 3.13)
- Neon PostgreSQL connection string

### 2. Setup Environment

Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://neondb_owner:npg_HNTlDv9du2kL@ep-young-bird-b4215ifi.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
SECRET_KEY=ideaboard_neon_brutalist_super_secret_jwt_2026
PORT=5000
```

### 3. Install Dependencies & Run

```bash
# Activate virtual environment
venv\Scripts\activate   # On Windows
# or: source venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the application
python app.py
```

Open your browser and navigate to: **http://localhost:5000**

---

## 📁 Project Structure

```
├── app.py              # Flask app, authentication routes, REST API & Socket.IO handlers
├── db.py               # Neon Serverless PostgreSQL connection, schema init & queries
├── requirements.txt    # Python dependencies (Flask, psycopg2, requests, SocketIO)
├── .env                # Neon database URL and secret key
├── templates/
│   └── index.html      # Neo-Brutalist HTML layout, responsive drawer, modals & FAB
├── static/
│   ├── style.css       # Neo-Brutalist styling, color palettes, card layouts & mobile media queries
│   └── script.js       # Client state, auth flow, drag & touch handling, real-time sync
└── Procfile            # Production process configuration
```

---

## 💾 Backups & Export

- **Export Page:** Download all ideas on the current board as a formatted `.txt` outline.
- **Full JSON Backup & Restore:** Export all boards and notes as a portable JSON file, and restore anytime from the Data menu.
