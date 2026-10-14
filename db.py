import os
import json
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

NEON_CONN_STR = os.environ.get("DATABASE_URL", "").strip()

def _get_sql_endpoint():
    custom = os.environ.get("NEON_SQL_ENDPOINT")
    if custom:
        return custom
    if NEON_CONN_STR and "@" in NEON_CONN_STR:
        try:
            host_part = NEON_CONN_STR.split("@")[1].split("/")[0].split("?")[0]
            parts = host_part.split(".")
            if len(parts) >= 4 and "neon.tech" in host_part:
                cluster_domain = ".".join(parts[1:])
                return f"https://api.{cluster_domain}/sql"
        except Exception:
            pass
    return "https://api.c-6.us-east-2.aws.neon.tech/sql"

SQL_ENDPOINT = _get_sql_endpoint()

_http_session = requests.Session()
adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=20, max_retries=3)
_http_session.mount("https://", adapter)
_http_session.mount("http://", adapter)

def execute_neon(sql, params=None):
    """
    Executes a SQL query on Neon PostgreSQL using Neon's official serverless HTTP driver protocol.
    Works reliably over port 443 even in firewalled environments.
    """
    headers = {
        "Neon-Connection-String": f"{NEON_CONN_STR}&application_name=pkg%3Anpm%2F%2540neondatabase%2Fserverless%401.2.0",
        "Neon-Raw-Text-Output": "true",
        "Neon-Array-Mode": "true",
        "Content-Type": "application/json"
    }

    formatted_params = []
    if params:
        for p in params:
            if p is None:
                formatted_params.append(None)
            elif isinstance(p, (dict, list)):
                formatted_params.append(json.dumps(p))
            else:
                formatted_params.append(str(p))

    payload = {"query": sql, "params": formatted_params}
    
    try:
        resp = _http_session.post(SQL_ENDPOINT, headers=headers, json=payload, timeout=20)
        if resp.status_code != 200:
            err_msg = resp.text
            try:
                err_json = resp.json()
                err_msg = err_json.get("message", resp.text)
            except Exception:
                pass
            raise Exception(f"Neon Query Error ({resp.status_code}): {err_msg}")

        data = resp.json()
        fields = [f["name"] for f in data.get("fields", [])]
        rows = data.get("rows", [])
        
        result = []
        for row in rows:
            result.append(dict(zip(fields, row)))
        return result
    except requests.RequestException as e:
        logger.error(f"Network error communicating with Neon: {e}")
        raise

def init_db():
    """Initializes tables in Neon if they don't already exist."""
    execute_neon("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(120) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    execute_neon("""
    CREATE TABLE IF NOT EXISTS boards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    execute_neon("""
    CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL DEFAULT 'note',
        heading TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL DEFAULT '',
        items TEXT NOT NULL DEFAULT '[]',
        image TEXT,
        color VARCHAR(30) NOT NULL,
        x INTEGER NOT NULL DEFAULT 20,
        y INTEGER NOT NULL DEFAULT 20,
        rotation INTEGER NOT NULL DEFAULT 0,
        z_index INTEGER NOT NULL DEFAULT 1,
        font VARCHAR(100) NOT NULL DEFAULT 'Space Grotesk',
        bold INTEGER NOT NULL DEFAULT 0,
        width INTEGER NOT NULL DEFAULT 240,
        height INTEGER NOT NULL DEFAULT 200,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    execute_neon("""
    CREATE TABLE IF NOT EXISTS lists (
        id SERIAL PRIMARY KEY,
        board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'List',
        x INTEGER NOT NULL DEFAULT 100,
        y INTEGER NOT NULL DEFAULT 100,
        width INTEGER NOT NULL DEFAULT 310,
        color VARCHAR(30) NOT NULL DEFAULT '#FAF7EE',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """)

    execute_neon("""
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS list_id INTEGER REFERENCES lists(id) ON DELETE SET NULL;
    """)

    execute_neon("""
    ALTER TABLE notes ADD COLUMN IF NOT EXISTS list_order INTEGER NOT NULL DEFAULT 0;
    """)

def seed_starter_board(user_id):
    """Creates a default board and sample Neo-Brutalist cards for a newly registered user."""
    boards = execute_neon(
        "INSERT INTO boards (user_id, name, sort_order) VALUES ($1, $2, 0) RETURNING id;",
        [user_id, "💡 My First Board"]
    )
    if not boards:
        return
    board_id = boards[0]["id"]

    # 1. Welcome Sticky Note
    execute_neon("""
        INSERT INTO notes (board_id, type, heading, text, items, color, x, y, rotation, z_index, font, bold, width, height)
        VALUES ($1, 'note', '👋 Welcome to IdeaBoard!', 'This is your neo-brutalist digital workspace powered by Neon PostgreSQL.\n\nDouble tap or click anywhere to edit. Drag the note handles to rearrange!', '[]', '#FFE600', 40, 50, -2, 1, 'Space Grotesk', 0, 260, 220);
    """, [board_id])

    # 2. Checklist / Todo Note
    todo_items = [
        {"text": "Create account (Done!)", "done": True},
        {"text": "Add a new idea card", "done": False},
        {"text": "Try it on smartphone", "done": False},
        {"text": "Upload an image / photo", "done": False}
    ]
    execute_neon("""
        INSERT INTO notes (board_id, type, heading, text, items, color, x, y, rotation, z_index, font, bold, width, height)
        VALUES ($1, 'todo', '✅ Quick Tasks', '', $2, '#23F0C7', 340, 50, 1, 2, 'Space Grotesk', 0, 260, 240);
    """, [board_id, todo_items])

    # 3. Bullet list note
    bullet_items = ["Neo-Brutalism theme", "Real-time sync", "Mobile & tablet friendly", "Saved in Neon PostgreSQL cloud"]
    execute_neon("""
        INSERT INTO notes (board_id, type, heading, text, items, color, x, y, rotation, z_index, font, bold, width, height)
        VALUES ($1, 'bullets', '⚡ Cool Features', '', $2, '#FF66C4', 640, 50, -1, 3, 'Space Grotesk', 0, 260, 230);
    """, [board_id, bullet_items])

    return board_id
