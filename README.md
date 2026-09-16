# Idea Board

A tiny Flask app that shows your ideas as sticky notes, bullet lists, to-do
lists, and images on a corkboard, organized into pages. Add something,
drag it anywhere, resize it, remove it when you're done. Everything is
saved in a SQLite database on the server, and changes sync live to every
other tab and device that has the page open.

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
   - Start command: `gunicorn --worker-class eventlet -w 1 app:app`
4. Deploy.

Or, if you'd rather not click through the UI: this repo includes a
`render.yaml`, so you can use Render's **Blueprint** deploy — point it at the
repo and it configures the service (including a small persistent disk) for you.

**Note on the start command:** live sync uses WebSockets (Flask-SocketIO),
which need an async worker to hold many connections open at once. That's
why the start command uses `--worker-class eventlet` instead of Render's
plain `gunicorn app:app` default — don't drop that flag.

### Important: persistence

Render's default filesystem is **ephemeral** — it resets on every deploy or
restart, which would wipe your notes. Two ways to fix that:

- **Persistent disk (included in `render.yaml`)** — mounts a small disk at
  `/var/data` and stores `board.db` there, so it survives restarts/redeploys.
  This is on Render's paid tiers, not the free plan.
- **Free-tier alternative** — swap SQLite for Render's free PostgreSQL add-on.
  If you outgrow SQLite or want this, just ask and I can convert the app to
  use Postgres instead.

**Either way, keep backups.** Use the **⬇️ Backup all** button in the app
any time — it downloads a single JSON file with every page and every note
(including images) in it. If a deploy ever resets your database, or
something goes wrong, click **⬆️ Restore backup** and pick that file to get
everything back. Restoring replaces whatever is currently on the site, so
it's meant for "get my data back," not merging two boards together.

## Live sync

The app uses WebSockets (via Flask-SocketIO) so that when you or anyone
else adds, edits, moves, or deletes something, every other open tab/device
sees it appear automatically — no refresh needed. It won't interrupt you
mid-edit: if an update comes in for a note you're actively typing in, that
one note is left alone until you click away, then it catches up.

There's no login/accounts — anyone with the link sees and can edit the
same shared board. Keep that in mind before sharing the URL widely.

## Project structure

```
app.py              Flask app + REST API + WebSocket events
templates/index.html Board page
static/style.css     Corkboard + note styling
static/script.js     Rendering, drag/resize, editing, live sync, backup/restore
requirements.txt
Procfile             Start command for Render (eventlet worker)
render.yaml           Optional one-click Render blueprint
```

## Possible next steps

- Colors/tags per note (e.g. by category)
- Search/filter box
- Archive instead of delete
- Login so multiple people can have separate boards

