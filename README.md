# Idea Board

A tiny Flask app that shows your ideas as draggable sticky notes on a corkboard.
Add a note, drag it anywhere, remove it when you're done. Everything is saved
in a SQLite database on the server.

## Run it locally

```bash
python -m venv venv
source venv/bin/activate      # on Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Then open http://localhost:5000

## Deploy to Render

1. Push this folder to a new GitHub repo.
2. On Render: **New +** → **Web Service** → connect your repo.
3. Render will detect `Procfile` / you can set manually:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app`
4. Deploy.

Or, if you'd rather not click through the UI: this repo includes a
`render.yaml`, so you can use Render's **Blueprint** deploy — point it at the
repo and it configures the service (including a small persistent disk) for you.

### Important: persistence

Render's default filesystem is **ephemeral** — it resets on every deploy or
restart, which would wipe your notes. Two ways to fix that:

- **Persistent disk (included in `render.yaml`)** — mounts a small disk at
  `/var/data` and stores `board.db` there, so it survives restarts/redeploys.
  This is on Render's paid tiers, not the free plan.
- **Free-tier alternative** — swap SQLite for Render's free PostgreSQL add-on.
  If you outgrow SQLite or want this, just ask and I can convert the app to
  use Postgres instead.

## Project structure

```
app.py              Flask app + API routes
templates/index.html Board page
static/style.css     Corkboard + sticky note styling
static/script.js     Fetch notes, drag-to-move, add/delete
requirements.txt
Procfile             Start command for Render
render.yaml           Optional one-click Render blueprint
```

## Possible next steps

- Colors/tags per note (e.g. by category)
- Search/filter box
- Archive instead of delete
- Login so multiple people can have separate boards
