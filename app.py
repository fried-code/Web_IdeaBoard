import os
import random
import sqlite3

from flask import Flask, jsonify, render_template, request

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
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            color TEXT NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            rotation INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/notes", methods=["GET"])
def list_notes():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, text, color, x, y, rotation FROM notes ORDER BY id"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/notes", methods=["POST"])
def create_note():
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400

    color = data.get("color") or random.choice(COLORS)
    x = data.get("x", random.randint(20, 640))
    y = data.get("y", random.randint(20, 360))
    rotation = data.get("rotation", random.randint(-6, 6))

    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO notes (text, color, x, y, rotation) VALUES (?, ?, ?, ?, ?)",
        (text, color, x, y, rotation),
    )
    conn.commit()
    note_id = cur.lastrowid
    conn.close()

    return jsonify(
        {"id": note_id, "text": text, "color": color, "x": x, "y": y, "rotation": rotation}
    ), 201


@app.route("/api/notes/<int:note_id>/position", methods=["PUT"])
def update_position(note_id):
    data = request.get_json(force=True) or {}
    x = data.get("x")
    y = data.get("y")
    if x is None or y is None:
        return jsonify({"error": "x and y are required"}), 400

    conn = get_conn()
    conn.execute("UPDATE notes SET x = ?, y = ? WHERE id = ?", (x, y, note_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


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
