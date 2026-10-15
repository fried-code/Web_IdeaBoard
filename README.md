# ⚡ IDEA//BOARD (Neo-Brutalist Edition)

![IdeaBoard Banner](docs/images/ideaboard_preview.jpg)

> A high-voltage, responsive **Neo-Brutalist Web Application** for organizing thoughts, sticky notes, checklists, bullet lists, and image moodboards — with **Trello-style drag-to-group lists**, **Neon Serverless PostgreSQL** persistence, user authentication, and live multi-device synchronization.

---

## 📸 Interface Showcase

<p align="center">
  <img src="docs/images/ideaboard_preview.jpg" alt="IdeaBoard Desktop Canvas View" width="68%" />
  <img src="docs/images/mobile_preview.jpg" alt="IdeaBoard Smartphone Mobile View" width="28%" />
</p>

---

## 🎨 Highlights & Features

### 1. ⚡ High-Contrast Neo-Brutalism Design
- **Bold Brutalist Aesthetic:** Chunky `3px solid #121212` black borders, sharp zero-blur drop shadows (`4px 4px 0 #121212`, `8px 8px 0 #121212`), high-contrast color chips (Neo Yellow, Acid Mint, Bubblegum Pink, Electric Cyan, Tangerine Orange, Hyper Lavender, Lime Punch).
- **Infinite Dot-Matrix Canvas:** Retro cream background (`#FAF7EE`) with responsive dot grid and smooth panning/scrolling.
- **Punchy Typography:** Powered by Google Fonts (*Space Grotesk*, *Plus Jakarta Sans*, *Patrick Hand*, *Caveat*, *Kalam*, *Courier Prime*).

### 2. 📋 Trello-Like Lists & Drag-to-Group Columns
- **Ghost List Creation:** Drag any card on top of another free card. An animated Neo-Brutalist **ghost column** previews the new group. Release to automatically bundle both notes into a new list column.
- **Drag Across Lists:** Drag cards between lists with real-time drop indicator lines showing the exact landing position.
- **Drag Out to Canvas:** Drag any note out of a list container and release on the open board to detach it (`list_id = null`) back into a freeform canvas note.
- **Direct List Creation:** Click the `+ List` button in the top bar or inside the mobile FAB menu to spawn dedicated column boards.

### 3. 🐘 Neon Serverless PostgreSQL Database
- **Cloud-Native Persistence:** All boards, lists, notes, checklists, bullet points, positions, colors, and uploaded images are saved directly in [Neon PostgreSQL](https://neon.tech).
- **Firewall-Proof HTTPS Driver:** Connects using Neon's serverless HTTP query protocol over port 443 with connection pooling (`requests.Session`), guaranteeing 100% connectivity even on restricted networks or firewalls where port 5432 is blocked.

### 4. 🔒 User Accounts & Scoped Workspaces
- **Authentication System:** Secure registration and login using salted password hashing (`werkzeug.security`).
- **Private Workspaces:** Each user's boards and notes are isolated to their account.
- **Instant Starter Boards:** Newly registered users are automatically provisioned with a curated starter board demonstrating notes, checklists, and list columns.

### 5. 📱 Smartphone & Mobile Usability
- **Floating Action Button (FAB):** Chunky bottom-right `+` button opens a quick menu to create notes, checklists, photos, or lists on smaller touchscreens.
- **Touch-Friendly Dragging:** Full touch support powered by Pointer Capture API (`pointerdown`, `pointermove`, `pointerup`) with dedicated drag handles and card headers.
- **Layout Switcher:** One-click toggle between **Freeform Infinite Canvas** and **Responsive Grid View** (single-column card scroll optimized for one-handed mobile browsing).
- **Direct Mobile Camera Upload:** Tap any image card to capture photos directly using your smartphone camera or select from the device gallery.

### 6. 🔄 Live Multi-Device Synchronization
- Real-time updates across multiple phones, tablets, and desktop browsers powered by WebSockets (`Flask-SocketIO`). Changes appear instantly on all connected devices without page refreshes.

---

## ☁️ Hosting on Render: Do You Need to Change Anything?

**Short answer:** You can continue hosting on [Render](https://render.com)! In fact, your hosting setup is now **cheaper and simpler**:

### What changed from SQLite to Neon:
| Previous Setup (SQLite) | New Setup (Neon PostgreSQL) |
|---|---|
| Required a paid Render **Persistent Disk** (~$7/month) to prevent database loss on container restarts. | **No disk needed!** All data lives in Neon's cloud database. |
| Single instance, disk tied to one server region. | Serverless, auto-scaling, with instant branching and automated backups. |
| Paid Web Service required for disks. | Runs smoothly on Render's **100% Free Web Service tier**. |

### Steps to update your deployment on Render:

1. **Remove Persistent Disk (Save $7/mo):**
   In your Render Dashboard, go to your service settings, remove the attached disk (`idea-board-disk`), and set your service plan to **Free**.
2. **Add Environment Variables in Render Dashboard:**
   Under your Web Service > **Environment**, add:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string (e.g. `postgresql://user:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require`)
   - `SECRET_KEY`: Any random secure string (or let Render generate one)
   - `PYTHON_VERSION`: `3.11.9`
3. **Verify Start Command:**
   Render uses the repository's `Procfile` / `render.yaml`:
   ```bash
   gunicorn --worker-class gthread --threads 50 -w 1 app:app
   ```
4. **Trigger Deploy:** Push your code to GitHub/GitLab and Render will deploy automatically!

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

## 📁 Repository Structure

```
ideaboard/
├── docs/
│   └── images/
│       ├── ideaboard_preview.jpg  # Desktop Neo-Brutalist UI preview
│       └── mobile_preview.jpg     # Smartphone responsive mockup
├── templates/
│   └── index.html                 # Neo-Brutalist HTML layout, modals, drawer & FAB
├── static/
│   ├── style.css                  # Neo-Brutalist styling, themes, animations & responsive queries
│   └── script.js                  # Client logic: drag/drop, ghost list grouping, touch events & sockets
├── app.py                         # Flask web server, auth routes, lists API & WebSocket handlers
├── db.py                          # Neon Serverless PostgreSQL connector (HTTPS port 443 protocol)
├── Procfile                       # Production process declaration for Render / Heroku
├── render.yaml                    # Infrastructure-as-code for Render deployment (Free tier)
├── requirements.txt               # Pinned Python dependencies
├── runtime.txt                    # Target Python runtime version (3.11.9)
├── .env.example                   # Sample environment configuration template
└── .gitignore                     # Git exclusions (.env, caches, virtual environments)
```

---

## 🔒 Security & Data Privacy

- **No Hardcoded Keys:** All database credentials, secrets, and environment tokens are managed strictly via environment variables (`DATABASE_URL`, `SECRET_KEY`).
- **Password Protection:** User passwords are never stored in plaintext; they are securely hashed using PBKDF2/SHA-256 via `werkzeug.security`.
- **JSON Data Backup & Restore:** Export your entire workspace into a portable `.json` backup file or import existing boards anytime from the top-bar Data menu.

---

## 📜 License
Distributed under the MIT License. Feel free to use, modify, and build upon it!
