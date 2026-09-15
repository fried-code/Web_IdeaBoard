import os
import random
import sqlite3

from flask import Flask, Response, jsonify, render_template, request

DB_PATH = os.environ.get("DB_PATH", "board.db")

COLORS = [
    "#fff59d",  # yellow
    "#ffab91",  # orange
    "#a5d6a7",  # green
    "#90caf9",  # blue
    "#f48fb1",  # pink
    "#ce93d8",  # purple
    "#fff9c4",  # pale yellow
]

app = Flask(__name__)


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    row = conn.execute("SELECT COUNT(*) AS c FROM boards").fetchone()
    if row["c"] == 0:
        conn.execute(
            "INSERT INTO boards (name, sort_order) VALUES (?, ?)", ("My Ideas", 0)
        )
    conn.commit()
    default_board_id = conn.execute(
        "SELECT id FROM boards ORDER BY sort_order, id LIMIT 1"
    ).fetchone()["id"]

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL DEFAULT {default_board_id},
            heading TEXT NOT NULL DEFAULT '',
            text TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            rotation INTEGER NOT NULL,
            z_index INTEGER NOT NULL DEFAULT 1,
            font TEXT NOT NULL DEFAULT 'Segoe UI',
            bold INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES boards (id)
        )
        """.format(default_board_id=default_board_id)
    )

    # Migrate a pre-existing notes table (from an earlier version of this app)
    # that predates boards / layering / fonts, without losing existing notes.
    existing_cols = {r["name"] for r in conn.execute("PRAGMA table_info(notes)").fetchall()}
    migrations = []
    if "board_id" not in existing_cols:
        migrations.append(
            f"ALTER TABLE notes ADD COLUMN board_id INTEGER NOT NULL DEFAULT {default_board_id}"
        )
    if "z_index" not in existing_cols:
        migrations.append("ALTER TABLE notes ADD COLUMN z_index INTEGER NOT NULL DEFAULT 1")
    if "font" not in existing_cols:
        migrations.append("ALTER TABLE notes ADD COLUMN font TEXT NOT NULL DEFAULT 'Segoe UI'")
    if "bold" not in existing_cols:
        migrations.append("ALTER TABLE notes ADD COLUMN bold INTEGER NOT NULL DEFAULT 0")
    if "heading" not in existing_cols:
        migrations.append("ALTER TABLE notes ADD COLUMN heading TEXT NOT NULL DEFAULT ''")
    for m in migrations:
        conn.execute(m)

    conn.commit()
    conn.close()


init_db()


@app.route("/")
def index():
    return render_template("index.html")


# ---------- Boards (pages) ----------


@app.route("/api/boards", methods=["GET"])
def list_boards():
    conn = get_conn()
    rows = conn.execute("SELECT id, name FROM boards ORDER BY sort_order, id").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/boards", methods=["POST"])
def create_board():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    conn = get_conn()
    max_order = conn.execute(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM boards"
    ).fetchone()["m"]
    cur = conn.execute(
        "INSERT INTO boards (name, sort_order) VALUES (?, ?)", (name, max_order + 1)
    )
    conn.commit()
    board_id = cur.lastrowid
    conn.close()
    return jsonify({"id": board_id, "name": name}), 201


@app.route("/api/boards/<int:board_id>", methods=["DELETE"])
def delete_board(board_id):
    conn = get_conn()
    conn.execute("DELETE FROM notes WHERE board_id = ?", (board_id,))
    conn.execute("DELETE FROM boards WHERE id = ?", (board_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/boards/<int:board_id>/rename", methods=["PUT"])
def rename_board(board_id):
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    conn = get_conn()
    conn.execute("UPDATE boards SET name = ? WHERE id = ?", (name, board_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/boards/<int:board_id>/export", methods=["GET"])
def export_board(board_id):
    conn = get_conn()
    board = conn.execute("SELECT id, name FROM boards WHERE id = ?", (board_id,)).fetchone()
    if not board:
        conn.close()
        return jsonify({"error": "board not found"}), 404

    rows = conn.execute(
        "SELECT heading, text FROM notes WHERE board_id = ? ORDER BY z_index, id",
        (board_id,),
    ).fetchall()
    conn.close()

    lines = [board["name"], "=" * len(board["name"]), ""]
    if not rows:
        lines.append("(no ideas on this page yet)")
    for i, row in enumerate(rows, start=1):
        heading = (row["heading"] or "").strip() or f"Idea {i}"
        lines.append(f"{i}. {heading}")
        body = (row["text"] or "").strip()
        if body:
            indented = "\n".join("   " + line for line in body.splitlines())
            lines.append(indented)
        lines.append("")

    content = "\n".join(lines).rstrip() + "\n"
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in board["name"]).strip()
    filename = f"{safe_name or 'board'}_ideas.txt"

    return Response(
        content,
        mimetype="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- Notes ----------


@app.route("/api/boards/<int:board_id>/notes", methods=["GET"])
def list_notes(board_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, board_id, heading, text, color, x, y, rotation, z_index, font, bold "
        "FROM notes WHERE board_id = ? ORDER BY z_index, id",
        (board_id,),
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/boards/<int:board_id>/notes", methods=["POST"])
def create_note(board_id):
    data = request.get_json(force=True) or {}
    heading = data.get("heading", "")
    text = data.get("text", "")
    color = data.get("color") or random.choice(COLORS)
    x = data.get("x", random.randint(20, 640))
    y = data.get("y", random.randint(20, 360))
    rotation = data.get("rotation", random.randint(-6, 6))

    conn = get_conn()
    max_z = conn.execute(
        "SELECT COALESCE(MAX(z_index), 0) AS m FROM notes WHERE board_id = ?", (board_id,)
    ).fetchone()["m"]
    cur = conn.execute(
        "INSERT INTO notes (board_id, heading, text, color, x, y, rotation, z_index) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (board_id, heading, text, color, x, y, rotation, max_z + 1),
    )
    conn.commit()
    note_id = cur.lastrowid
    conn.close()

    return jsonify(
        {
            "id": note_id,
            "board_id": board_id,
            "heading": heading,
            "text": text,
            "color": color,
            "x": x,
            "y": y,
            "rotation": rotation,
            "z_index": max_z + 1,
            "font": "Segoe UI",
            "bold": 0,
        }
    ), 201


@app.route("/api/notes/<int:note_id>", methods=["PUT"])
def update_note(note_id):
    """Partial update: any subset of heading/text/x/y/rotation/z_index/font/bold/color."""
    data = request.get_json(force=True) or {}
    fields = []
    values = []
    for key in ("heading", "text", "x", "y", "rotation", "z_index", "font", "bold", "color"):
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if not fields:
        return jsonify({"error": "no fields to update"}), 400

    values.append(note_id)
    conn = get_conn()
    conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/notes/<int:note_id>/front", methods=["PUT"])
def bring_to_front(note_id):
    conn = get_conn()
    note = conn.execute("SELECT board_id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        conn.close()
        return jsonify({"error": "not found"}), 404
    max_z = conn.execute(
        "SELECT COALESCE(MAX(z_index), 0) AS m FROM notes WHERE board_id = ?",
        (note["board_id"],),
    ).fetchone()["m"]
    new_z = max_z + 1
    conn.execute("UPDATE notes SET z_index = ? WHERE id = ?", (new_z, note_id))
    conn.commit()
    conn.close()
    return jsonify({"z_index": new_z})


@app.route("/api/notes/<int:note_id>/back", methods=["PUT"])
def send_to_back(note_id):
    conn = get_conn()
    note = conn.execute("SELECT board_id FROM notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        conn.close()
        return jsonify({"error": "not found"}), 404
    min_z = conn.execute(
        "SELECT COALESCE(MIN(z_index), 0) AS m FROM notes WHERE board_id = ?",
        (note["board_id"],),
    ).fetchone()["m"]
    new_z = min_z - 1
    conn.execute("UPDATE notes SET z_index = ? WHERE id = ?", (new_z, note_id))
    conn.commit()
    conn.close()
    return jsonify({"z_index": new_z})


@app.route("/api/notes/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    conn = get_conn()
    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
