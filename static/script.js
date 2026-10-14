// ============================================================
// NEO-BRUTALIST IDEABOARD CLIENT SCRIPT
// Features: Neon DB, User Auth, Trello-like Lists & Ghost Previews
// ============================================================

const boardViewport = document.getElementById('board-viewport');
const board = document.getElementById('board');
const tabsEl = document.getElementById('tabs');
const addTabBtn = document.getElementById('add-tab');
const addListBtn = document.getElementById('add-list-btn');
const saveBtn = document.getElementById('save-btn');
const backupBtn = document.getElementById('backup-btn');
const restoreBtn = document.getElementById('restore-btn');
const restoreInput = document.getElementById('restore-input');
const imageInput = document.getElementById('image-input');
const viewToggleBtn = document.getElementById('view-toggle-btn');
const moreActionsBtn = document.getElementById('more-actions-btn');
const dataDropdown = document.getElementById('data-dropdown');

// Auth elements
const openAuthBtn = document.getElementById('open-auth-btn');
const authModal = document.getElementById('auth-modal');
const authModalClose = document.getElementById('auth-modal-close');
const userBadge = document.getElementById('user-badge');
const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');

// Note options modal
const noteModal = document.getElementById('note-modal');
const noteModalClose = document.getElementById('note-modal-close');
const optToggleBold = document.getElementById('opt-toggle-bold');
const optBringFront = document.getElementById('opt-bring-front');
const optSendBack = document.getElementById('opt-send-back');
const optDeleteNote = document.getElementById('opt-delete-note');
const noteColorPicker = document.getElementById('note-color-picker');
const noteFontPicker = document.getElementById('note-font-picker');

// Ghost List Preview Element
const ghostListPreview = document.getElementById('ghost-list-preview');
const ghostSlotBase = document.getElementById('ghost-slot-base');
const ghostSlotDropped = document.getElementById('ghost-slot-dropped');

// FAB elements
const fabMainBtn = document.getElementById('fab-main-btn');
const fabMenu = document.getElementById('fab-menu');

// Mobile drawer elements
const mobileDrawerBtn = document.getElementById('mobile-drawer-btn');
const mobileDrawer = document.getElementById('mobile-drawer');
const closeDrawerBtn = document.getElementById('close-drawer-btn');
const drawerUserInfo = document.getElementById('drawer-user-info');
const drawerViewToggle = document.getElementById('drawer-view-toggle');
const drawerAddList = document.getElementById('drawer-add-list');
const drawerAddBoard = document.getElementById('drawer-add-board');
const drawerExport = document.getElementById('drawer-export');
const drawerBackup = document.getElementById('drawer-backup');
const drawerRestore = document.getElementById('drawer-restore');
const drawerAuthBtn = document.getElementById('drawer-auth-btn');

// Board context menu
const boardMenu = document.getElementById('board-menu');

// App State
let currentUser = null;
let boards = [];
let currentBoardId = null;
let lists = [];
let notes = [];
let activeNoteForOptions = null;
let pendingImageNote = null;
let lastClickPos = { x: 80, y: 80 };
let isGridView = false;

// Dragging & Overlap State
let activeHoverNote = null;
let activeHoverList = null;
let activeInsertIndex = 0;

const socket = io();

function apiHeaders(extra = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extra);
  if (socket.id) headers['X-Client-Id'] = socket.id;
  return headers;
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// ============================================================
// AUTHENTICATION FLOW
// ============================================================

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;
    updateAuthUI();
    if (currentUser) {
      await loadBoards();
    } else {
      renderLoggedOutState();
    }
  } catch (err) {
    console.error('Error checking auth:', err);
    renderLoggedOutState();
  }
}

function updateAuthUI() {
  if (currentUser) {
    openAuthBtn.classList.add('hidden');
    userBadge.classList.remove('hidden');
    userNameEl.textContent = `@${currentUser.username}`;
    drawerUserInfo.innerHTML = `
      <div class="user-badge" style="width:100%; justify-content:center;">
        <span>👾 Logged in as <strong>@${currentUser.username}</strong></span>
      </div>
    `;
    drawerAuthBtn.textContent = '🚪 Sign Out';
    drawerAuthBtn.onclick = handleLogout;
  } else {
    openAuthBtn.classList.remove('hidden');
    userBadge.classList.add('hidden');
    drawerUserInfo.innerHTML = `
      <div style="font-weight:700; font-size:0.85rem; text-align:center; padding:6px; background:#FAF7EE; border:2px dashed #121212;">
        ⚡ Not signed in. Sign in to sync your boards, lists & images to Neon DB.
      </div>
    `;
    drawerAuthBtn.textContent = '🔑 Sign In / Sign Up';
    drawerAuthBtn.onclick = () => {
      closeMobileDrawer();
      openAuthModal();
    };
  }
}

function renderLoggedOutState() {
  tabsEl.querySelectorAll('.tab-btn:not(.add-tab-btn)').forEach((el) => el.remove());
  board.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚡</div>
      <h2 class="empty-state-title">WELCOME TO IDEA//BOARD</h2>
      <p class="empty-state-desc">
        A high-voltage Neo-Brutalist idea workspace with Trello-like lists powered by <strong>Neon Serverless PostgreSQL</strong>.
        Sign in or create an account to start organizing your boards in the cloud!
      </p>
      <button id="cta-auth-btn" class="neo-btn submit-auth-btn" style="width:auto; padding:12px 24px;">
        🔑 SIGN IN OR CREATE ACCOUNT ➔
      </button>
    </div>
  `;
  document.getElementById('cta-auth-btn')?.addEventListener('click', openAuthModal);
}

function openAuthModal() {
  authError.classList.add('hidden');
  authError.textContent = '';
  authModal.classList.remove('hidden');
}

function closeAuthModal() {
  authModal.classList.add('hidden');
}

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabSignup.classList.remove('active');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  authError.classList.add('hidden');
});

tabSignup.addEventListener('click', () => {
  tabSignup.classList.add('active');
  tabLogin.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  authError.classList.add('hidden');
});

openAuthBtn.addEventListener('click', openAuthModal);
authModalClose.addEventListener('click', closeAuthModal);

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const identifier = document.getElementById('login-identifier').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      authError.textContent = `⚠️ ${data.error || 'Login failed.'}`;
      authError.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    closeAuthModal();
    updateAuthUI();
    showToast(`Welcome back, @${currentUser.username}!`);
    await loadBoards();
  } catch (err) {
    authError.textContent = '⚠️ Network error during login.';
    authError.classList.remove('hidden');
  }
});

// Signup Form Submit
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      authError.textContent = `⚠️ ${data.error || 'Registration failed.'}`;
      authError.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    closeAuthModal();
    updateAuthUI();
    showToast(`Account created! Welcome, @${currentUser.username}!`);
    await loadBoards();
  } catch (err) {
    authError.textContent = '⚠️ Network error during signup.';
    authError.classList.remove('hidden');
  }
});

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  currentBoardId = null;
  boards = [];
  lists = [];
  notes = [];
  updateAuthUI();
  renderLoggedOutState();
  showToast('Logged out successfully.');
}

logoutBtn.addEventListener('click', handleLogout);

// ============================================================
// BOARDS (PAGES) MANAGEMENT
// ============================================================

async function loadBoards() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/boards');
    if (res.status === 401) {
      currentUser = null;
      updateAuthUI();
      renderLoggedOutState();
      return;
    }
    boards = await res.json();
    if (boards.length && (currentBoardId === null || !boards.some((b) => b.id === currentBoardId))) {
      currentBoardId = boards[0].id;
    }
    renderTabs();
    if (currentBoardId !== null) {
      socket.emit('join_board', { board_id: currentBoardId });
      await loadBoardData();
    }
  } catch (err) {
    console.error('Error loading boards:', err);
  }
}

function renderTabs() {
  tabsEl.querySelectorAll('.tab-btn:not(.add-tab-btn)').forEach((el) => el.remove());
  boards.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (b.id === currentBoardId ? ' active' : '');
    btn.textContent = b.name;
    btn.title = 'Click to switch. Double-click or right-click to rename/delete';

    btn.addEventListener('click', () => switchBoard(b.id));
    btn.addEventListener('dblclick', () => renameBoard(b.id, b.name));
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      promptBoardOptions(b);
    });

    tabsEl.insertBefore(btn, addTabBtn);
  });
}

async function switchBoard(boardId) {
  if (currentBoardId !== null) socket.emit('leave_board', { board_id: currentBoardId });
  currentBoardId = boardId;
  socket.emit('join_board', { board_id: boardId });
  renderTabs();
  await loadBoardData();
}

async function promptBoardOptions(boardObj) {
  const action = prompt(`Board: "${boardObj.name}"\nType "rename" to change title, or "delete" to remove:`, 'rename');
  if (action === 'rename') {
    renameBoard(boardObj.id, boardObj.name);
  } else if (action === 'delete') {
    deleteBoardPrompt(boardObj.id, boardObj.name);
  }
}

async function renameBoard(boardId, oldName) {
  const name = prompt('Rename this board page:', oldName);
  if (!name || !name.trim() || name.trim() === oldName) return;
  await fetch(`/api/boards/${boardId}/rename`, {
    method: 'PUT',
    headers: apiHeaders(),
    body: JSON.stringify({ name: name.trim() }),
  });
  await loadBoards();
  showToast('Page renamed.');
}

async function deleteBoardPrompt(boardId, name) {
  if (boards.length <= 1) {
    alert("You cannot delete your only page.");
    return;
  }
  if (!confirm(`Delete board "${name}" and all its notes? This cannot be undone.`)) return;
  const res = await fetch(`/api/boards/${boardId}`, { method: 'DELETE', headers: apiHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Could not delete this board.');
    return;
  }
  if (boardId === currentBoardId) currentBoardId = null;
  await loadBoards();
  showToast('Board deleted.');
}

addTabBtn.addEventListener('click', async () => {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  const name = prompt('Name for new board page:', `Page ${boards.length + 1}`);
  if (!name || !name.trim()) return;
  const res = await fetch('/api/boards', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ name: name.trim() }),
  });
  const newBoard = await res.json();
  await loadBoards();
  await switchBoard(newBoard.id);
  showToast('New board created!');
});

// Export board as text
saveBtn.addEventListener('click', () => {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  if (currentBoardId === null) return;
  window.location.href = `/api/boards/${currentBoardId}/export`;
});

// Data Dropdown
moreActionsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dataDropdown.classList.toggle('hidden');
});
document.addEventListener('click', () => dataDropdown.classList.add('hidden'));

// Backup & Restore
backupBtn.addEventListener('click', () => {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  window.location.href = '/api/export-all';
});

restoreBtn.addEventListener('click', () => {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  restoreInput.click();
});

restoreInput.addEventListener('change', async () => {
  const file = restoreInput.files && restoreInput.files[0];
  restoreInput.value = '';
  if (!file) return;

  if (!confirm(`This will REPLACE current boards with "${file.name}". Continue?`)) return;

  try {
    const parsed = JSON.parse(await file.text());
    const res = await fetch('/api/import-all', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(parsed),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Restore failed.');
      return;
    }
    showToast('Backup restored successfully!');
    currentBoardId = null;
    await loadBoards();
  } catch (err) {
    alert('Invalid backup file.');
  }
});

// ============================================================
// DATA LOADING (LISTS & NOTES)
// ============================================================

async function loadBoardData() {
  if (currentBoardId === null || !currentUser) {
    lists = [];
    notes = [];
    renderBoard();
    return;
  }
  try {
    const [listsRes, notesRes] = await Promise.all([
      fetch(`/api/boards/${currentBoardId}/lists`),
      fetch(`/api/boards/${currentBoardId}/notes`),
    ]);
    lists = await listsRes.json();
    notes = await notesRes.json();
    renderBoard();
  } catch (err) {
    console.error('Error loading board data:', err);
  }
}

// ============================================================
// RENDERING BOARD, LISTS & NOTES
// ============================================================

function renderBoard() {
  board.innerHTML = '';
  if (!currentUser) {
    renderLoggedOutState();
    return;
  }

  if (notes.length === 0 && lists.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-state';
    hint.innerHTML = `
      <div class="empty-state-icon">💡</div>
      <h3 class="empty-state-title">THIS BOARD IS EMPTY</h3>
      <p class="empty-state-desc">
        Tap the big <strong>+ button</strong> in the corner or right-click to drop ideas!<br>
        <strong>Tip:</strong> Drag two cards on top of each other to automatically create a Trello-style List!
      </p>
    `;
    board.appendChild(hint);
    return;
  }

  // 1. Render all lists
  lists.forEach((listObj) => {
    const listEl = createListEl(listObj);
    board.appendChild(listEl);
  });

  // 2. Render freeform notes (notes with no list_id)
  const freeNotes = notes.filter((n) => !n.list_id);
  freeNotes
    .slice()
    .sort((a, b) => a.z_index - b.z_index)
    .forEach((note) => {
      const el = createNoteEl(note);
      board.appendChild(el);
      autoGrow(el);
    });
}

function autoGrow(noteEl) {
  if (!noteEl || isGridView) return;
  const needed = noteEl.scrollHeight;
  if (needed > noteEl.clientHeight) {
    noteEl.style.height = needed + 'px';
  }
}

function attachAutoGrowOnInput(fieldEl) {
  fieldEl.addEventListener('input', () => {
    autoGrow(fieldEl.closest('.note'));
  });
}

async function saveNote(note, fields) {
  Object.assign(note, fields);
  await fetch(`/api/notes/${note.id}`, {
    method: 'PUT',
    headers: apiHeaders(),
    body: JSON.stringify(fields),
  });
}

async function deleteNote(id) {
  await fetch(`/api/notes/${id}`, { method: 'DELETE', headers: apiHeaders() });
  notes = notes.filter((n) => n.id !== id);
  renderBoard();
  showToast('Note deleted.');
}

// ============================================================
// TRELLO-LIKE LIST COLUMNS CREATION & RENDERING
// ============================================================

async function addNewList(customTitle, x, y) {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  if (currentBoardId === null) return;

  const title = customTitle || prompt('Title for new list column:', 'To Do');
  if (!title || !title.trim()) return;

  const posX = x !== undefined ? x : boardViewport.scrollLeft + Math.min(window.innerWidth * 0.25, 140);
  const posY = y !== undefined ? y : boardViewport.scrollTop + Math.min(window.innerHeight * 0.2, 100);

  const res = await fetch(`/api/boards/${currentBoardId}/lists`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      title: title.trim(),
      x: Math.round(posX),
      y: Math.round(posY),
    }),
  });
  const newList = await res.json();
  lists.push(newList);
  renderBoard();
  showToast(`Created list "${newList.title}"!`);
}

addListBtn.addEventListener('click', () => addNewList());
drawerAddList.addEventListener('click', () => {
  closeMobileDrawer();
  addNewList();
});

function createListEl(listObj) {
  const listEl = document.createElement('div');
  listEl.className = 'list-column';
  listEl.dataset.listId = listObj.id;
  listEl.style.left = listObj.x + 'px';
  listEl.style.top = listObj.y + 'px';
  if (listObj.color) listEl.style.background = listObj.color;

  // Header
  const header = document.createElement('div');
  header.className = 'list-header';

  const left = document.createElement('div');
  left.className = 'list-header-left';

  const dragHandle = document.createElement('span');
  dragHandle.className = 'list-drag-handle';
  dragHandle.textContent = '⠿';
  dragHandle.title = 'Drag entire list column';

  const titleEl = document.createElement('span');
  titleEl.className = 'list-title';
  titleEl.textContent = listObj.title || 'List';
  titleEl.title = 'Click to rename list';

  // Inline editing of list title
  titleEl.addEventListener('click', () => {
    titleEl.contentEditable = 'true';
    titleEl.classList.add('editing');
    titleEl.focus();
    document.execCommand('selectAll', false, null);
  });
  titleEl.addEventListener('blur', async () => {
    titleEl.contentEditable = 'false';
    titleEl.classList.remove('editing');
    const newTitle = titleEl.textContent.trim() || 'List';
    listObj.title = newTitle;
    await fetch(`/api/lists/${listObj.id}`, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({ title: newTitle }),
    });
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleEl.blur();
    }
  });

  const notesInList = notes.filter((n) => n.list_id === listObj.id).sort((a, b) => (a.list_order || 0) - (b.list_order || 0));

  const countBadge = document.createElement('span');
  countBadge.className = 'list-badge';
  countBadge.textContent = `${notesInList.length} ${notesInList.length === 1 ? 'CARD' : 'CARDS'}`;

  left.appendChild(dragHandle);
  left.appendChild(titleEl);
  left.appendChild(countBadge);

  const actions = document.createElement('div');
  actions.className = 'list-header-actions';

  const addCardBtn = document.createElement('button');
  addCardBtn.className = 'note-btn';
  addCardBtn.textContent = '+';
  addCardBtn.title = 'Add card to this list';
  addCardBtn.addEventListener('click', () => {
    addNoteToSpecificList(listObj.id);
  });

  const listDeleteBtn = document.createElement('button');
  listDeleteBtn.className = 'note-btn delete-btn';
  listDeleteBtn.textContent = '✕';
  listDeleteBtn.title = 'Delete list (cards will be returned to board)';
  listDeleteBtn.addEventListener('click', async () => {
    if (confirm(`Dissolve list "${listObj.title}"? Notes will be released back onto the board.`)) {
      await fetch(`/api/lists/${listObj.id}`, { method: 'DELETE', headers: apiHeaders() });
      lists = lists.filter((l) => l.id !== listObj.id);
      await loadBoardData();
      showToast('List dissolved.');
    }
  });

  actions.appendChild(addCardBtn);
  actions.appendChild(listDeleteBtn);
  header.appendChild(left);
  header.appendChild(actions);

  // Cards Container inside List
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'list-cards-container';
  cardsContainer.dataset.listId = listObj.id;

  if (notesInList.length === 0) {
    const emptyHint = document.createElement('div');
    emptyHint.className = 'list-empty-hint';
    emptyHint.textContent = 'Drop cards here or click + below';
    cardsContainer.appendChild(emptyHint);
  } else {
    notesInList.forEach((note) => {
      const cardEl = createNoteEl(note, true);
      cardsContainer.appendChild(cardEl);
    });
  }

  // Footer button
  const footer = document.createElement('div');
  footer.className = 'list-footer';
  const quickAddBtn = document.createElement('button');
  quickAddBtn.className = 'list-add-btn';
  quickAddBtn.textContent = '+ Add a card';
  quickAddBtn.addEventListener('click', () => {
    addNoteToSpecificList(listObj.id);
  });
  footer.appendChild(quickAddBtn);

  listEl.appendChild(header);
  listEl.appendChild(cardsContainer);
  listEl.appendChild(footer);

  makeListDraggable(listEl, dragHandle, listObj);

  return listEl;
}

function makeListDraggable(listEl, handleEl, listObj) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let moved = false;

  handleEl.addEventListener('pointerdown', (e) => {
    if (isGridView) return;
    if (e.button === 2) return;
    dragging = true;
    moved = false;
    listEl.classList.add('dragging');
    handleEl.setPointerCapture(e.pointerId);

    const rect = listEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.stopPropagation();
  });

  handleEl.addEventListener('pointermove', (e) => {
    if (!dragging || isGridView) return;
    moved = true;
    const boardRect = board.getBoundingClientRect();
    let newX = Math.max(0, Math.round(e.clientX - boardRect.left - offsetX));
    let newY = Math.max(0, Math.round(e.clientY - boardRect.top - offsetY));
    listEl.style.left = newX + 'px';
    listEl.style.top = newY + 'px';
  });

  handleEl.addEventListener('pointerup', async (e) => {
    if (!dragging) return;
    dragging = false;
    listEl.classList.remove('dragging');
    handleEl.releasePointerCapture(e.pointerId);
    if (!moved || isGridView) return;

    const x = parseInt(listEl.style.left, 10);
    const y = parseInt(listEl.style.top, 10);
    listObj.x = x;
    listObj.y = y;
    await fetch(`/api/lists/${listObj.id}`, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({ x, y }),
    });
  });
}

async function addNoteToSpecificList(listId) {
  const currentNotesInList = notes.filter((n) => n.list_id === listId);
  const nextOrder = currentNotesInList.length;

  const res = await fetch(`/api/boards/${currentBoardId}/notes`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      type: 'note',
      heading: '',
      list_id: listId,
      list_order: nextOrder,
    }),
  });
  const newNote = await res.json();
  newNote._justCreated = true;
  notes.push(newNote);
  renderBoard();
  showToast('Card added to list!');
}

// ============================================================
// BUILDING NOTE ELEMENT (NEO-BRUTALIST CARD)
// ============================================================

function createNoteEl(note, isInList = false) {
  const el = document.createElement('div');
  el.className = 'note' + (isInList ? ' note-in-list' : '');
  el.dataset.id = note.id;

  if (!isInList) {
    el.style.left = note.x + 'px';
    el.style.top = note.y + 'px';
    el.style.width = (note.width || 240) + 'px';
    el.style.height = (note.height || 200) + 'px';
    el.style.transform = isGridView ? 'none' : `rotate(${note.rotation}deg)`;
    el.style.zIndex = note.z_index;
  }
  el.style.background = note.color;

  // Header Bar with Drag Handle & Options
  const header = document.createElement('div');
  header.className = 'note-header';

  const typeTag = document.createElement('span');
  typeTag.className = 'note-type-tag';
  typeTag.textContent = (note.type || 'note').toUpperCase();

  const controls = document.createElement('div');
  controls.className = 'note-controls';

  const dragHandle = document.createElement('span');
  dragHandle.className = 'note-drag-handle';
  dragHandle.textContent = '⠿';
  dragHandle.title = 'Drag card (drag onto another card to create a list, or into/out of a list)';

  const menuBtn = document.createElement('button');
  menuBtn.className = 'note-btn';
  menuBtn.textContent = '⋮';
  menuBtn.title = 'Note Options';
  menuBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openNoteOptions(note);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'note-btn delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Delete Idea';
  deleteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Delete this note?')) deleteNote(note.id);
  });

  controls.appendChild(dragHandle);
  controls.appendChild(menuBtn);
  controls.appendChild(deleteBtn);
  header.appendChild(typeTag);
  header.appendChild(controls);

  // Editable Heading
  const heading = document.createElement('div');
  heading.className = 'note-heading';
  heading.contentEditable = 'false';
  heading.textContent = note.heading || '';
  heading.style.fontFamily = note.font || 'Space Grotesk';
  attachAutoGrowOnInput(heading);

  heading.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEditingField(heading, note, 'heading');
  });

  heading.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && heading.contentEditable !== 'true') {
      startEditingField(heading, note, 'heading');
    }
  });

  // Note Body Wrapper
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

  el.appendChild(header);
  el.appendChild(heading);
  el.appendChild(bodyWrap);

  if (!isInList) {
    const resizeGrip = document.createElement('div');
    resizeGrip.className = 'note-resize-grip';
    el.appendChild(resizeGrip);
    attachResizeObserver(el, note);
  }

  makeDraggable(el, header, note);

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openNoteOptions(note);
  });

  if (note._justCreated) {
    delete note._justCreated;
    setTimeout(() => startEditingField(heading, note, 'heading'), 50);
  }

  return el;
}

function buildTextBody(note, bodyWrap, headingEl) {
  const text = document.createElement('div');
  text.className = 'note-text';
  text.contentEditable = 'false';
  text.textContent = note.text || '';
  text.style.fontFamily = note.font || 'Space Grotesk';
  text.style.fontWeight = note.bold ? '800' : '500';
  attachAutoGrowOnInput(text);

  text.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startEditingField(text, note, 'text');
  });

  text.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && text.contentEditable !== 'true') {
      startEditingField(text, note, 'text');
    }
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
    img.alt = note.heading || 'Idea image';
    img.title = 'Click to replace photo';
    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerImageUpload(note, container);
    });
    container.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'note-image-placeholder';
    placeholder.innerHTML = `<span>📷 TAP TO ADD PHOTO</span><span style="font-size:0.75rem; font-weight:600;">(Camera or Gallery)</span>`;
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
  reader.onload = (e) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      await saveNote(note, { image: compressedDataUrl });
      renderImageContent(note, container);
      showToast('Image saved to Neon DB!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

// Checklist & Bullet body
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

    if (type === 'todo') {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'neo-checkbox';
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
      dot.textContent = '■';
      row.appendChild(dot);
    }

    const span = document.createElement('span');
    span.className = type === 'todo' ? 'todo-text' : 'bullet-text';
    span.contentEditable = 'true';
    span.textContent = type === 'todo' ? item.text || '' : item || '';
    span.style.fontFamily = note.font || 'Space Grotesk';
    span.style.fontWeight = note.bold ? '800' : '500';
    attachAutoGrowOnInput(span);

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
      setTimeout(() => span.focus(), 0);
    }
  });

  autoGrow(listEl.closest('.note'));
}

function startEditingField(el, note, field) {
  el.contentEditable = 'true';
  el.classList.add('editing');
  el.focus();

  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  async function onBlur() {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    el.removeEventListener('blur', onBlur);
    el.removeEventListener('keydown', onKeydown);
    const value = el.textContent.trim();
    note[field] = value;
    await saveNote(note, { [field]: value });
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && field === 'heading') {
      e.preventDefault();
      el.blur();
    } else if (e.key === 'Escape') {
      el.textContent = note[field] || '';
      el.blur();
    }
  }

  el.addEventListener('blur', onBlur);
  el.addEventListener('keydown', onKeydown);
}

// ============================================================
// DRAGGING, OVERLAP DETECTION & GHOST LIST CREATION
// ============================================================

function makeDraggable(el, handleEl, note) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let moved = false;
  let placeholder = null;

  handleEl.addEventListener('pointerdown', (e) => {
    if (isGridView) return;
    if (e.button === 2) return;
    dragging = true;
    moved = false;

    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    if (note.list_id) {
      placeholder = document.createElement('div');
      placeholder.className = 'list-card-placeholder';
      placeholder.style.height = `${rect.height}px`;
      if (el.parentElement) {
        el.parentElement.insertBefore(placeholder, el);
      }

      el.style.setProperty('left', `${e.clientX - offsetX}px`, 'important');
      el.style.setProperty('top', `${e.clientY - offsetY}px`, 'important');
      el.style.setProperty('width', `${Math.min(260, rect.width || 260)}px`, 'important');
      el.style.setProperty('z-index', '999999', 'important');
    }

    el.classList.add('dragging');
    try {
      handleEl.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.stopPropagation();
  });

  handleEl.addEventListener('pointermove', (e) => {
    if (!dragging || isGridView) return;
    moved = true;

    if (note.list_id) {
      // Follow cursor fixed position across screen
      el.style.setProperty('left', `${e.clientX - offsetX}px`, 'important');
      el.style.setProperty('top', `${e.clientY - offsetY}px`, 'important');
    } else {
      const boardRect = board.getBoundingClientRect();
      let newX = Math.max(0, Math.round(e.clientX - boardRect.left - offsetX));
      let newY = Math.max(0, Math.round(e.clientY - boardRect.top - offsetY));
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
    }

    // --- OVERLAP & COLLISION DETECTION ---
    const dragRect = el.getBoundingClientRect();

    // 1. Check collision with existing List Columns (for adding/moving card into a list)
    let foundList = null;
    let foundInsertIndex = 0;
    const listCols = board.querySelectorAll('.list-column');

    for (const col of listCols) {
      const colRect = col.getBoundingClientRect();
      const colId = parseInt(col.dataset.listId, 10);

      // Check collision with column bounding box
      if (
        dragRect.right > colRect.left &&
        dragRect.left < colRect.right &&
        dragRect.bottom > colRect.top &&
        dragRect.top < colRect.bottom
      ) {
        foundList = lists.find((l) => l.id === colId);

        // Find child notes in this column to calculate insert slot
        const childCards = Array.from(col.querySelectorAll('.list-cards-container .note:not(.dragging)'));
        let idx = childCards.length;
        for (let i = 0; i < childCards.length; i++) {
          const cRect = childCards[i].getBoundingClientRect();
          if (dragRect.top + dragRect.height / 2 < cRect.top + cRect.height / 2) {
            idx = i;
            break;
          }
        }
        foundInsertIndex = idx;
        break;
      }
    }

    if (foundList) {
      activeHoverList = foundList;
      activeInsertIndex = foundInsertIndex;
      activeHoverNote = null;
      hideGhostListPreview();

      // Show drop indicator line in that list
      showListDropIndicator(foundList.id, foundInsertIndex);
      return;
    } else {
      activeHoverList = null;
      removeListDropIndicators();
    }

    // 2. Check overlap with other freeform cards (for CREATING A NEW GHOST LIST)
    let foundOtherNote = null;
    const freeCards = board.querySelectorAll('.note:not(.note-in-list):not(.dragging)');

    for (const card of freeCards) {
      const cardRect = card.getBoundingClientRect();
      const otherId = parseInt(card.dataset.id, 10);
      if (otherId === note.id) continue;

      const xOverlap = Math.max(0, Math.min(dragRect.right, cardRect.right) - Math.max(dragRect.left, cardRect.left));
      const yOverlap = Math.max(0, Math.min(dragRect.bottom, cardRect.bottom) - Math.max(dragRect.top, cardRect.top));
      const overlapArea = xOverlap * yOverlap;

      if (overlapArea > 1500 || (Math.abs(dragRect.left - cardRect.left) < 160 && Math.abs(dragRect.top - cardRect.top) < 140)) {
        foundOtherNote = notes.find((n) => n.id === otherId && !n.list_id);
        if (foundOtherNote) break;
      }
    }

    if (foundOtherNote) {
      activeHoverNote = foundOtherNote;
      showGhostListPreview(foundOtherNote, note);
    } else {
      activeHoverNote = null;
      hideGhostListPreview();
    }
  });

  handleEl.addEventListener('pointerup', async (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    try {
      handleEl.releasePointerCapture(e.pointerId);
    } catch (_) {}

    hideGhostListPreview();
    removeListDropIndicators();

    if (placeholder && placeholder.parentElement) {
      placeholder.remove();
      placeholder = null;
    }

    if (!moved || isGridView) {
      if (note.list_id) {
        renderBoard(); // reset styles if just tapped
      }
      return;
    }

    const boardRect = board.getBoundingClientRect();
    const droppedCanvasX = Math.max(0, Math.round(e.clientX - boardRect.left - offsetX));
    const droppedCanvasY = Math.max(0, Math.round(e.clientY - boardRect.top - offsetY));

    // CASE 1: Dropped onto another free card -> CREATE A NEW LIST GROUP!
    if (activeHoverNote) {
      const baseNote = activeHoverNote;
      activeHoverNote = null;

      const res = await fetch('/api/lists/create-group', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          board_id: currentBoardId,
          title: 'New List',
          x: baseNote.x,
          y: baseNote.y,
          note_ids: [baseNote.id, note.id],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        lists.push(data.list);
        data.notes.forEach((upN) => {
          const idx = notes.findIndex((n) => n.id === upN.id);
          if (idx >= 0) notes[idx] = upN;
        });
        renderBoard();
        showToast('✨ Grouped cards into a new List!');
        return;
      }
    }

    // CASE 2: Dropped into a List Column (another list, or reordered within same list)
    if (activeHoverList) {
      const targetList = activeHoverList;
      const targetOrder = activeInsertIndex;
      activeHoverList = null;

      const targetNotes = notes
        .filter((n) => n.list_id === targetList.id && n.id !== note.id)
        .sort((a, b) => (a.list_order || 0) - (b.list_order || 0));

      targetNotes.splice(targetOrder, 0, note);

      note.list_id = targetList.id;
      note.list_order = targetOrder;

      await saveNote(note, { list_id: targetList.id, list_order: targetOrder });

      // Update sequential order for other cards in target list
      for (let idx = 0; idx < targetNotes.length; idx++) {
        if (targetNotes[idx].id !== note.id && targetNotes[idx].list_order !== idx) {
          targetNotes[idx].list_order = idx;
          saveNote(targetNotes[idx], { list_order: idx });
        }
      }

      renderBoard();
      showToast(`Moved to list "${targetList.title}"!`);
      return;
    }

    // CASE 3: Card was inside a list, but user dragged it OUT onto empty board canvas!
    if (note.list_id) {
      note.list_id = null;
      note.x = droppedCanvasX;
      note.y = droppedCanvasY;
      await saveNote(note, { list_id: null, x: droppedCanvasX, y: droppedCanvasY });
      renderBoard();
      showToast('Card moved from list onto board.');
      return;
    }

    // CASE 4: Normal move of a free card on the canvas
    const x = parseInt(el.style.left, 10) || droppedCanvasX;
    const y = parseInt(el.style.top, 10) || droppedCanvasY;
    await saveNote(note, { x, y });
  });

  handleEl.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    hideGhostListPreview();
    removeListDropIndicators();
    if (placeholder && placeholder.parentElement) {
      placeholder.remove();
      placeholder = null;
    }
    renderBoard();
  });
}

function showGhostListPreview(baseNote, draggedNote) {
  ghostListPreview.classList.remove('hidden');
  ghostListPreview.style.left = (baseNote.x - 10) + 'px';
  ghostListPreview.style.top = (baseNote.y - 10) + 'px';
  ghostSlotBase.textContent = baseNote.heading || 'Idea 1';
  ghostSlotDropped.textContent = '+ ' + (draggedNote.heading || 'Idea 2');
}

function hideGhostListPreview() {
  ghostListPreview.classList.add('hidden');
}

function showListDropIndicator(listId, insertIndex) {
  removeListDropIndicators();
  const col = board.querySelector(`.list-column[data-list-id="${listId}"]`);
  if (!col) return;
  const container = col.querySelector('.list-cards-container');
  if (!container) return;

  const indicator = document.createElement('div');
  indicator.className = 'list-drop-indicator';

  const cards = container.querySelectorAll('.note:not(.dragging)');
  if (insertIndex >= cards.length) {
    container.appendChild(indicator);
  } else {
    container.insertBefore(indicator, cards[insertIndex]);
  }
}

function removeListDropIndicators() {
  board.querySelectorAll('.list-drop-indicator').forEach((el) => el.remove());
}

function attachResizeObserver(el, note) {
  let debounceTimer = null;
  const ro = new ResizeObserver(() => {
    if (isGridView || note.list_id) return;
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

// ============================================================
// ADDING NEW NOTES (FAB & CONTEXT MENU)
// ============================================================

async function addNoteAt(x, y, type) {
  if (!currentUser) {
    openAuthModal();
    return;
  }
  if (currentBoardId === null) return;

  const res = await fetch(`/api/boards/${currentBoardId}/notes`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ type, heading: '', x: Math.round(x), y: Math.round(y) }),
  });
  const note = await res.json();
  note._justCreated = true;
  notes.push(note);
  renderBoard();
  showToast(`Added ${type} card!`);
}

// FAB Triggering
fabMainBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fabMainBtn.classList.toggle('open');
  fabMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!fabContainer().contains(e.target)) {
    fabMainBtn.classList.remove('open');
    fabMenu.classList.add('hidden');
  }
});

function fabContainer() {
  return document.getElementById('fab-container');
}

fabMenu.querySelectorAll('.fab-item-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    fabMainBtn.classList.remove('open');
    fabMenu.classList.add('hidden');

    const viewportX = boardViewport.scrollLeft + Math.min(window.innerWidth * 0.35, 200);
    const viewportY = boardViewport.scrollTop + Math.min(window.innerHeight * 0.25, 160);

    if (btn.dataset.type === 'new-list') {
      addNewList('New List', viewportX, viewportY);
    } else {
      addNoteAt(viewportX, viewportY, btn.dataset.type);
    }
  });
});

// Board Right-Click Context Menu
board.addEventListener('contextmenu', (e) => {
  if (e.target !== board) return;
  e.preventDefault();
  closeMenus();

  const boardRect = board.getBoundingClientRect();
  lastClickPos = {
    x: e.clientX - boardRect.left + boardViewport.scrollLeft,
    y: e.clientY - boardRect.top + boardViewport.scrollTop,
  };

  boardMenu.classList.remove('hidden');
  boardMenu.style.left = e.clientX + window.scrollX + 'px';
  boardMenu.style.top = e.clientY + window.scrollY + 'px';
});

boardMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.action === 'add-list') {
    addNewList('New List', lastClickPos.x, lastClickPos.y);
  } else if (btn.dataset.action === 'add') {
    addNoteAt(lastClickPos.x, lastClickPos.y, btn.dataset.type);
  }
  closeMenus();
});

function closeMenus() {
  boardMenu.classList.add('hidden');
}
document.addEventListener('click', closeMenus);

// ============================================================
// NOTE OPTIONS MODAL (TOUCH & MOBILE FRIENDLY)
// ============================================================

function openNoteOptions(note) {
  activeNoteForOptions = note;
  noteModal.classList.remove('hidden');
}

noteModalClose.addEventListener('click', () => {
  noteModal.classList.add('hidden');
  activeNoteForOptions = null;
});

noteColorPicker.addEventListener('click', async (e) => {
  const chip = e.target.closest('.color-chip');
  if (!chip || !activeNoteForOptions) return;
  const color = chip.dataset.color;
  activeNoteForOptions.color = color;
  await saveNote(activeNoteForOptions, { color });
  renderBoard();
  noteModal.classList.add('hidden');
});

noteFontPicker.addEventListener('click', async (e) => {
  const btn = e.target.closest('.font-btn');
  if (!btn || !activeNoteForOptions) return;
  const font = btn.dataset.font;
  activeNoteForOptions.font = font;
  await saveNote(activeNoteForOptions, { font });
  renderBoard();
  noteModal.classList.add('hidden');
});

optToggleBold.addEventListener('click', async () => {
  if (!activeNoteForOptions) return;
  activeNoteForOptions.bold = activeNoteForOptions.bold ? 0 : 1;
  await saveNote(activeNoteForOptions, { bold: activeNoteForOptions.bold });
  renderBoard();
  noteModal.classList.add('hidden');
});

optBringFront.addEventListener('click', async () => {
  if (!activeNoteForOptions) return;
  const res = await fetch(`/api/notes/${activeNoteForOptions.id}/front`, { method: 'PUT', headers: apiHeaders() });
  const data = await res.json();
  activeNoteForOptions.z_index = data.z_index;
  renderBoard();
  noteModal.classList.add('hidden');
});

optSendBack.addEventListener('click', async () => {
  if (!activeNoteForOptions) return;
  const res = await fetch(`/api/notes/${activeNoteForOptions.id}/back`, { method: 'PUT', headers: apiHeaders() });
  const data = await res.json();
  activeNoteForOptions.z_index = data.z_index;
  renderBoard();
  noteModal.classList.add('hidden');
});

optDeleteNote.addEventListener('click', async () => {
  if (!activeNoteForOptions) return;
  if (confirm('Delete this note?')) {
    await deleteNote(activeNoteForOptions.id);
    noteModal.classList.add('hidden');
  }
});

// ============================================================
// MOBILE DRAWER & LAYOUT SWITCHER
// ============================================================

function openMobileDrawer() {
  mobileDrawer.classList.remove('hidden');
}

function closeMobileDrawer() {
  mobileDrawer.classList.add('hidden');
}

mobileDrawerBtn.addEventListener('click', openMobileDrawer);
closeDrawerBtn.addEventListener('click', closeMobileDrawer);
mobileDrawer.addEventListener('click', (e) => {
  if (e.target === mobileDrawer) closeMobileDrawer();
});

drawerViewToggle.addEventListener('click', () => {
  toggleLayoutView();
  closeMobileDrawer();
});

drawerAddBoard.addEventListener('click', () => {
  closeMobileDrawer();
  addTabBtn.click();
});

drawerExport.addEventListener('click', () => {
  closeMobileDrawer();
  saveBtn.click();
});

drawerBackup.addEventListener('click', () => {
  closeMobileDrawer();
  backupBtn.click();
});

drawerRestore.addEventListener('click', () => {
  closeMobileDrawer();
  restoreBtn.click();
});

function toggleLayoutView() {
  isGridView = !isGridView;
  document.body.classList.toggle('mode-canvas', !isGridView);
  document.body.classList.toggle('mode-grid', isGridView);

  viewToggleBtn.querySelector('.btn-text').textContent = isGridView ? 'Canvas View' : 'Grid View';
  viewToggleBtn.querySelector('.btn-icon').textContent = isGridView ? '🎨' : '🗂️';
  renderBoard();
  showToast(`Switched to ${isGridView ? 'Responsive Grid' : 'Freeform Canvas'} mode.`);
}

viewToggleBtn.addEventListener('click', toggleLayoutView);

// ============================================================
// REALTIME SOCKET.IO EVENT HANDLERS
// ============================================================

socket.on('connect', () => {
  if (currentBoardId !== null) socket.emit('join_board', { board_id: currentBoardId });
});

socket.on('board_created', (b) => {
  if (!boards.some((x) => x.id === b.id)) {
    boards.push(b);
    renderTabs();
  }
});

socket.on('board_renamed', (b) => {
  const existing = boards.find((x) => x.id === b.id);
  if (existing) {
    existing.name = b.name;
    renderTabs();
  }
});

socket.on('board_deleted', ({ id }) => {
  boards = boards.filter((x) => x.id !== id);
  renderTabs();
  if (id === currentBoardId) {
    currentBoardId = boards.length ? boards[0].id : null;
    renderTabs();
    loadBoardData();
  }
});

socket.on('list_created', (newList) => {
  if (newList.board_id !== currentBoardId) return;
  if (!lists.some((l) => l.id === newList.id)) {
    lists.push(newList);
    renderBoard();
  }
});

socket.on('list_updated', (upList) => {
  if (upList.board_id !== currentBoardId) return;
  const idx = lists.findIndex((l) => l.id === upList.id);
  if (idx >= 0) {
    Object.assign(lists[idx], upList);
    renderBoard();
  }
});

socket.on('list_deleted', ({ id, board_id }) => {
  if (board_id !== currentBoardId) return;
  lists = lists.filter((l) => l.id !== id);
  loadBoardData();
});

socket.on('note_created', (note) => {
  if (note.board_id !== currentBoardId) return;
  if (!notes.some((n) => n.id === note.id)) {
    notes.push(note);
    renderBoard();
  }
});

socket.on('note_updated', (note) => {
  if (note.board_id !== currentBoardId) return;
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    Object.assign(notes[idx], note);
    renderBoard();
  }
});

socket.on('note_deleted', ({ id, board_id }) => {
  if (board_id !== currentBoardId) return;
  notes = notes.filter((n) => n.id !== id);
  renderBoard();
});

socket.on('data_imported', () => {
  loadBoards();
});

// ============================================================
// INITIALIZATION
// ============================================================

window.addEventListener('DOMContentLoaded', async () => {
  if (window.innerWidth <= 768) {
    isGridView = true;
    document.body.classList.remove('mode-canvas');
    document.body.classList.add('mode-grid');
    viewToggleBtn.querySelector('.btn-text').textContent = 'Canvas View';
    viewToggleBtn.querySelector('.btn-icon').textContent = '🎨';
  }
  await checkAuth();
});
