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
