import json
import os
import random
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, session
from flask_socketio import SocketIO, join_room, leave_room
from werkzeug.security import check_password_hash, generate_password_hash

import db

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "neo-brutalism-ideaboard-key-2026")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

COLORS = [
    "#FFE600",  # Neo Yellow
    "#FF66C4",  # Bubblegum Pink
    "#23F0C7",  # Acid Mint / Turquoise
    "#38BDF8",  # Electric Sky Blue
    "#FF8C42",  # Tangerine Orange
    "#C084FC",  # Neon Lavender
    "#A3E635",  # Lime Punch
    "#FFFFFF",  # Clean Neo White
]

DEFAULT_SIZE = {
    "note": (260, 220),
    "bullets": (270, 240),
    "todo": (270, 250),
    "image": (280, 290),
}

DEFAULT_ITEMS = {
    "note": [],
    "bullets": [""],
    "todo": [{"text": "", "done": False}],
    "image": [],
}


# Initialize Neon tables on startup
try:
    db.init_db()
    print("Neon DB initialized successfully.")
except Exception as e:
    print(f"Warning: Could not initialize Neon DB on startup: {e}")


def get_current_user_id():
    return session.get("user_id")


def require_auth():
    uid = get_current_user_id()
    if not uid:
        return None
    return uid


def note_row_to_dict(row):
    d = dict(row)
    # Parse items JSON safely
    items_raw = d.get("items")
    if isinstance(items_raw, str):
        try:
            d["items"] = json.loads(items_raw)
        except Exception:
            d["items"] = []
    elif not isinstance(items_raw, list):
        d["items"] = []

    # Ensure integer/boolean types
    d["id"] = int(d["id"])
    d["board_id"] = int(d["board_id"])
    d["list_id"] = int(d["list_id"]) if d.get("list_id") is not None else None
    d["list_order"] = int(d.get("list_order") or 0)
    d["x"] = int(d.get("x") or 0)
    d["y"] = int(d.get("y") or 0)
    d["rotation"] = int(d.get("rotation") or 0)
    d["z_index"] = int(d.get("z_index") or 1)
    d["bold"] = int(d.get("bold") or 0)
    d["width"] = int(d.get("width") or 240)
    d["height"] = int(d.get("height") or 200)
    return d


def list_row_to_dict(row):
    d = dict(row)
    d["id"] = int(d["id"])
    d["board_id"] = int(d["board_id"])
    d["title"] = str(d.get("title") or "List")
    d["x"] = int(d.get("x") or 100)
    d["y"] = int(d.get("y") or 100)
    d["width"] = int(d.get("width") or 310)
    d["color"] = str(d.get("color") or "#FAF7EE")
    d["sort_order"] = int(d.get("sort_order") or 0)
    return d


def client_sid():
    return request.headers.get("X-Client-Id") or None


@app.route("/")
def index():
    return render_template("index.html")


# ---------- Authentication API ----------


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"user": None})

    rows = db.execute_neon(
        "SELECT id, username, email, created_at FROM users WHERE id = $1 LIMIT 1;",
        [uid],
    )
    if not rows:
        session.clear()
        return jsonify({"user": None})

    user = dict(rows[0])
    user["id"] = int(user["id"])
    return jsonify({"user": user})


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400
    if not email or "@" not in email:
        return jsonify({"error": "Please enter a valid email address."}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    # Check for existing username or email
    existing = db.execute_neon(
        "SELECT id, username, email FROM users WHERE username = $1 OR email = $2 LIMIT 1;",
        [username, email],
    )
    if existing:
        if existing[0]["username"].lower() == username.lower():
            return jsonify({"error": "That username is already taken. Try another!"}), 400
        return jsonify({"error": "An account with that email already exists."}), 400

    password_hash = generate_password_hash(password)
    res = db.execute_neon(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email;",
        [username, email, password_hash],
    )
    new_user = res[0]
    user_id = int(new_user["id"])

    # Seed starter boards and welcome notes in Neon DB
    db.seed_starter_board(user_id)

    session["user_id"] = user_id
    session["username"] = new_user["username"]

    return jsonify({"ok": True, "user": {"id": user_id, "username": new_user["username"], "email": new_user["email"]}}), 201


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(force=True) or {}
    identifier = (data.get("identifier") or "").strip()
    password = data.get("password") or ""

    if not identifier or not password:
        return jsonify({"error": "Please provide username/email and password."}), 400

    rows = db.execute_neon(
        "SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $2 LIMIT 1;",
        [identifier, identifier.lower()],
    )
    if not rows or not check_password_hash(rows[0]["password_hash"], password):
        return jsonify({"error": "Invalid username/email or password."}), 401

    user = rows[0]
    user_id = int(user["id"])
    session["user_id"] = user_id
    session["username"] = user["username"]

    return jsonify({"ok": True, "user": {"id": user_id, "username": user["username"], "email": user["email"]}})


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


# ---------- Realtime Sockets ----------


@app.route("/api/boards", methods=["GET"])
def list_boards():
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    rows = db.execute_neon(
        "SELECT id, name, sort_order FROM boards WHERE user_id = $1 ORDER BY sort_order, id;",
        [uid],
    )
    if not rows:
        # Create default board if none exist
        res = db.execute_neon(
            "INSERT INTO boards (user_id, name, sort_order) VALUES ($1, '💡 My Ideas', 0) RETURNING id, name;",
            [uid],
        )
        return jsonify([{"id": int(res[0]["id"]), "name": res[0]["name"]}])

    return jsonify([{"id": int(r["id"]), "name": r["name"]} for r in rows])


@app.route("/api/boards", methods=["POST"])
def create_board():
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Board name is required."}), 400

    max_order_row = db.execute_neon(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM boards WHERE user_id = $1;",
        [uid],
    )
    max_order = int(max_order_row[0]["m"]) if max_order_row and max_order_row[0]["m"] is not None else -1

    res = db.execute_neon(
        "INSERT INTO boards (user_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id, name;",
        [uid, name, max_order + 1],
    )
    board_id = int(res[0]["id"])
    payload = {"id": board_id, "name": name}
    socketio.emit("board_created", payload, room=f"user-{uid}", skip_sid=client_sid())
    return jsonify(payload), 201


@app.route("/api/boards/<int:board_id>", methods=["DELETE"])
def delete_board(board_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    count_row = db.execute_neon(
        "SELECT COUNT(*) AS c FROM boards WHERE user_id = $1;",
        [uid],
    )
    if int(count_row[0]["c"]) <= 1:
        return jsonify({"error": "Cannot delete your only board page."}), 400

    db.execute_neon("DELETE FROM notes WHERE board_id = $1;", [board_id])
    db.execute_neon("DELETE FROM boards WHERE id = $1 AND user_id = $2;", [board_id, uid])

    socketio.emit("board_deleted", {"id": board_id}, room=f"user-{uid}", skip_sid=client_sid())
    return jsonify({"ok": True})


@app.route("/api/boards/<int:board_id>/rename", methods=["PUT"])
def rename_board(board_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required."}), 400

    db.execute_neon("UPDATE boards SET name = $1 WHERE id = $2 AND user_id = $3;", [name, board_id, uid])
    payload = {"id": board_id, "name": name}
    socketio.emit("board_renamed", payload, room=f"user-{uid}", skip_sid=client_sid())
    return jsonify({"ok": True})


@app.route("/api/boards/<int:board_id>/export", methods=["GET"])
def export_board(board_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    boards = db.execute_neon("SELECT id, name FROM boards WHERE id = $1 AND user_id = $2;", [board_id, uid])
    if not boards:
        return jsonify({"error": "Board not found."}), 404
    board = boards[0]

    rows = db.execute_neon(
        "SELECT heading, text, type, items FROM notes WHERE board_id = $1 ORDER BY z_index, id;",
        [board_id],
    )

    lines = [f"⚡ {board['name']}", "=" * (len(board['name']) + 3), ""]
    if not rows:
        lines.append("(No ideas on this board yet)")

    for i, row in enumerate(rows, start=1):
        heading = (row["heading"] or "").strip() or f"Idea {i}"
        lines.append(f"{i}. {heading}")
        note_type = row["type"] or "note"

        if note_type == "note":
            body = (row["text"] or "").strip()
            if body:
                lines.append("\n".join("   " + line for line in body.splitlines()))
        elif note_type == "bullets":
            try:
                items = json.loads(row["items"] or "[]")
            except Exception:
                items = []
            for item in items:
                if str(item).strip():
                    lines.append(f"   - {item}")
        elif note_type == "todo":
            try:
                items = json.loads(row["items"] or "[]")
            except Exception:
                items = []
            for item in items:
                text = (item.get("text") or "").strip() if isinstance(item, dict) else ""
                if text:
                    box = "[x]" if isinstance(item, dict) and item.get("done") else "[ ]"
                    lines.append(f"   {box} {text}")
        elif note_type == "image":
            lines.append("   [🖼️ Image attachment saved in Neon DB]")

        lines.append("")

    content = "\n".join(lines).rstrip() + "\n"
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in board["name"]).strip()
    filename = f"{safe_name or 'board'}_ideas.txt"

    return Response(
        content,
        mimetype="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- Notes API ----------


@app.route("/api/boards/<int:board_id>/notes", methods=["GET"])
def list_notes(board_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    # Verify ownership of board
    b = db.execute_neon("SELECT id FROM boards WHERE id = $1 AND user_id = $2;", [board_id, uid])
    if not b:
        return jsonify([]), 200

    rows = db.execute_neon(
        "SELECT id, board_id, list_id, list_order, type, heading, text, items, image, color, x, y, "
        "rotation, z_index, font, bold, width, height "
        "FROM notes WHERE board_id = $1 ORDER BY list_order ASC, z_index ASC, id ASC;",
        [board_id],
    )
    return jsonify([note_row_to_dict(r) for r in rows])


@app.route("/api/boards/<int:board_id>/notes", methods=["POST"])
def create_note(board_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    b = db.execute_neon("SELECT id FROM boards WHERE id = $1 AND user_id = $2;", [board_id, uid])
    if not b:
        return jsonify({"error": "Board not found."}), 404

    data = request.get_json(force=True) or {}
    note_type = data.get("type") or "note"
    if note_type not in DEFAULT_SIZE:
        note_type = "note"

    heading = data.get("heading", "")
    text = data.get("text", "")
    items = data.get("items", DEFAULT_ITEMS[note_type])
    image = data.get("image")
    color = data.get("color") or random.choice(COLORS)
    x = int(data.get("x", random.randint(30, 480)))
    y = int(data.get("y", random.randint(40, 320)))
    rotation = int(data.get("rotation", random.randint(-4, 4)))
    default_w, default_h = DEFAULT_SIZE[note_type]
    width = int(data.get("width", default_w))
    height = int(data.get("height", default_h))

    list_id = data.get("list_id")
    if list_id is not None:
        try:
            list_id = int(list_id)
        except Exception:
            list_id = None
    list_order = int(data.get("list_order", 0))

    max_z_row = db.execute_neon(
        "SELECT COALESCE(MAX(z_index), 0) AS m FROM notes WHERE board_id = $1;",
        [board_id],
    )
    max_z = int(max_z_row[0]["m"]) if max_z_row and max_z_row[0]["m"] is not None else 0

    res = db.execute_neon(
        """
        INSERT INTO notes (board_id, list_id, list_order, type, heading, text, items, image, color, x, y,
        rotation, z_index, width, height)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, board_id, list_id, list_order, type, heading, text, items, image, color, x, y,
        rotation, z_index, font, bold, width, height;
        """,
        [
            board_id,
            list_id,
            list_order,
            note_type,
            heading,
            text,
            items,
            image,
            color,
            x,
            y,
            rotation,
            max_z + 1,
            width,
            height,
        ],
    )
    note = note_row_to_dict(res[0])
    socketio.emit("note_created", note, room=f"board-{board_id}", skip_sid=client_sid())
    return jsonify(note), 201


@app.route("/api/notes/<int:note_id>", methods=["PUT"])
def update_note(note_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    data = request.get_json(force=True) or {}
    fields = []
    values = []
    param_idx = 1

    allowed_keys = [
        "heading",
        "text",
        "x",
        "y",
        "rotation",
        "z_index",
        "font",
        "bold",
        "color",
        "width",
        "height",
        "image",
        "list_id",
        "list_order",
    ]

    for key in allowed_keys:
        if key in data:
            fields.append(f"{key} = ${param_idx}")
            val = data[key]
            if key == "list_id" and val is not None:
                try:
                    val = int(val)
                except Exception:
                    val = None
            values.append(val)
            param_idx += 1

    if "items" in data:
        fields.append(f"items = ${param_idx}")
        values.append(json.dumps(data["items"]) if not isinstance(data["items"], str) else data["items"])
        param_idx += 1

    if not fields:
        return jsonify({"error": "No fields to update."}), 400

    values.append(note_id)
    values.append(uid)
    sql = f"""
        UPDATE notes SET {', '.join(fields)}
        WHERE id = ${param_idx} AND board_id IN (SELECT id FROM boards WHERE user_id = ${param_idx + 1})
        RETURNING id, board_id, list_id, list_order, type, heading, text, items, image, color, x, y,
        rotation, z_index, font, bold, width, height;
    """

    res = db.execute_neon(sql, values)
    if not res:
        return jsonify({"error": "Note not found or unauthorized."}), 404

    note = note_row_to_dict(res[0])
    socketio.emit("note_updated", note, room=f"board-{note['board_id']}", skip_sid=client_sid())
    return jsonify({"ok": True, "note": note})



@app.route("/api/notes/<int:note_id>/front", methods=["PUT"])
def bring_to_front(note_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    note_rows = db.execute_neon(
        "SELECT n.id, n.board_id FROM notes n JOIN boards b ON n.board_id = b.id WHERE n.id = $1 AND b.user_id = $2;",
        [note_id, uid],
    )
    if not note_rows:
        return jsonify({"error": "Note not found."}), 404

    board_id = int(note_rows[0]["board_id"])
    max_z_row = db.execute_neon(
        "SELECT COALESCE(MAX(z_index), 0) AS m FROM notes WHERE board_id = $1;",
        [board_id],
    )
    new_z = int(max_z_row[0]["m"]) + 1

    db.execute_neon("UPDATE notes SET z_index = $1 WHERE id = $2;", [new_z, note_id])
    socketio.emit("note_updated", {"id": note_id, "board_id": board_id, "z_index": new_z}, room=f"board-{board_id}", skip_sid=client_sid())
    return jsonify({"z_index": new_z})


@app.route("/api/notes/<int:note_id>/back", methods=["PUT"])
def send_to_back(note_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    note_rows = db.execute_neon(
        "SELECT n.id, n.board_id FROM notes n JOIN boards b ON n.board_id = b.id WHERE n.id = $1 AND b.user_id = $2;",
        [note_id, uid],
    )
    if not note_rows:
        return jsonify({"error": "Note not found."}), 404

    board_id = int(note_rows[0]["board_id"])
    min_z_row = db.execute_neon(
        "SELECT COALESCE(MIN(z_index), 0) AS m FROM notes WHERE board_id = $1;",
        [board_id],
    )
    new_z = max(0, int(min_z_row[0]["m"]) - 1)

    db.execute_neon("UPDATE notes SET z_index = $1 WHERE id = $2;", [new_z, note_id])
    socketio.emit("note_updated", {"id": note_id, "board_id": board_id, "z_index": new_z}, room=f"board-{board_id}", skip_sid=client_sid())
    return jsonify({"z_index": new_z})


@app.route("/api/notes/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    note_rows = db.execute_neon(
        "SELECT n.id, n.board_id FROM notes n JOIN boards b ON n.board_id = b.id WHERE n.id = $1 AND b.user_id = $2;",
        [note_id, uid],
    )
    if not note_rows:
        return jsonify({"error": "Note not found."}), 404

    board_id = int(note_rows[0]["board_id"])
    db.execute_neon("DELETE FROM notes WHERE id = $1;", [note_id])
    socketio.emit("note_deleted", {"id": note_id, "board_id": board_id}, room=f"board-{board_id}", skip_sid=client_sid())
    return jsonify({"ok": True})


# ---------- Lists API (Trello-like grouping columns) ----------


@app.route("/api/boards/<int:board_id>/lists", methods=["GET"])
def get_board_lists(board_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    b = db.execute_neon("SELECT id FROM boards WHERE id = $1 AND user_id = $2;", [board_id, uid])
    if not b:
        return jsonify([]), 200

    rows = db.execute_neon(
        "SELECT id, board_id, title, x, y, width, color, sort_order FROM lists WHERE board_id = $1 ORDER BY sort_order, id;",
        [board_id],
    )
    return jsonify([list_row_to_dict(r) for r in rows])


@app.route("/api/boards/<int:board_id>/lists", methods=["POST"])
def create_board_list(board_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    b = db.execute_neon("SELECT id FROM boards WHERE id = $1 AND user_id = $2;", [board_id, uid])
    if not b:
        return jsonify({"error": "Board not found."}), 404

    data = request.get_json(force=True) or {}
    title = (data.get("title") or "New List").strip()
    x = int(data.get("x", 120))
    y = int(data.get("y", 100))
    width = int(data.get("width", 310))
    color = data.get("color") or "#FAF7EE"

    max_order_row = db.execute_neon(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM lists WHERE board_id = $1;",
        [board_id],
    )
    max_order = int(max_order_row[0]["m"]) if max_order_row and max_order_row[0]["m"] is not None else -1

    res = db.execute_neon(
        "INSERT INTO lists (board_id, title, x, y, width, color, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, board_id, title, x, y, width, color, sort_order;",
        [board_id, title, x, y, width, color, max_order + 1],
    )
    new_list = list_row_to_dict(res[0])
    socketio.emit("list_created", new_list, room=f"board-{board_id}", skip_sid=client_sid())
    return jsonify(new_list), 201


@app.route("/api/lists/<int:list_id>", methods=["PUT"])
def update_board_list(list_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    l_row = db.execute_neon(
        "SELECT l.id, l.board_id FROM lists l JOIN boards b ON l.board_id = b.id WHERE l.id = $1 AND b.user_id = $2;",
        [list_id, uid],
    )
    if not l_row:
        return jsonify({"error": "List not found."}), 404

    data = request.get_json(force=True) or {}
    fields = []
    values = []
    param_idx = 1
    for key in ["title", "x", "y", "width", "color", "sort_order"]:
        if key in data:
            fields.append(f"{key} = ${param_idx}")
            values.append(data[key])
            param_idx += 1

    if not fields:
        return jsonify({"error": "No fields to update."}), 400

    values.append(list_id)
    sql = f"UPDATE lists SET {', '.join(fields)} WHERE id = ${param_idx} RETURNING id, board_id, title, x, y, width, color, sort_order;"
    res = db.execute_neon(sql, values)
    updated_list = list_row_to_dict(res[0])
    socketio.emit("list_updated", updated_list, room=f"board-{updated_list['board_id']}", skip_sid=client_sid())
    return jsonify({"ok": True, "list": updated_list})


@app.route("/api/lists/<int:list_id>", methods=["DELETE"])
def delete_board_list(list_id):
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    l_row = db.execute_neon(
        "SELECT l.id, l.board_id, l.x, l.y FROM lists l JOIN boards b ON l.board_id = b.id WHERE l.id = $1 AND b.user_id = $2;",
        [list_id, uid],
    )
    if not l_row:
        return jsonify({"error": "List not found."}), 404

    board_id = int(l_row[0]["board_id"])
    base_x = int(l_row[0].get("x") or 100)
    base_y = int(l_row[0].get("y") or 100)

    # Detach notes from this list (restore them as free cards on the board)
    notes_in_list = db.execute_neon("SELECT id FROM notes WHERE list_id = $1 ORDER BY list_order, id;", [list_id])
    for idx, n in enumerate(notes_in_list):
        up_res = db.execute_neon(
            """
            UPDATE notes SET list_id = NULL, x = $1, y = $2 WHERE id = $3
            RETURNING id, board_id, list_id, list_order, type, heading, text, items, image, color, x, y,
            rotation, z_index, font, bold, width, height;
            """,
            [base_x + (idx * 30), base_y + (idx * 30), n["id"]],
        )
        if up_res:
            socketio.emit("note_updated", note_row_to_dict(up_res[0]), room=f"board-{board_id}", skip_sid=client_sid())

    db.execute_neon("DELETE FROM lists WHERE id = $1;", [list_id])
    socketio.emit("list_deleted", {"id": list_id, "board_id": board_id}, room=f"board-{board_id}", skip_sid=client_sid())
    return jsonify({"ok": True})


@app.route("/api/lists/create-group", methods=["POST"])
def create_group_list():
    """Create a list and put multiple notes into it atomically (drag cards on top of each other)."""
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    data = request.get_json(force=True) or {}
    board_id = data.get("board_id")
    if not board_id:
        return jsonify({"error": "board_id is required"}), 400

    b = db.execute_neon("SELECT id FROM boards WHERE id = $1 AND user_id = $2;", [board_id, uid])
    if not b:
        return jsonify({"error": "Board not found."}), 404

    title = (data.get("title") or "New List").strip()
    x = int(data.get("x", 100))
    y = int(data.get("y", 100))
    note_ids = data.get("note_ids") or []

    max_order_row = db.execute_neon(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM lists WHERE board_id = $1;",
        [board_id],
    )
    max_order = int(max_order_row[0]["m"]) if max_order_row and max_order_row[0]["m"] is not None else -1

    res = db.execute_neon(
        "INSERT INTO lists (board_id, title, x, y, width, color, sort_order) VALUES ($1, $2, $3, $4, 310, '#FAF7EE', $5) RETURNING id, board_id, title, x, y, width, color, sort_order;",
        [board_id, title, x, y, max_order + 1],
    )
    new_list = list_row_to_dict(res[0])
    list_id = new_list["id"]

    updated_notes = []
    for order, nid in enumerate(note_ids):
        up_res = db.execute_neon(
            """
            UPDATE notes SET list_id = $1, list_order = $2
            WHERE id = $3 AND board_id = $4
            RETURNING id, board_id, list_id, list_order, type, heading, text, items, image, color, x, y,
            rotation, z_index, font, bold, width, height;
            """,
            [list_id, order, nid, board_id],
        )
        if up_res:
            n_dict = note_row_to_dict(up_res[0])
            updated_notes.append(n_dict)
            socketio.emit("note_updated", n_dict, room=f"board-{board_id}", skip_sid=client_sid())

    socketio.emit("list_created", new_list, room=f"board-{board_id}", skip_sid=client_sid())
    return jsonify({"list": new_list, "notes": updated_notes}), 201


# ---------- Backup / Restore (scoped to current user) ----------


@app.route("/api/export-all", methods=["GET"])
def export_all():
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    boards_rows = db.execute_neon(
        "SELECT id, name, sort_order FROM boards WHERE user_id = $1 ORDER BY sort_order, id;",
        [uid],
    )
    lists_rows = db.execute_neon(
        "SELECT id, board_id, title, x, y, width, color, sort_order FROM lists WHERE board_id IN (SELECT id FROM boards WHERE user_id = $1) ORDER BY sort_order, id;",
        [uid],
    )
    notes_rows = db.execute_neon(
        "SELECT * FROM notes WHERE board_id IN (SELECT id FROM boards WHERE user_id = $1) ORDER BY id;",
        [uid],
    )

    data = {
        "app": "neo-brutalist-idea-board",
        "version": 3,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "boards": [dict(r) for r in boards_rows],
        "lists": [list_row_to_dict(r) for r in lists_rows],
        "notes": [note_row_to_dict(r) for r in notes_rows],
    }
    content = json.dumps(data, indent=2)
    filename = f"ideaboard-neon-backup-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"

    return Response(
        content,
        mimetype="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.route("/api/import-all", methods=["POST"])
def import_all():
    uid = require_auth()
    if not uid:
        return jsonify({"error": "auth_required"}), 401

    data = request.get_json(force=True) or {}
    boards_in = data.get("boards")
    lists_in = data.get("lists") or []
    notes_in = data.get("notes")
    if not isinstance(boards_in, list) or not isinstance(notes_in, list) or not boards_in:
        return jsonify({"error": "Invalid backup JSON format."}), 400

    try:
        # Delete user's current notes, lists and boards
        db.execute_neon("DELETE FROM notes WHERE board_id IN (SELECT id FROM boards WHERE user_id = $1);", [uid])
        db.execute_neon("DELETE FROM lists WHERE board_id IN (SELECT id FROM boards WHERE user_id = $1);", [uid])
        db.execute_neon("DELETE FROM boards WHERE user_id = $1;", [uid])

        id_map = {}
        for b in boards_in:
            old_id = b.get("id")
            name = str(b.get("name") or "Untitled")[:200]
            sort_order = int(b.get("sort_order") or 0)
            res = db.execute_neon(
                "INSERT INTO boards (user_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id;",
                [uid, name, sort_order],
            )
            if old_id is not None and res:
                id_map[old_id] = int(res[0]["id"])

        list_map = {}
        for l in lists_in:
            old_lid = l.get("id")
            t_bid = id_map.get(l.get("board_id"))
            if not t_bid and id_map:
                t_bid = list(id_map.values())[0]
            if not t_bid:
                continue
            l_res = db.execute_neon(
                "INSERT INTO lists (board_id, title, x, y, width, color, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;",
                [t_bid, str(l.get("title") or "List"), int(l.get("x") or 100), int(l.get("y") or 100), int(l.get("width") or 310), str(l.get("color") or "#FAF7EE"), int(l.get("sort_order") or 0)]
            )
            if old_lid is not None and l_res:
                list_map[old_lid] = int(l_res[0]["id"])

        for n in notes_in:
            target_board_id = id_map.get(n.get("board_id"))
            if not target_board_id and id_map:
                target_board_id = list(id_map.values())[0]
            if not target_board_id:
                continue

            target_list_id = list_map.get(n.get("list_id")) if n.get("list_id") is not None else None

            note_type = n.get("type") or "note"
            if note_type not in DEFAULT_SIZE:
                note_type = "note"
            default_w, default_h = DEFAULT_SIZE[note_type]

            db.execute_neon(
                """
                INSERT INTO notes (board_id, list_id, list_order, type, heading, text, items, image, color,
                x, y, rotation, z_index, font, bold, width, height)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);
                """,
                [
                    target_board_id,
                    target_list_id,
                    int(n.get("list_order") or 0),
                    note_type,
                    n.get("heading", "") or "",
                    n.get("text", "") or "",
                    n.get("items") or [],
                    n.get("image"),
                    n.get("color") or random.choice(COLORS),
                    int(n.get("x") or 0),
                    int(n.get("y") or 0),
                    int(n.get("rotation") or 0),
                    int(n.get("z_index") or 1),
                    n.get("font") or "Space Grotesk",
                    1 if n.get("bold") else 0,
                    int(n.get("width") or default_w),
                    int(n.get("height") or default_h),
                ],
            )


        socketio.emit("data_imported", {}, room=f"user-{uid}", skip_sid=client_sid())
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": f"Failed to restore backup: {str(e)}"}), 400


# ---------- SocketIO event rooms ----------


@socketio.on("connect")
def handle_connect():
    uid = get_current_user_id()
    if uid:
        join_room(f"user-{uid}")


@socketio.on("join_board")
def handle_join_board(data):
    board_id = (data or {}).get("board_id")
    if board_id is not None:
        join_room(f"board-{board_id}")


@socketio.on("leave_board")
def handle_leave_board(data):
    board_id = (data or {}).get("board_id")
    if board_id is not None:
        leave_room(f"board-{board_id}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=True, allow_unsafe_werkzeug=True)
