const board = document.getElementById('board');
const form = document.getElementById('add-form');
const input = document.getElementById('note-text');

let notes = [];

async function loadNotes() {
  const res = await fetch('/api/notes');
  notes = await res.json();
  renderBoard();
}

function renderBoard() {
  board.innerHTML = '';

  if (notes.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No ideas yet — add your first one above!';
    board.appendChild(hint);
    return;
  }

  notes.forEach((note) => {
    board.appendChild(createNoteEl(note));
  });
}

function createNoteEl(note) {
  const el = document.createElement('div');
  el.className = 'note';
  el.dataset.id = note.id;
  el.style.left = note.x + 'px';
  el.style.top = note.y + 'px';
  el.style.background = note.color;
  el.style.transform = `rotate(${note.rotation}deg)`;

  const text = document.createElement('div');
  text.className = 'note-text';
  text.textContent = note.text;
  el.appendChild(text);

  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.textContent = '✕ remove';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNote(note.id, el);
  });
  el.appendChild(del);

  makeDraggable(el, note);

  return el;
}

function makeDraggable(el, note) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const boardRect = board.getBoundingClientRect();
    let newX = e.clientX - boardRect.left - offsetX + board.scrollLeft;
    let newY = e.clientY - boardRect.top - offsetY + board.scrollTop;
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);
    el.style.left = newX + 'px';
    el.style.top = newY + 'px';
  });

  el.addEventListener('pointerup', async (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    el.releasePointerCapture(e.pointerId);
    const x = parseInt(el.style.left, 10);
    const y = parseInt(el.style.top, 10);
    note.x = x;
    note.y = y;
    await fetch(`/api/notes/${note.id}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  });
}

async function addNote(text) {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (res.ok) {
    const note = await res.json();
    notes.push(note);
    renderBoard();
  }
}

async function deleteNote(id, el) {
  await fetch(`/api/notes/${id}`, { method: 'DELETE' });
  notes = notes.filter((n) => n.id !== id);
  el.remove();
  if (notes.length === 0) renderBoard();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addNote(text);
  input.value = '';
  input.focus();
});

loadNotes();
