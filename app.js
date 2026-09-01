/* =============================================
   WORKLANE – Application Logic
   ============================================= */

'use strict';

// ── Constants ────────────────────────────────
const STORAGE_KEY = 'worklane_data_v2';
const NOTIF_KEY   = 'worklane_notifs_v2';
const CHECK_INTERVAL_MS = 60_000; // check due dates every minute

const BOARD_COLORS = [
  { name: 'Indigo',  value: '#6366f1' },
  { name: 'Purple',  value: '#a855f7' },
  { name: 'Pink',    value: '#ec4899' },
  { name: 'Rose',    value: '#f43f5e' },
  { name: 'Orange',  value: '#f97316' },
  { name: 'Amber',   value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal',    value: '#14b8a6' },
  { name: 'Sky',     value: '#0ea5e9' },
  { name: 'Blue',    value: '#3b82f6' },
  { name: 'Slate',   value: '#64748b' },
  { name: 'Zinc',    value: '#71717a' },
];

const AVATAR_COLORS = [
  '#6366f1','#a855f7','#ec4899','#f43f5e',
  '#f97316','#10b981','#14b8a6','#0ea5e9','#3b82f6',
];

const LABELS = [
  { id: 'bug',      name: 'Bug',      color: '#ef4444' },
  { id: 'feature',  name: 'Feature',  color: '#6366f1' },
  { id: 'design',   name: 'Design',   color: '#ec4899' },
  { id: 'backend',  name: 'Backend',  color: '#f97316' },
  { id: 'frontend', name: 'Frontend', color: '#0ea5e9' },
  { id: 'urgent',   name: 'Urgent',   color: '#f59e0b' },
  { id: 'done',     name: 'Done',     color: '#10b981' },
];

// ── State ────────────────────────────────────
let state = {
  boards: [],
  activeBoardId: null,
};
let notifications = [];
let activeContextColumnId = null;
let dragCard = null;
let dragSourceColumnId = null;
let openCardId = null;
let openCardBoardId = null;

// ── Helpers ──────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const el = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch(e) {}
}
function saveNotifs() {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications)); } catch(e) {}
}
function loadNotifs() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) notifications = JSON.parse(raw);
  } catch(e) {}
}

function getBoard(boardId) { return state.boards.find(b => b.id === boardId); }
function getActiveBoard() { return getBoard(state.activeBoardId); }
function getColumn(board, colId) { return board?.columns?.find(c => c.id === colId); }
function getCard(board, cardId) {
  for (const col of board?.columns ?? []) {
    const c = col.cards?.find(c => c.id === cardId);
    if (c) return { card: c, column: col };
  }
  return null;
}

function avatarInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString();
}

function formatDueDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function getDueStatus(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return 'overdue';
  if (diff < 86400000) return 'due-soon';
  return 'ok';
}

function fileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const map = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📊', pptx: '📊', txt: '📃', zip: '🗜️', rar: '🗜️',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mp3: '🎵', wav: '🎵',
    js: '💻', ts: '💻', py: '💻', html: '💻', css: '💻', json: '📋',
  };
  return map[ext] || '📁';
}

function isImageFile(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','svg','webp','bmp'].includes(ext);
}

// ── Toast ────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const container = el('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ── Notification System ──────────────────────
function addNotification(title, sub, icon = '🔔', cardId = null, boardId = null) {
  const notif = { id: uid(), title, sub, icon, cardId, boardId, time: new Date().toISOString() };
  notifications.unshift(notif);
  if (notifications.length > 50) notifications.pop();
  saveNotifs();
  renderNotifBadge();
  renderNotifPanel();
  // Browser notification
  if (Notification.permission === 'granted') {
    new Notification(`Worklane: ${title}`, { body: sub, icon: '' });
  }
}

function renderNotifBadge() {
  const badge = el('notif-badge');
  const count = notifications.length;
  badge.textContent = count > 99 ? '99+' : count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function renderNotifPanel() {
  const list = el('notif-list');
  if (!notifications.length) {
    list.innerHTML = '<div class="notif-empty">🎉 All caught up!</div>';
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item" data-notif-card="${n.cardId || ''}" data-notif-board="${n.boardId || ''}">
      <div class="notif-icon">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-sub">${n.sub}</div>
      </div>
      <div class="notif-time">${formatTime(n.time)}</div>
    </div>
  `).join('');
  list.querySelectorAll('.notif-item').forEach((item, i) => {
    item.addEventListener('click', () => {
      const bid = item.dataset.notifBoard;
      const cid = item.dataset.notifCard;
      if (bid && cid) {
        switchBoard(bid);
        openCard(cid, bid);
        closeNotifPanel();
      }
    });
  });
}

function checkDueDates() {
  const now = new Date();
  state.boards.forEach(board => {
    board.columns?.forEach(col => {
      col.cards?.forEach(card => {
        if (!card.dueDate || card.completed) return;
        const due = new Date(card.dueDate);
        const diff = due - now;
        const alerted24Key = `alerted24_${card.id}`;
        const alertedODKey  = `alertedOD_${card.id}`;
        // Within 24h
        if (diff > 0 && diff < 86400000 && !card[alerted24Key]) {
          card[alerted24Key] = true;
          addNotification(
            `Due soon: ${card.title}`,
            `Due ${formatDueDate(card.dueDate)} on board "${board.name}"`,
            '⏰', card.id, board.id
          );
        }
        // Overdue
        if (diff < 0 && !card[alertedODKey]) {
          card[alertedODKey] = true;
          addNotification(
            `Overdue: ${card.title}`,
            `Was due ${formatDueDate(card.dueDate)} on board "${board.name}"`,
            '🚨', card.id, board.id
          );
        }
      });
    });
  });
  saveState();
}

// Request browser notification permission
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ── Modal Helpers ────────────────────────────
function openModal(id) { el(id).classList.remove('hidden'); }
function closeModal(id) { el(id).classList.add('hidden'); }

document.addEventListener('click', e => {
  // Close button
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) { closeModal(closeBtn.dataset.close); return; }
  // Click outside modal
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
    return;
  }
  // Hide context menu
  if (!e.target.closest('#context-menu')) {
    el('context-menu').classList.add('hidden');
  }
  // Hide notif panel
  if (!e.target.closest('#notif-panel') && !e.target.closest('#btn-notif')) {
    el('notif-panel').classList.add('hidden');
  }
});

// ── Board Rendering ──────────────────────────
function renderSidebar() {
  const boardList = el('board-list');
  boardList.innerHTML = state.boards.map(b => `
    <li class="board-list-item ${b.id === state.activeBoardId ? 'active' : ''}"
        data-board-id="${b.id}">
      <div class="board-color-dot" style="background:${b.color}"></div>
      <span class="board-name">${escapeHtml(b.name)}</span>
      <button class="board-del" title="Delete board" data-del-board="${b.id}">✕</button>
    </li>
  `).join('');
  boardList.querySelectorAll('.board-list-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.board-del')) return;
      switchBoard(item.dataset.boardId);
    });
  });
  boardList.querySelectorAll('.board-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Delete this board and all its cards?')) {
        deleteBoard(btn.dataset.delBoard);
      }
    });
  });
}

function renderTopbar(board) {
  el('topbar-title').textContent = board ? board.name : 'Select a board';
  const membersEl = el('topbar-members');
  membersEl.innerHTML = '';
  el('btn-manage-members').style.display = board ? '' : 'none';
  if (!board) return;
  const members = board.members || [];
  const show = members.slice(0, 5);
  show.forEach(m => {
    const av = document.createElement('div');
    av.className = 'member-avatar';
    av.style.background = m.color || '#6366f1';
    av.title = m.name;
    av.textContent = avatarInitials(m.name);
    membersEl.appendChild(av);
  });
  if (members.length > 5) {
    const more = document.createElement('div');
    more.className = 'member-count-badge';
    more.textContent = `+${members.length - 5}`;
    membersEl.appendChild(more);
  }
}

function switchBoard(boardId) {
  state.activeBoardId = boardId;
  saveState();
  renderAll();
}

function renderAll() {
  renderSidebar();
  const board = getActiveBoard();
  renderTopbar(board);
  renderBoard(board);
}

function renderBoard(board) {
  const area = el('board-area');
  area.innerHTML = '';
  if (!board) {
    area.appendChild(buildEmptyState());
    return;
  }
  // gradient background based on board color
  area.style.background = `
    radial-gradient(ellipse at 20% 20%, ${board.color}22 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, ${board.color}15 0%, transparent 50%),
    var(--bg-deep)
  `;

  (board.columns || []).forEach(col => {
    area.appendChild(buildColumn(col, board));
  });

  // Add Column button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-column-btn';
  addBtn.id = 'btn-add-column';
  addBtn.innerHTML = '＋ Add Column';
  addBtn.addEventListener('click', () => openModal('add-column-modal'));
  area.appendChild(addBtn);
}

function buildEmptyState() {
  const div = document.createElement('div');
  div.id = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon">📋</div>
    <h1 class="empty-title">Welcome to Worklane</h1>
    <p class="empty-sub">Create your first board from the sidebar to start organizing your work.</p>
    <button class="btn-primary" id="btn-empty-create">＋ Create First Board</button>
  `;
  div.querySelector('#btn-empty-create').addEventListener('click', () => openModal('create-board-modal'));
  return div;
}

// ── Column Builder ───────────────────────────
function buildColumn(col, board) {
  const div = document.createElement('div');
  div.className = 'column';
  div.dataset.colId = col.id;

  const cards = col.cards || [];
  const count = cards.length;
  const completedCount = cards.filter(c => c.completed).length;

  div.innerHTML = `
    <div class="column-header">
      <span class="column-title" data-col-id="${col.id}">${escapeHtml(col.name)}</span>
      <span class="column-count">${completedCount > 0 ? completedCount + '/' : ''}${count}</span>
      <button class="column-menu-btn" data-col-id="${col.id}" title="Column menu">⋯</button>
    </div>
    <div class="column-cards" data-col-id="${col.id}"></div>
    <div class="column-footer">
      <button class="btn-add-card" data-col-id="${col.id}">＋ Add a card</button>
    </div>
  `;

  // Context menu button
  div.querySelector('.column-menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    activeContextColumnId = col.id;
    const rect = e.target.getBoundingClientRect();
    const menu = el('context-menu');
    menu.style.top = rect.bottom + 6 + 'px';
    menu.style.left = rect.left + 'px';
    menu.classList.remove('hidden');
  });

  // Inline title edit
  div.querySelector('.column-title').addEventListener('dblclick', e => {
    e.stopPropagation();
    el('rename-column-input').value = col.name;
    activeContextColumnId = col.id;
    openModal('rename-column-modal');
    setTimeout(() => el('rename-column-input').select(), 50);
  });

  // Cards
  const cardsContainer = div.querySelector('.column-cards');
  cards.forEach(card => cardsContainer.appendChild(buildCard(card, col)));

  // Drag-over events
  cardsContainer.addEventListener('dragover', e => {
    e.preventDefault();
    cardsContainer.classList.add('drag-over');
    const after = getDragAfterElement(cardsContainer, e.clientY);
    const placeholder = qs('.drag-placeholder');
    if (!after) cardsContainer.appendChild(placeholder || createPlaceholder());
    else cardsContainer.insertBefore(placeholder || createPlaceholder(), after);
  });
  cardsContainer.addEventListener('dragleave', e => {
    if (!cardsContainer.contains(e.relatedTarget)) {
      cardsContainer.classList.remove('drag-over');
    }
  });
  cardsContainer.addEventListener('drop', e => {
    e.preventDefault();
    cardsContainer.classList.remove('drag-over');
    qs('.drag-placeholder')?.remove();
    if (!dragCard) return;
    dropCard(col.id, e.clientY, cardsContainer);
  });

  // Add card button
  div.querySelector('.btn-add-card').addEventListener('click', () => {
    showInlineAddCard(col.id, cardsContainer, div);
  });

  return div;
}

function createPlaceholder() {
  const p = document.createElement('div');
  p.className = 'drag-placeholder';
  return p;
}

// ── Card Builder ─────────────────────────────
function buildCard(card, col) {
  const div = document.createElement('div');
  div.className = 'card' + (card.completed ? ' completed' : '');
  div.dataset.cardId = card.id;
  div.draggable = true;

  const dueStatus = getDueStatus(card.dueDate);
  if (!card.completed && dueStatus) div.classList.add(dueStatus);

  // Labels
  const labelHtml = (card.labels || []).map(lid => {
    const lbl = LABELS.find(l => l.id === lid);
    return lbl ? `<div class="card-label" style="background:${lbl.color}" title="${lbl.name}"></div>` : '';
  }).join('');

  // Assignees
  const assigneeHtml = (card.assignees || []).slice(0, 3).map(uid_ => {
    const board = getActiveBoard();
    const m = (board?.members || []).find(m => m.id === uid_);
    return m ? `<div class="av" style="background:${m.color}" title="${m.name}">${avatarInitials(m.name)}</div>` : '';
  }).join('');

  // Meta items
  let metaHtml = '';
  if (card.dueDate) {
    const cls = card.completed ? 'completed-date' : (dueStatus === 'overdue' ? 'overdue' : dueStatus === 'due-soon' ? 'due-soon' : '');
    metaHtml += `<span class="card-meta-item ${cls}">📅 ${formatDueDate(card.dueDate)}</span>`;
  }
  if ((card.comments || []).length > 0) {
    metaHtml += `<span class="card-meta-item">💬 ${card.comments.length}</span>`;
  }
  if ((card.attachments || []).length > 0) {
    metaHtml += `<span class="card-meta-item">📎 ${card.attachments.length}</span>`;
  }
  if (card.description) {
    metaHtml += `<span class="card-meta-item">📝</span>`;
  }

  div.innerHTML = `
    ${labelHtml ? `<div class="card-labels">${labelHtml}</div>` : ''}
    <div class="card-title">${escapeHtml(card.title)}</div>
    ${metaHtml ? `<div class="card-meta">${metaHtml}</div>` : ''}
    <div class="card-bottom">
      <div class="card-assignees">${assigneeHtml}</div>
      <button class="btn-complete" data-card-id="${card.id}">
        ${card.completed ? '✅ Done' : '⬜ Complete'}
      </button>
    </div>
  `;

  // Complete toggle
  div.querySelector('.btn-complete').addEventListener('click', e => {
    e.stopPropagation();
    toggleCardComplete(card.id);
  });

  // Drag events
  div.addEventListener('dragstart', e => {
    dragCard = card.id;
    dragSourceColumnId = col.id;
    div.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    qs('.drag-placeholder')?.remove();
    dragCard = null;
    dragSourceColumnId = null;
  });

  // Click to open
  div.addEventListener('click', e => {
    if (e.target.closest('.btn-complete')) return;
    openCard(card.id, state.activeBoardId);
  });

  return div;
}

// ── Drag helpers ─────────────────────────────
function getDragAfterElement(container, y) {
  const cards = qsa('.card:not(.dragging)', container);
  return cards.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function dropCard(targetColId, y, container) {
  const board = getActiveBoard();
  if (!board || !dragCard) return;
  const sourceCol = getColumn(board, dragSourceColumnId);
  const targetCol = getColumn(board, targetColId);
  if (!sourceCol || !targetCol) return;

  const cardIdx = sourceCol.cards.findIndex(c => c.id === dragCard);
  if (cardIdx === -1) return;
  const [card] = sourceCol.cards.splice(cardIdx, 1);

  const after = getDragAfterElement(container, y);
  if (!after) {
    targetCol.cards.push(card);
  } else {
    const afterIdx = targetCol.cards.findIndex(c => c.id === after.dataset.cardId);
    targetCol.cards.splice(afterIdx, 0, card);
  }

  saveState();
  renderBoard(board);
}

// ── Inline Add Card ──────────────────────────
function showInlineAddCard(colId, cardsContainer, columnEl) {
  // Remove existing forms
  qsa('.add-card-form').forEach(f => f.remove());
  const form = document.createElement('div');
  form.className = 'add-card-form';
  form.innerHTML = `
    <textarea placeholder="Card title…" maxlength="200" rows="2"></textarea>
    <div class="form-actions">
      <button class="btn-primary" id="confirm-add-card">Add Card</button>
      <button class="btn-secondary" id="cancel-add-card">Cancel</button>
    </div>
  `;
  const footer = columnEl.querySelector('.column-footer');
  columnEl.insertBefore(form, footer);
  const ta = form.querySelector('textarea');
  ta.focus();

  form.querySelector('#confirm-add-card').addEventListener('click', () => {
    const title = ta.value.trim();
    if (!title) { ta.focus(); return; }
    addCard(colId, title);
    form.remove();
  });
  form.querySelector('#cancel-add-card').addEventListener('click', () => form.remove());
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const title = ta.value.trim();
      if (title) { addCard(colId, title); form.remove(); }
    }
    if (e.key === 'Escape') form.remove();
  });
}

// ── Card CRUD ────────────────────────────────
function addCard(colId, title) {
  const board = getActiveBoard();
  if (!board) return;
  const col = getColumn(board, colId);
  if (!col) return;
  const card = {
    id: uid(), title,
    description: '', comments: [],
    attachments: [], labels: [],
    assignees: [], dueDate: null,
    completed: false, completedAt: null,
    createdAt: new Date().toISOString(),
  };
  col.cards.push(card);
  saveState();
  renderBoard(board);
  showToast(`Card "${title}" created`, 'success');
  requestNotifPermission();
}

function toggleCardComplete(cardId) {
  const board = getActiveBoard();
  if (!board) return;
  const result = getCard(board, cardId);
  if (!result) return;
  const { card } = result;
  card.completed = !card.completed;
  card.completedAt = card.completed ? new Date().toISOString() : null;
  saveState();
  renderBoard(board);
  if (card.completed) showToast(`"${card.title}" marked complete! ✅`, 'success');
  // Refresh open card modal
  if (openCardId === cardId) syncCardModal(card, result.column);
}

function deleteCard(cardId) {
  const board = getActiveBoard();
  if (!board) return;
  for (const col of board.columns) {
    const idx = col.cards.findIndex(c => c.id === cardId);
    if (idx !== -1) {
      col.cards.splice(idx, 1);
      saveState();
      closeModal('card-modal');
      renderBoard(board);
      showToast('Card deleted', 'info');
      return;
    }
  }
}

// ── Open Card Modal ──────────────────────────
function openCard(cardId, boardId) {
  const board = getBoard(boardId);
  if (!board) return;
  const result = getCard(board, cardId);
  if (!result) return;
  const { card, column } = result;
  openCardId = cardId;
  openCardBoardId = boardId;
  populateCardModal(card, column, board);
  openModal('card-modal');
}

function populateCardModal(card, column, board) {
  // Title
  const titleEl = el('card-modal-title');
  titleEl.value = card.title;
  autoResize(titleEl);

  // Column label
  el('card-modal-column-name').textContent = column.name;

  // Description
  el('card-description').value = card.description || '';

  // Due date
  const dueDateEl = el('card-due-date');
  dueDateEl.value = card.dueDate ? card.dueDate.slice(0, 16) : '';

  // Complete button in sidebar
  syncCompleteBtn(card);

  // Labels display (in header)
  renderCardLabelDisplay(card);

  // Label picker
  renderLabelPicker(card);

  // Member picker
  renderMemberPicker(card, board);

  // Attachments
  renderAttachments(card);

  // Comments
  renderComments(card);
}

function syncCardModal(card, column) {
  if (openCardId !== card.id) return;
  syncCompleteBtn(card);
  renderCardLabelDisplay(card);
  renderLabelPicker(card);
}

function syncCompleteBtn(card) {
  const btn = el('btn-toggle-complete');
  btn.textContent = card.completed ? '✅ Completed' : '⬜ Mark Complete';
  btn.style.color = card.completed ? 'var(--success)' : '';
  btn.style.borderColor = card.completed ? 'var(--success)' : '';
}

function renderCardLabelDisplay(card) {
  const el_ = el('card-label-display');
  el_.innerHTML = (card.labels || []).map(lid => {
    const lbl = LABELS.find(l => l.id === lid);
    return lbl ? `<span style="background:${lbl.color};padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;color:#fff">${lbl.name}</span>` : '';
  }).join('');
}

function renderLabelPicker(card) {
  const picker = el('label-picker');
  picker.innerHTML = LABELS.map(l => `
    <div class="label-chip ${(card.labels || []).includes(l.id) ? 'selected' : ''}"
         style="background:${l.color};color:#fff"
         data-label-id="${l.id}">${l.name}</div>
  `).join('');
  picker.querySelectorAll('.label-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleCardLabel(chip.dataset.labelId));
  });
}

function toggleCardLabel(labelId) {
  const board = getBoard(openCardBoardId);
  if (!board) return;
  const result = getCard(board, openCardId);
  if (!result) return;
  const { card } = result;
  card.labels = card.labels || [];
  const idx = card.labels.indexOf(labelId);
  if (idx === -1) card.labels.push(labelId);
  else card.labels.splice(idx, 1);
  saveState();
  renderLabelPicker(card);
  renderCardLabelDisplay(card);
  renderBoard(board);
}

function renderMemberPicker(card, board) {
  const picker = el('member-picker');
  const members = board.members || [];
  if (!members.length) {
    picker.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No members on this board yet.</div>';
    return;
  }
  picker.innerHTML = members.map(m => `
    <div class="member-pick-item ${(card.assignees || []).includes(m.id) ? 'selected' : ''}"
         data-member-id="${m.id}">
      <div class="user-avatar" style="width:24px;height:24px;font-size:9px;background:${m.color}">${avatarInitials(m.name)}</div>
      <span class="member-pick-name">${escapeHtml(m.name)}</span>
      ${(card.assignees || []).includes(m.id) ? '<span class="check">✓</span>' : ''}
    </div>
  `).join('');
  picker.querySelectorAll('.member-pick-item').forEach(item => {
    item.addEventListener('click', () => toggleCardAssignee(item.dataset.memberId));
  });
}

function toggleCardAssignee(memberId) {
  const board = getBoard(openCardBoardId);
  if (!board) return;
  const result = getCard(board, openCardId);
  if (!result) return;
  const { card } = result;
  card.assignees = card.assignees || [];
  const idx = card.assignees.indexOf(memberId);
  if (idx === -1) card.assignees.push(memberId);
  else card.assignees.splice(idx, 1);
  saveState();
  renderMemberPicker(card, board);
  renderBoard(board);
}

function renderAttachments(card) {
  const list = el('attachment-list');
  const attachments = card.attachments || [];
  if (!attachments.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No attachments yet.</div>';
    return;
  }
  list.innerHTML = attachments.map(a => `
    <div class="attachment-item" data-att-id="${a.id}">
      ${a.dataUrl && isImageFile(a.name)
        ? `<img class="attachment-preview" src="${a.dataUrl}" alt="${escapeHtml(a.name)}" />`
        : `<div class="attachment-icon">${fileIcon(a.name)}</div>`
      }
      <div class="attachment-info">
        <div class="attachment-name">${escapeHtml(a.name)}</div>
        <div class="attachment-size">${formatBytes(a.size)}</div>
      </div>
      ${a.dataUrl ? `<a href="${a.dataUrl}" download="${escapeHtml(a.name)}" style="color:var(--accent-light);font-size:12px;padding:4px 8px;background:var(--bg-card);border-radius:4px;border:1px solid var(--border)" title="Download">⬇</a>` : ''}
      <button class="attachment-del" data-att-id="${a.id}" title="Remove">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.attachment-del').forEach(btn => {
    btn.addEventListener('click', () => removeAttachment(btn.dataset.attId));
  });
}

function removeAttachment(attId) {
  const board = getBoard(openCardBoardId);
  if (!board) return;
  const result = getCard(board, openCardId);
  if (!result) return;
  const { card } = result;
  card.attachments = (card.attachments || []).filter(a => a.id !== attId);
  saveState();
  renderAttachments(card);
  renderBoard(board);
}

function renderComments(card) {
  const list = el('comment-list');
  const comments = card.comments || [];
  if (!comments.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No comments yet. Be the first!</div>';
    return;
  }
  list.innerHTML = comments.map(c => `
    <div class="comment-item" data-comment-id="${c.id}">
      <div class="user-avatar" style="width:28px;height:28px;font-size:10px;flex-shrink:0;background:${c.avatarColor || '#6366f1'}">
        ${c.authorInitials || 'ME'}
      </div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(c.author)}</span>
          <span class="comment-time">${formatTime(c.createdAt)}</span>
          <button class="comment-del" data-comment-id="${c.id}">✕</button>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.comment-del').forEach(btn => {
    btn.addEventListener('click', () => deleteComment(btn.dataset.commentId));
  });
}

function deleteComment(commentId) {
  const board = getBoard(openCardBoardId);
  if (!board) return;
  const result = getCard(board, openCardId);
  if (!result) return;
  const { card } = result;
  card.comments = (card.comments || []).filter(c => c.id !== commentId);
  saveState();
  renderComments(card);
  renderBoard(board);
}

// ── Board CRUD ───────────────────────────────
function createBoard(name, color) {
  const board = {
    id: uid(),
    name,
    color,
    members: [],
    columns: [
      { id: uid(), name: 'To Do',       cards: [] },
      { id: uid(), name: 'In Progress', cards: [] },
      { id: uid(), name: 'Review',      cards: [] },
      { id: uid(), name: 'Done',        cards: [] },
    ],
  };
  state.boards.push(board);
  state.activeBoardId = board.id;
  saveState();
  renderAll();
  showToast(`Board "${name}" created!`, 'success');
}

function deleteBoard(boardId) {
  const idx = state.boards.findIndex(b => b.id === boardId);
  if (idx === -1) return;
  const name = state.boards[idx].name;
  state.boards.splice(idx, 1);
  if (state.activeBoardId === boardId) {
    state.activeBoardId = state.boards.length ? state.boards[0].id : null;
  }
  saveState();
  renderAll();
  showToast(`Board "${name}" deleted`, 'info');
}

// ── Column CRUD ──────────────────────────────
function addColumn(name) {
  const board = getActiveBoard();
  if (!board) return;
  board.columns = board.columns || [];
  board.columns.push({ id: uid(), name, cards: [] });
  saveState();
  renderBoard(board);
}

function deleteColumn(colId) {
  const board = getActiveBoard();
  if (!board) return;
  const col = getColumn(board, colId);
  if (col && col.cards?.length > 0) {
    if (!confirm(`Delete column "${col.name}" and all its ${col.cards.length} card(s)?`)) return;
  }
  board.columns = board.columns.filter(c => c.id !== colId);
  saveState();
  renderBoard(board);
}

function renameColumn(colId, newName) {
  const board = getActiveBoard();
  if (!board) return;
  const col = getColumn(board, colId);
  if (!col) return;
  col.name = newName;
  saveState();
  renderBoard(board);
}

// ── Members ──────────────────────────────────
function renderMembersModal() {
  const board = getActiveBoard();
  if (!board) return;
  const list = el('members-list');
  const members = board.members || [];
  if (!members.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">No members yet.</div>';
    return;
  }
  list.innerHTML = members.map(m => `
    <div class="member-row" data-member-id="${m.id}">
      <div class="user-avatar" style="background:${m.color}">${avatarInitials(m.name)}</div>
      <div class="member-info">
        <div class="member-name">${escapeHtml(m.name)}</div>
        <div class="member-email">${escapeHtml(m.email || '')}</div>
      </div>
      <button class="member-remove" data-member-id="${m.id}" title="Remove">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.member-remove').forEach(btn => {
    btn.addEventListener('click', () => removeMember(btn.dataset.memberId));
  });
}

function addMember(name, email) {
  const board = getActiveBoard();
  if (!board) return;
  board.members = board.members || [];
  if (board.members.some(m => m.email === email && email)) {
    showToast('Member with that email already exists', 'warning'); return;
  }
  const color = AVATAR_COLORS[board.members.length % AVATAR_COLORS.length];
  board.members.push({ id: uid(), name, email, color });
  saveState();
  renderMembersModal();
  renderTopbar(board);
  showToast(`${name} added to the board`, 'success');
  el('new-member-name').value = '';
  el('new-member-email').value = '';
}

function removeMember(memberId) {
  const board = getActiveBoard();
  if (!board) return;
  board.members = (board.members || []).filter(m => m.id !== memberId);
  // Also remove from cards
  board.columns?.forEach(col => {
    col.cards?.forEach(card => {
      card.assignees = (card.assignees || []).filter(id => id !== memberId);
    });
  });
  saveState();
  renderMembersModal();
  renderTopbar(board);
  renderBoard(board);
}

// ── Auto-resize textarea ─────────────────────
function autoResize(el_) {
  el_.style.height = 'auto';
  el_.style.height = el_.scrollHeight + 'px';
}

// ── Escape HTML ──────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Close notif panel ────────────────────────
function closeNotifPanel() {
  el('notif-panel').classList.add('hidden');
}

// ── Init Color Grid ──────────────────────────
function initColorGrid() {
  const grid = el('board-color-grid');
  let selectedColor = BOARD_COLORS[0].value;
  grid.innerHTML = BOARD_COLORS.map((c, i) => `
    <div class="color-swatch ${i === 0 ? 'selected' : ''}"
         style="background:${c.value}"
         data-color="${c.value}"
         title="${c.name}"></div>
  `).join('');
  grid.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      grid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.dataset.color;
    });
  });
  // Store selected via closure
  el('btn-save-board').addEventListener('click', () => {
    const name = el('new-board-name').value.trim();
    if (!name) { el('new-board-name').focus(); return; }
    const sel = grid.querySelector('.color-swatch.selected');
    createBoard(name, sel ? sel.dataset.color : BOARD_COLORS[0].value);
    closeModal('create-board-modal');
    el('new-board-name').value = '';
  });
}

// ── Event Bindings ───────────────────────────
function bindEvents() {
  // Sidebar new board
  el('btn-create-board').addEventListener('click', () => {
    openModal('create-board-modal');
    setTimeout(() => el('new-board-name').focus(), 50);
  });

  // Empty state new board
  document.addEventListener('click', e => {
    if (e.target.id === 'btn-empty-create') {
      openModal('create-board-modal');
      setTimeout(() => el('new-board-name').focus(), 50);
    }
  });

  // Board name input Enter
  el('new-board-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') el('btn-save-board').click();
  });

  // Add Column
  el('btn-save-column').addEventListener('click', () => {
    const name = el('new-column-name').value.trim();
    if (!name) { el('new-column-name').focus(); return; }
    addColumn(name);
    closeModal('add-column-modal');
    el('new-column-name').value = '';
  });
  el('new-column-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') el('btn-save-column').click();
  });

  // Context menu
  el('ctx-rename').addEventListener('click', () => {
    if (!activeContextColumnId) return;
    const board = getActiveBoard();
    const col = getColumn(board, activeContextColumnId);
    if (col) {
      el('rename-column-input').value = col.name;
      openModal('rename-column-modal');
      setTimeout(() => el('rename-column-input').select(), 50);
    }
    el('context-menu').classList.add('hidden');
  });
  el('ctx-delete').addEventListener('click', () => {
    if (activeContextColumnId) deleteColumn(activeContextColumnId);
    el('context-menu').classList.add('hidden');
  });
  el('btn-confirm-rename').addEventListener('click', () => {
    const name = el('rename-column-input').value.trim();
    if (!name || !activeContextColumnId) return;
    renameColumn(activeContextColumnId, name);
    closeModal('rename-column-modal');
  });
  el('rename-column-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') el('btn-confirm-rename').click();
  });

  // Members modal
  el('btn-manage-members').addEventListener('click', () => {
    renderMembersModal();
    openModal('members-modal');
  });
  el('btn-add-member').addEventListener('click', () => {
    const name  = el('new-member-name').value.trim();
    const email = el('new-member-email').value.trim();
    if (!name) { el('new-member-name').focus(); return; }
    addMember(name, email);
  });
  el('new-member-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') el('new-member-email').focus();
  });
  el('new-member-email').addEventListener('keydown', e => {
    if (e.key === 'Enter') el('btn-add-member').click();
  });

  // Notification panel
  el('btn-notif').addEventListener('click', e => {
    e.stopPropagation();
    el('notif-panel').classList.toggle('hidden');
  });
  el('btn-clear-notifs').addEventListener('click', () => {
    notifications = [];
    saveNotifs();
    renderNotifBadge();
    renderNotifPanel();
  });

  // Card modal: title save
  el('card-modal-title').addEventListener('input', function() {
    autoResize(this);
    const board = getBoard(openCardBoardId);
    if (!board) return;
    const result = getCard(board, openCardId);
    if (!result) return;
    result.card.title = this.value;
    saveState();
    renderBoard(board);
  });

  // Card modal: description
  el('card-description').addEventListener('input', function() {
    const board = getBoard(openCardBoardId);
    if (!board) return;
    const result = getCard(board, openCardId);
    if (!result) return;
    result.card.description = this.value;
    saveState();
  });
  el('card-description').addEventListener('blur', () => {
    const board = getBoard(openCardBoardId);
    if (board) renderBoard(board);
  });

  // Card modal: due date
  el('card-due-date').addEventListener('change', function() {
    const board = getBoard(openCardBoardId);
    if (!board) return;
    const result = getCard(board, openCardId);
    if (!result) return;
    result.card.dueDate = this.value ? new Date(this.value).toISOString() : null;
    // Reset alert flags when due date is changed
    delete result.card['alerted24_' + openCardId];
    delete result.card['alertedOD_' + openCardId];
    saveState();
    renderBoard(board);
    showToast('Due date set', 'success');
  });
  el('btn-clear-due').addEventListener('click', () => {
    const board = getBoard(openCardBoardId);
    if (!board) return;
    const result = getCard(board, openCardId);
    if (!result) return;
    result.card.dueDate = null;
    el('card-due-date').value = '';
    saveState();
    renderBoard(board);
    showToast('Due date cleared', 'info');
  });

  // Card modal: complete toggle
  el('btn-toggle-complete').addEventListener('click', () => {
    if (!openCardId) return;
    toggleCardComplete(openCardId);
  });

  // Card modal: delete
  el('btn-delete-card').addEventListener('click', () => {
    if (!openCardId) return;
    if (confirm('Delete this card permanently?')) {
      deleteCard(openCardId);
    }
  });

  // File upload
  el('file-upload-input').addEventListener('change', function() {
    const files = [...this.files];
    if (!files.length) return;
    const board = getBoard(openCardBoardId);
    if (!board) return;
    const result = getCard(board, openCardId);
    if (!result) return;
    const { card } = result;
    card.attachments = card.attachments || [];

    let processed = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const att = {
          id: uid(),
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: e.target.result,
          addedAt: new Date().toISOString(),
        };
        card.attachments.push(att);
        processed++;
        if (processed === files.length) {
          saveState();
          renderAttachments(card);
          renderBoard(board);
          showToast(`${files.length} file(s) attached`, 'success');
        }
      };
      reader.readAsDataURL(file);
    });
    this.value = ''; // reset input
  });

  // Post comment
  el('btn-post-comment').addEventListener('click', postComment);
  el('comment-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      postComment();
    }
  });

  // Close card modal — save
  el('card-modal').addEventListener('click', e => {
    if (e.target === el('card-modal')) {
      // clicking overlay inside the modal flex layout — do nothing
    }
  });
}

function postComment() {
  const input = el('comment-input');
  const text = input.value.trim();
  if (!text) return;
  const board = getBoard(openCardBoardId);
  if (!board) return;
  const result = getCard(board, openCardId);
  if (!result) return;
  const { card } = result;
  card.comments = card.comments || [];
  const comment = {
    id: uid(),
    author: 'Me',
    authorInitials: 'ME',
    avatarColor: '#6366f1',
    text,
    createdAt: new Date().toISOString(),
  };
  card.comments.push(comment);
  saveState();
  renderComments(card);
  renderBoard(board);
  input.value = '';
  input.style.height = '';
}

// ── Bootstrap ────────────────────────────────
function init() {
  loadState();
  loadNotifs();
  initColorGrid();
  bindEvents();

  // Auto-resize card title textarea
  el('card-modal-title').addEventListener('input', function() { autoResize(this); });
  el('comment-input').addEventListener('input', function() { autoResize(this); });

  // Render initial
  renderAll();
  renderNotifBadge();
  renderNotifPanel();

  // Due date checker
  checkDueDates();
  setInterval(checkDueDates, CHECK_INTERVAL_MS);

  // Kick off with demo board if empty
  if (!state.boards.length) {
    createBoard('My First Board', '#6366f1');
    const board = getActiveBoard();
    if (board) {
      const todo = board.columns[0];
      const inProg = board.columns[1];
      const done = board.columns[3];

      const card1 = {
        id: uid(), title: 'Design new landing page 🎨',
        description: 'Redesign the marketing landing page with the new brand guidelines.',
        comments: [], attachments: [], labels: ['design', 'frontend'],
        assignees: [], dueDate: null, completed: false,
        completedAt: null, createdAt: new Date().toISOString(),
      };
      const card2 = {
        id: uid(), title: 'API integration for auth module 🔐',
        description: 'Integrate the new JWT-based authentication endpoints.',
        comments: [{ id: uid(), author: 'Me', authorInitials: 'ME', avatarColor: '#6366f1', text: 'Need to check the token refresh flow.', createdAt: new Date().toISOString() }],
        attachments: [], labels: ['backend', 'feature'],
        assignees: [], dueDate: new Date(Date.now() + 3600000 * 4).toISOString(),
        completed: false, completedAt: null, createdAt: new Date().toISOString(),
      };
      const card3 = {
        id: uid(), title: 'Fix responsive layout bugs',
        description: '', comments: [], attachments: [],
        labels: ['bug', 'frontend'], assignees: [], dueDate: null,
        completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      };
      todo.cards.push(card1);
      inProg.cards.push(card2);
      done.cards.push(card3);

      // Demo members
      board.members = [
        { id: uid(), name: 'Alex Carter',   email: 'alex@worklane.io',   color: '#6366f1' },
        { id: uid(), name: 'Sam Rivera',    email: 'sam@worklane.io',    color: '#10b981' },
        { id: uid(), name: 'Jordan Lee',    email: 'jordan@worklane.io', color: '#f97316' },
      ];

      saveState();
      renderAll();
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
