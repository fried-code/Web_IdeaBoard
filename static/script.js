const board = document.getElementById('board');
const tabsEl = document.getElementById('tabs');
const addTabBtn = document.getElementById('add-tab');
const boardMenu = document.getElementById('board-menu');
const noteMenu = document.getElementById('note-menu');
const saveBtn = document.getElementById('save-btn');

let boards = [];
let currentBoardId = null;
let notes = [];
let activeNoteIdForMenu = null;
let lastRightClickPos = { x: 0, y: 0 };

// ---------- Boards ----------

async function loadBoards() {
  const res = await fetch('/api/boards');
  boards = await res.json();
  if (boards.length && currentBoardId === null) {
    currentBoardId = boards[0].id;
  }
  renderTabs();
}

function renderTabs() {
  tabsEl.querySelectorAll('.tab:not(.add-tab)').forEach((el) => el.remove());
  boards.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (b.id === currentBoardId ? ' active' : '');
    btn.textContent = b.name;
    btn.title = 'Double-click to rename';
    btn.addEventListener('click', () => switchBoard(b.id));
    btn.addEventListener('dblclick', () => renameBoard(b.id, b.name));
    tabsEl.insertBefore(btn, addTabBtn);
  });
}

async function switchBoard(boardId) {
  currentBoardId = boardId;
  renderTabs();
  await loadNotes();
}

async function renameBoard(boardId, oldName) {
  const name = prompt('Rename this page:', oldName);
  if (!name || !name.trim() || name.trim() === oldName) return;
  await fetch(`/api/boards/${boardId}/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() }),
  });
  await loadBoards();
}

addTabBtn.addEventListener('click', async () => {
  const name = prompt('Name for the new page:', `Page ${boards.length + 1}`);
  if (!name || !name.trim()) return;
  const res = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() }),
  });
  const newBoard = await res.json();
  await loadBoards();
  await switchBoard(newBoard.id);
});

saveBtn.addEventListener('click', () => {
  if (currentBoardId === null) return;
  window.location.href = `/api/boards/${currentBoardId}/export`;
});

// ---------- Notes ----------

async function loadNotes() {
  if (currentBoardId === null) return;
  const res = await fetch(`/api/boards/${currentBoardId}/notes`);
  notes = await res.json();
  renderBoard();
}

function renderBoard() {
  board.innerHTML = '';

  if (notes.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'No ideas yet — right-click anywhere to add one!';
    board.appendChild(hint);
    return;
  }

  notes
    .slice()
    .sort((a, b) => a.z_index - b.z_index)
    .forEach((note) => board.appendChild(createNoteEl(note)));
}

function createNoteEl(note) {
  const el = document.createElement('div');
  el.className = 'note';
  el.dataset.id = note.id;
  el.style.left = note.x + 'px';
  el.style.top = note.y + 'px';
  el.style.background = note.color;
  el.style.transform = `rotate(${note.rotation}deg)`;
  el.style.zIndex = note.z_index;

  const heading = document.createElement('div');
  heading.className = 'note-heading';
  heading.contentEditable = 'false';
  heading.textContent = note.heading || '';
  heading.style.fontFamily = note.font || 'Segoe UI';

  const text = document.createElement('div');
  text.className = 'note-text';
  text.contentEditable = 'false';
  text.textContent = note.text || '';
  text.style.fontFamily = note.font || 'Segoe UI';
  text.style.fontWeight = note.bold ? '700' : '400';

  heading.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEditing(heading, note, 'heading');
  });
  text.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEditing(text, note, 'text');
  });

  el.appendChild(heading);
  el.appendChild(text);

  makeDraggable(el, note);

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openNoteMenu(e, note, heading, text);
  });

  // If this note was created empty (fresh from right-click add), jump straight
  // into editing its heading first.
  if (note._justCreated) {
    delete note._justCreated;
    setTimeout(() => startEditing(heading, note, 'heading'), 0);
  }

  return el;
}

function startEditing(el, note, field) {
  el.contentEditable = 'true';
  el.classList.add('editing');
  el.focus();
  document.execCommand('selectAll', false, null);

  const previousValue = note[field] || '';

  const finish = async () => {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    const value = el.textContent.trim();
    el.removeEventListener('blur', finish);
    el.removeEventListener('keydown', onKeydown);

    note[field] = value;
    const otherField = field === 'heading' ? 'text' : 'heading';
    if (!value && !(note[otherField] || '').trim()) {
      await deleteNote(note.id);
      return;
    }
    await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  };

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el.blur();
    }
    if (e.key === 'Escape') {
      el.textContent = previousValue;
      el.blur();
    }
  }

  el.addEventListener('blur', finish);
  el.addEventListener('keydown', onKeydown);
}

function makeDraggable(el, note) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let moved = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return; // right click handled separately
    if (e.target.isContentEditable) return; // let editing clicks through
    dragging = true;
    moved = false;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    moved = true;
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
    if (!moved) return;
    const x = parseInt(el.style.left, 10);
    const y = parseInt(el.style.top, 10);
    note.x = x;
    note.y = y;
    await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  });
}

async function addNoteAt(x, y) {
  const res = await fetch(`/api/boards/${currentBoardId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heading: '', text: '', x: Math.round(x), y: Math.round(y) }),
  });
  const note = await res.json();
  note._justCreated = true;
  notes.push(note);
  renderBoard();
}

async function deleteNote(id) {
  await fetch(`/api/notes/${id}`, { method: 'DELETE' });
  notes = notes.filter((n) => n.id !== id);
  renderBoard();
}

// ---------- Context menus ----------

function positionMenu(menuEl, clientX, clientY) {
  menuEl.classList.remove('hidden');
  const menuRect = menuEl.getBoundingClientRect();
  let x = clientX;
  let y = clientY;
  if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 8;
  if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 8;
  menuEl.style.left = x + window.scrollX + 'px';
  menuEl.style.top = y + window.scrollY + 'px';
}

function closeMenus() {
  boardMenu.classList.add('hidden');
  noteMenu.classList.add('hidden');
}

board.addEventListener('contextmenu', (e) => {
  if (e.target !== board) return; // handled by note's own listener otherwise
  e.preventDefault();
  closeMenus();
  const boardRect = board.getBoundingClientRect();
  lastRightClickPos = {
    x: e.clientX - boardRect.left + board.scrollLeft,
    y: e.clientY - boardRect.top + board.scrollTop,
  };
  positionMenu(boardMenu, e.clientX, e.clientY);
});

boardMenu.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (action === 'add-note') {
    addNoteAt(lastRightClickPos.x, lastRightClickPos.y);
  }
  closeMenus();
});

function openNoteMenu(e, note, headingEl, textEl) {
  closeMenus();
  activeNoteIdForMenu = note.id;
  noteMenu._note = note;
  noteMenu._headingEl = headingEl;
  noteMenu._textEl = textEl;
  positionMenu(noteMenu, e.clientX, e.clientY);
}

noteMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const note = noteMenu._note;
  const headingEl = noteMenu._headingEl;
  const textEl = noteMenu._textEl;
  if (!note) return;

  if (action === 'edit-heading') {
    startEditing(headingEl, note, 'heading');
  } else if (action === 'edit-text') {
    startEditing(textEl, note, 'text');
  } else if (action === 'bold') {
    note.bold = note.bold ? 0 : 1;
    textEl.style.fontWeight = note.bold ? '700' : '400';
    await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bold: note.bold }),
    });
  } else if (action === 'font') {
    const font = btn.dataset.font;
    note.font = font;
    headingEl.style.fontFamily = font;
    textEl.style.fontFamily = font;
    await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font }),
    });
  } else if (action === 'front') {
    const res = await fetch(`/api/notes/${note.id}/front`, { method: 'PUT' });
    const data = await res.json();
    note.z_index = data.z_index;
    note.parentElement && (note.parentElement.style.zIndex = data.z_index);
    renderBoard();
  } else if (action === 'back') {
    const res = await fetch(`/api/notes/${note.id}/back`, { method: 'PUT' });
    const data = await res.json();
    note.z_index = data.z_index;
    renderBoard();
  } else if (action === 'delete') {
    await deleteNote(note.id);
  }

  closeMenus();
});

document.addEventListener('click', (e) => {
  if (!boardMenu.contains(e.target) && !noteMenu.contains(e.target)) {
    closeMenus();
  }
});
document.addEventListener('scroll', closeMenus, true);

// ---------- Init ----------

(async function init() {
  await loadBoards();
  await loadNotes();
})();
