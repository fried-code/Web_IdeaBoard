const board = document.getElementById('board');
const tabsEl = document.getElementById('tabs');
const addTabBtn = document.getElementById('add-tab');
const boardMenu = document.getElementById('board-menu');
const noteMenu = document.getElementById('note-menu');
const tabMenu = document.getElementById('tab-menu');
const saveBtn = document.getElementById('save-btn');
const imageInput = document.getElementById('image-input');

let boards = [];
let currentBoardId = null;
let notes = [];
let lastRightClickPos = { x: 0, y: 0 };
let pendingImageNote = null;

const FONT_OPTIONS = [
  ['Segoe UI', 'Segoe UI'],
  ["'Patrick Hand', cursive", 'Patrick Hand'],
  ["'Caveat', cursive", 'Caveat'],
  ["'Kalam', cursive", 'Kalam'],
  ['Georgia, serif', 'Georgia'],
  ["'Courier New', monospace", 'Courier New'],
];

// ---------- Boards (pages) ----------

async function loadBoards() {
  const res = await fetch('/api/boards');
  boards = await res.json();
  if (boards.length && (currentBoardId === null || !boards.some((b) => b.id === currentBoardId))) {
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
    btn.title = 'Right-click to rename or delete';
    btn.addEventListener('click', () => switchBoard(b.id));
    btn.addEventListener('dblclick', () => renameBoard(b.id, b.name));
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openTabMenu(e, b);
    });
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

async function deleteBoardPrompt(boardId, name) {
  if (boards.length <= 1) {
    alert("You can't delete your only page.");
    return;
  }
  if (!confirm(`Delete the page "${name}" and all its notes? This can't be undone.`)) return;
  const res = await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Could not delete this page.');
    return;
  }
  if (boardId === currentBoardId) currentBoardId = null;
  await loadBoards();
  await loadNotes();
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

function openTabMenu(e, boardObj) {
  closeMenus();
  tabMenu._board = boardObj;
  positionMenu(tabMenu, e.clientX, e.clientY);
}

tabMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const b = tabMenu._board;
  if (!b) return;
  if (btn.dataset.action === 'rename') {
    renameBoard(b.id, b.name);
  } else if (btn.dataset.action === 'delete') {
    deleteBoardPrompt(b.id, b.name);
  }
  closeMenus();
});

// ---------- Notes: load & render ----------

async function loadNotes() {
  if (currentBoardId === null) {
    notes = [];
    renderBoard();
    return;
  }
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

function isNoteEmpty(note) {
  if ((note.heading || '').trim()) return false;
  if (note.type === 'note') return !((note.text || '').trim());
  if (note.type === 'image') return !note.image;
  if (note.type === 'bullets') return note.items.every((i) => !String(i).trim());
  if (note.type === 'todo') return note.items.every((i) => !(i.text || '').trim());
  return true;
}

async function saveNote(note, fields) {
  Object.assign(note, fields);
  await fetch(`/api/notes/${note.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

async function deleteNote(id) {
  await fetch(`/api/notes/${id}`, { method: 'DELETE' });
  notes = notes.filter((n) => n.id !== id);
  renderBoard();
}

// ---------- Building a note element ----------

function createNoteEl(note) {
  const el = document.createElement('div');
  el.className = 'note';
  el.dataset.id = note.id;
  el.style.left = note.x + 'px';
  el.style.top = note.y + 'px';
  el.style.width = (note.width || 190) + 'px';
  el.style.height = (note.height || 170) + 'px';
  el.style.background = note.color;
  el.style.transform = `rotate(${note.rotation}deg)`;
  el.style.zIndex = note.z_index;

  const heading = document.createElement('div');
  heading.className = 'note-heading';
  heading.contentEditable = 'false';
  heading.textContent = note.heading || '';
  heading.style.fontFamily = note.font || 'Segoe UI';

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'note-body';

  let bodyRefs = {};
  if (note.type === 'bullets') {
    bodyRefs = buildListBody(note, bodyWrap, 'bullets');
  } else if (note.type === 'todo') {
    bodyRefs = buildListBody(note, bodyWrap, 'todo');
  } else if (note.type === 'image') {
    bodyRefs = buildImageBody(note, bodyWrap);
  } else {
    bodyRefs = buildTextBody(note, bodyWrap, heading);
  }

  heading.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEditingField(heading, note, 'heading', {
      onEnterNext: note.type === 'note' ? bodyRefs.textEl : null,
    });
  });

  el.appendChild(heading);
  el.appendChild(bodyWrap);

  makeDraggable(el, note);
  attachResizeObserver(el, note);

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openNoteMenu(e, note, heading, bodyRefs);
  });

  if (note._justCreated) {
    delete note._justCreated;
    setTimeout(() => startEditingField(heading, note, 'heading', { onEnterNext: bodyRefs.textEl || null }), 0);
  }

  return el;
}

function buildTextBody(note, bodyWrap, headingEl) {
  const text = document.createElement('div');
  text.className = 'note-text';
  text.contentEditable = 'false';
  text.textContent = note.text || '';
  text.style.fontFamily = note.font || 'Segoe UI';
  text.style.fontWeight = note.bold ? '700' : '400';

  text.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEditingField(text, note, 'text', {});
  });

  bodyWrap.appendChild(text);
  return { textEl: text };
}

function buildImageBody(note, bodyWrap) {
  const container = document.createElement('div');
  container.className = 'note-image-body';
  renderImageContent(note, container);
  bodyWrap.appendChild(container);
  return { imageContainer: container };
}

function renderImageContent(note, container) {
  container.innerHTML = '';
  if (note.image) {
    const img = document.createElement('img');
    img.src = note.image;
    img.alt = note.heading || 'idea image';
    container.appendChild(img);
    container.style.cursor = 'default';
    container.onclick = null;
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'note-image-placeholder';
    placeholder.textContent = '🖼️ Click to add an image';
    placeholder.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerImageUpload(note, container);
    });
    container.appendChild(placeholder);
  }
}

function triggerImageUpload(note, container) {
  pendingImageNote = { note, container };
  imageInput.click();
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files && imageInput.files[0];
  imageInput.value = '';
  if (!file || !pendingImageNote) return;
  const { note, container } = pendingImageNote;
  pendingImageNote = null;

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    await saveNote(note, { image: dataUrl });
    renderImageContent(note, container);
  };
  reader.readAsDataURL(file);
});

// ---------- Bullet / to-do list bodies ----------

function buildListBody(note, bodyWrap, type) {
  const list = document.createElement('div');
  list.className = type === 'todo' ? 'todo-list' : 'bullet-list';
  bodyWrap.appendChild(list);
  rebuildListRows(list, note, type);
  return { listEl: list };
}

function rebuildListRows(listEl, note, type, focusIndex) {
  listEl.innerHTML = '';
  if (!note.items || note.items.length === 0) {
    note.items = type === 'todo' ? [{ text: '', done: false }] : [''];
  }

  note.items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = type === 'todo' ? 'todo-row' : 'bullet-row';

    let checkbox = null;
    if (type === 'todo') {
      checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !!item.done;
      if (item.done) row.classList.add('done');
      checkbox.addEventListener('change', async () => {
        note.items[index].done = checkbox.checked;
        row.classList.toggle('done', checkbox.checked);
        await saveNote(note, { items: note.items });
      });
      row.appendChild(checkbox);
    } else {
      const dot = document.createElement('span');
      dot.className = 'bullet-dot';
      dot.textContent = '•';
      row.appendChild(dot);
    }

    const span = document.createElement('span');
    span.className = type === 'todo' ? 'todo-text' : 'bullet-text';
    span.contentEditable = 'true';
    span.textContent = type === 'todo' ? item.text || '' : item || '';
    span.style.fontFamily = note.font || 'Segoe UI';
    span.style.fontWeight = note.bold ? '700' : '400';

    let suppressBlur = false;

    span.addEventListener('blur', async () => {
      if (suppressBlur) {
        suppressBlur = false;
        return;
      }
      const value = span.textContent.trim();
      if (type === 'todo') {
        note.items[index] = { text: value, done: !!item.done };
      } else {
        note.items[index] = value;
      }
      if (isNoteEmpty(note)) {
        await deleteNote(note.id);
        return;
      }
      await saveNote(note, { items: note.items });
    });

    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        suppressBlur = true;
        const value = span.textContent.trim();
        if (type === 'todo') {
          note.items[index] = { text: value, done: !!item.done };
          note.items.splice(index + 1, 0, { text: '', done: false });
        } else {
          note.items[index] = value;
          note.items.splice(index + 1, 0, '');
        }
        saveNote(note, { items: note.items });
        rebuildListRows(listEl, note, type, index + 1);
      } else if (e.key === 'Backspace' && span.textContent === '' && note.items.length > 1) {
        e.preventDefault();
        suppressBlur = true;
        note.items.splice(index, 1);
        saveNote(note, { items: note.items });
        rebuildListRows(listEl, note, type, Math.max(0, index - 1));
      }
    });

    row.appendChild(span);
    listEl.appendChild(row);

    if (index === focusIndex) {
      setTimeout(() => {
        span.focus();
      }, 0);
    }
  });
}

function addListItem(note, listEl, type) {
  if (type === 'todo') {
    note.items.push({ text: '', done: false });
  } else {
    note.items.push('');
  }
  saveNote(note, { items: note.items });
  rebuildListRows(listEl, note, type, note.items.length - 1);
}

// ---------- Generic single-field editing (heading, sticky-note text) ----------

function startEditingField(el, note, field, { onEnterNext } = {}) {
  el.contentEditable = 'true';
  el.classList.add('editing');
  el.focus();
  document.execCommand('selectAll', false, null);
  const previousValue = note[field] || '';

  async function commit(checkEmpty) {
    const value = el.textContent.trim();
    note[field] = value;
    if (checkEmpty && isNoteEmpty(note)) {
      await deleteNote(note.id);
      return;
    }
    await saveNote(note, { [field]: value });
  }

  async function onBlur() {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.removeEventListener('blur', onBlur);
    el.removeEventListener('keydown', onKeydown);
    await commit(true);
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onEnterNext) {
        // Moving to a sibling field within the same note: save what's here,
        // but don't run the empty-note deletion check mid-navigation.
        el.removeEventListener('blur', onBlur);
        el.removeEventListener('keydown', onKeydown);
        el.contentEditable = 'false';
        el.classList.remove('editing');
        commit(false);
        startEditingField(onEnterNext, note, 'text', {});
      } else {
        el.blur();
      }
    }
    if (e.key === 'Escape') {
      el.textContent = previousValue;
      el.blur();
    }
  }

  el.addEventListener('blur', onBlur);
  el.addEventListener('keydown', onKeydown);
}

// ---------- Dragging ----------

function makeDraggable(el, note) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let moved = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    if (e.target.isContentEditable) return;
    if (e.target.tagName === 'INPUT') return;
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
    await saveNote(note, { x, y });
  });
}

// ---------- Resizing (persist width/height) ----------

function attachResizeObserver(el, note) {
  let debounceTimer = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w !== note.width || h !== note.height) {
        saveNote(note, { width: w, height: h });
      }
    }, 400);
  });
  ro.observe(el);
}

// ---------- Adding new notes ----------

async function addNoteAt(x, y, type) {
  const res = await fetch(`/api/boards/${currentBoardId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, heading: '', x: Math.round(x), y: Math.round(y) }),
  });
  const note = await res.json();
  note._justCreated = true;
  notes.push(note);
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
  tabMenu.classList.add('hidden');
}

board.addEventListener('contextmenu', (e) => {
  if (e.target !== board) return;
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
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.action === 'add') {
    addNoteAt(lastRightClickPos.x, lastRightClickPos.y, btn.dataset.type);
  }
  closeMenus();
});

function openNoteMenu(e, note, headingEl, bodyRefs) {
  closeMenus();

  const items = [];
  items.push({ action: 'edit-heading', label: '✏️ Edit heading' });

  if (note.type === 'note') {
    items.push({ action: 'edit-text', label: '✏️ Edit content' });
  } else if (note.type === 'bullets' || note.type === 'todo') {
    items.push({ action: 'add-item', label: '➕ Add item' });
  } else if (note.type === 'image') {
    items.push({ action: 'change-image', label: '🖼️ Change image' });
  }

  items.push({ action: 'bold', label: '𝐁 Toggle bold' });
  items.push({ action: 'section', label: 'Font' });
  FONT_OPTIONS.forEach(([font, label]) => {
    items.push({ action: 'font', label, font });
  });
  items.push({ action: 'divider' });
  items.push({ action: 'front', label: '⬆️ Bring to front' });
  items.push({ action: 'back', label: '⬇️ Send to back' });
  items.push({ action: 'divider' });
  items.push({ action: 'delete', label: '🗑️ Delete', danger: true });

  noteMenu.innerHTML = '';
  items.forEach((item) => {
    if (item.action === 'divider') {
      const div = document.createElement('div');
      div.className = 'menu-divider';
      noteMenu.appendChild(div);
      return;
    }
    if (item.action === 'section') {
      const div = document.createElement('div');
      div.className = 'menu-section-label';
      div.textContent = item.label;
      noteMenu.appendChild(div);
      return;
    }
    const btn = document.createElement('button');
    btn.dataset.action = item.action;
    if (item.font) btn.dataset.font = item.font;
    if (item.danger) btn.classList.add('danger');
    btn.textContent = item.label;
    noteMenu.appendChild(btn);
  });

  noteMenu._note = note;
  noteMenu._headingEl = headingEl;
  noteMenu._bodyRefs = bodyRefs;
  positionMenu(noteMenu, e.clientX, e.clientY);
}

noteMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const note = noteMenu._note;
  const headingEl = noteMenu._headingEl;
  const bodyRefs = noteMenu._bodyRefs || {};
  if (!note) return;

  if (action === 'edit-heading') {
    startEditingField(headingEl, note, 'heading', {});
  } else if (action === 'edit-text') {
    if (bodyRefs.textEl) startEditingField(bodyRefs.textEl, note, 'text', {});
  } else if (action === 'add-item') {
    const type = note.type;
    if (bodyRefs.listEl) addListItem(note, bodyRefs.listEl, type);
  } else if (action === 'change-image') {
    if (bodyRefs.imageContainer) triggerImageUpload(note, bodyRefs.imageContainer);
  } else if (action === 'bold') {
    note.bold = note.bold ? 0 : 1;
    await saveNote(note, { bold: note.bold });
    renderBoard();
  } else if (action === 'font') {
    const font = btn.dataset.font;
    await saveNote(note, { font });
    renderBoard();
  } else if (action === 'front') {
    const res = await fetch(`/api/notes/${note.id}/front`, { method: 'PUT' });
    const data = await res.json();
    note.z_index = data.z_index;
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
  if (!boardMenu.contains(e.target) && !noteMenu.contains(e.target) && !tabMenu.contains(e.target)) {
    closeMenus();
  }
});
document.addEventListener('scroll', closeMenus, true);

// ---------- Init ----------

(async function init() {
  await loadBoards();
  await loadNotes();
})();
