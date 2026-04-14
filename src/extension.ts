import * as vscode from "vscode";
import { StorageManager, Note } from "./store-manager";

export function activate(context: vscode.ExtensionContext) {
  const storageUri = context.storageUri ?? context.globalStorageUri;
  const storage = new StorageManager(storageUri);

  context.subscriptions.push(
    vscode.commands.registerCommand("tote.open", async () => {
      let notes = await storage.load();

      const panel = vscode.window.createWebviewPanel(
        "tote",
        "Tote",
        vscode.ViewColumn.Beside,
        { enableScripts: true },
      );

      panel.webview.html = getWebviewContent(notes);

      panel.webview.onDidReceiveMessage(async (msg) => {
        let lastAdded: string | undefined;
        switch (msg.type) {
          case "add": {
            const result = await storage.addNote(notes, msg.note);
            notes = result.notes;
            lastAdded = result.id;
            break;
          }
          case "update":
            notes = await storage.updateNote(notes, msg.id, msg.changes);
            break;
          case "delete":
            notes = await storage.deleteNote(notes, msg.id);
            break;
        }
        panel.webview.postMessage({ type: "sync", notes, lastAdded });
      });
    }),
  );
}

function getWebviewContent(notes: Note[]): string {
  const data = JSON.stringify(notes);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-foreground);
      --border: var(--vscode-panel-border);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --accent: var(--vscode-focusBorder);
      --muted: var(--vscode-descriptionForeground);
      --tag-bg: var(--vscode-badge-background);
      --tag-fg: var(--vscode-badge-foreground);
      --tree-indent: 20px;
    }

    body {
      font-family: 'IBM Plex Sans', var(--vscode-font-family), sans-serif;
      font-size: 13px;
      color: var(--fg);
      background: var(--bg);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Top bar ── */
    #topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    #topbar h1 {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: -0.3px;
      flex-shrink: 0;
    }

    #search-wrap {
      flex: 1;
      position: relative;
    }

    #search {
      width: 100%;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      padding: 5px 10px 5px 28px;
      font-family: inherit;
      font-size: 12px;
      outline: none;
    }

    #search:focus { border-color: var(--accent); }

    .search-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0.5;
      pointer-events: none;
      font-size: 12px;
    }

    .add-btn {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .add-btn:hover { background: var(--btn-hover); }

    /* ── Layout: sidebar + main ── */
    #layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ── Tree sidebar ── */
    #sidebar {
      width: 200px;
      min-width: 140px;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      flex-shrink: 0;
      padding: 8px 0;
    }

    .tree-folder {
      user-select: none;
    }

    .tree-folder-label {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--muted);
      cursor: pointer;
    }

    .tree-folder-label:hover { color: var(--fg); }

    .folder-arrow {
      font-size: 9px;
      transition: transform 0.15s;
      display: inline-block;
    }

    .folder-arrow.open { transform: rotate(90deg); }

    .tree-items { padding-left: 0; }

    .tree-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px 5px calc(10px + var(--tree-indent));
      cursor: pointer;
      border-left: 2px solid transparent;
      font-size: 12px;
      overflow: hidden;
    }

    .tree-item:hover { background: var(--vscode-list-hoverBackground); }

    .tree-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
      border-left-color: var(--accent);
    }

    .tree-item-icon { flex-shrink: 0; font-size: 11px; opacity: 0.7; }

    .tree-item-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    /* ── Main note area ── */
    #main {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    /* empty state */
    #empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--muted);
      gap: 8px;
      font-size: 12px;
    }

    #empty-state .big { font-size: 28px; }

    /* ── Note card ── */
    .note-card {
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: hidden;
      transition: border-color 0.15s;
    }

    .note-card:focus-within { border-color: var(--accent); }

    .note-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--vscode-sideBar-background, var(--input-bg));
    }

    .note-type-badge {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      background: var(--tag-bg);
      color: var(--tag-fg);
      padding: 1px 6px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .note-title-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--fg);
      font-family: 'IBM Plex Sans', inherit;
      font-size: 13px;
      font-weight: 600;
      outline: none;
      min-width: 0;
    }

    .note-title-input::placeholder { color: var(--muted); }

    .note-meta {
      font-size: 10px;
      color: var(--muted);
      flex-shrink: 0;
      font-family: 'IBM Plex Mono', monospace;
    }

    .delete-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 13px;
      line-height: 1;
      flex-shrink: 0;
    }

    .delete-btn:hover { color: var(--vscode-errorForeground); background: var(--vscode-inputValidation-errorBackground); }

    .note-body { padding: 10px; }

    /* text note textarea */
    .note-textarea {
      width: 100%;
      background: transparent;
      color: var(--input-fg);
      border: none;
      padding: 0;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      resize: vertical;
      outline: none;
      line-height: 1.6;
      min-height: 80px;
    }

    /* checklist */
    .checklist-list { display: flex; flex-direction: column; gap: 4px; }

    .checklist-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checklist-row input[type=checkbox] {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }

    .checklist-row .item-text {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 1px solid transparent;
      color: var(--input-fg);
      font-family: 'IBM Plex Sans', inherit;
      font-size: 12px;
      padding: 2px 0;
      outline: none;
      transition: border-color 0.15s;
    }

    .checklist-row .item-text:focus { border-bottom-color: var(--accent); }

    .checklist-row .item-text.done {
      text-decoration: line-through;
      opacity: 0.45;
    }

    .checklist-row .remove-item {
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 12px;
      padding: 0 2px;
      opacity: 0;
      transition: opacity 0.1s;
    }

    .checklist-row:hover .remove-item { opacity: 1; }
    .remove-item:hover { color: var(--vscode-errorForeground) !important; }

    .add-item-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 11px;
      padding: 4px 0;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: inherit;
    }

    .add-item-btn:hover { color: var(--fg); }

    /* search highlight */
    mark {
      background: var(--vscode-editor-findMatchHighlightBackground, #ff0);
      color: inherit;
      border-radius: 2px;
    }

    /* scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
  </style>
</head>
<body>

<div id="topbar">
  <h1>Tote</h1>
  <div id="search-wrap">
    <span class="search-icon">⌕</span>
    <input id="search" type="text" placeholder="Search notes…" oninput="onSearch(this.value)">
  </div>
  <button class="add-btn" onclick="addText()">＋ Text</button>
  <button class="add-btn" onclick="addChecklist()">＋ List</button>
</div>

<div id="layout">
  <nav id="sidebar"></nav>
  <div id="main"></div>
</div>

<script>
  const vscode = acquireVsCodeApi();
  let notes = ${data};
  let activeId = notes.length ? notes[0].id : null;
  let searchQuery = '';
  let collapsed = {}; // folder collapse state by type

  // ── Helpers ──────────────────────────────────────────────────────────────

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function escapeRe(s) {
    // Split the special-char string so that dollar+brace never appears as a
    // literal sequence inside this TypeScript template literal.
    var specials = new RegExp('[.*+?^$' + '{}()|[\\]\\\\]', 'g');
    return s.replace(specials, '\\$&');
  }

  function highlight(str) {
    if (!searchQuery) return esc(str);
    const escaped = esc(str);
    const pattern = escapeRe(searchQuery);
    const re = new RegExp(pattern, 'gi');
    return escaped.replace(re, function(m) { return '<mark>' + m + '</mark>'; });
  }

  function visibleNotes() {
    if (!searchQuery) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => {
      if (n.title.toLowerCase().includes(q)) return true;
      if (n.type === 'text') return (n.content ?? '').toLowerCase().includes(q);
      if (n.type === 'checklist') return (n.items ?? []).some(i => i.text.toLowerCase().includes(q));
      return false;
    });
  }

  // ── Sidebar tree ─────────────────────────────────────────────────────────

  function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    const visible = visibleNotes();
    const byType = { text: [], checklist: [] };
    visible.forEach(n => byType[n.type].push(n));

    const folders = [
      { key: 'text',      label: 'Text Notes',  icon: '📄' },
      { key: 'checklist', label: 'Checklists',   icon: '☑' },
    ];

    sidebar.innerHTML = folders.map(f => {
      const items = byType[f.key];
      if (items.length === 0 && searchQuery) return '';
      const open = !collapsed[f.key];
      const rows = items.map(n => {
        const active = n.id === activeId ? ' active' : '';
        return \`<div class="tree-item\${active}" onclick="setActive('\${esc(n.id)}')" title="\${esc(n.title)}">
          <span class="tree-item-icon">\${f.icon}</span>
          <span class="tree-item-label">\${highlight(n.title)}</span>
        </div>\`;
      }).join('');
      return \`
        <div class="tree-folder">
          <div class="tree-folder-label" onclick="toggleFolder('\${f.key}')">
            <span class="folder-arrow \${open ? 'open' : ''}">\u25B6</span>
            \${f.label}
            <span style="margin-left:auto;font-size:10px;opacity:0.6">\${items.length}</span>
          </div>
          \${open ? \`<div class="tree-items">\${rows}</div>\` : ''}
        </div>\`;
    }).join('');
  }

  function toggleFolder(key) {
    collapsed[key] = !collapsed[key];
    render();
  }

  function setActive(id) {
    activeId = id;
    render();
    // scroll card into view
    setTimeout(() => {
      const el = document.getElementById('card-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // ── Main area ─────────────────────────────────────────────────────────────

  function renderMain() {
    const main = document.getElementById('main');
    const visible = visibleNotes();

    if (visible.length === 0) {
      main.innerHTML = \`
        <div id="empty-state">
          <div class="big">📭</div>
          <div>\${searchQuery ? 'No notes match "' + esc(searchQuery) + '"' : 'No notes yet — add one above'}</div>
        </div>\`;
      return;
    }

    main.innerHTML = visible.map(n => renderCard(n)).join('');

    // Restore textarea values (innerHTML strips them on re-render)
    visible.forEach(n => {
      if (n.type === 'text') {
        const ta = document.getElementById('ta-' + n.id);
        if (ta) ta.value = n.content ?? '';
      }
    });
  }

  function renderCard(note) {
    const active = note.id === activeId ? ' style="border-color:var(--accent)"' : '';
    const header = \`
      <div class="note-header">
        <span class="note-type-badge">\${note.type === 'text' ? 'TXT' : 'LIST'}</span>
        <input class="note-title-input"
               value="\${esc(note.title)}"
               placeholder="Untitled"
               onchange="updateTitle('\${esc(note.id)}', this.value)"
               title="Click to rename">
        <span class="note-meta">\${fmtDate(note.updatedAt)}</span>
        <button class="delete-btn" onclick="deleteNote('\${esc(note.id)}')" title="Delete note">✕</button>
      </div>\`;

    let body = '';
    if (note.type === 'text') {
      // Use textarea without innerHTML to avoid escaping issues
      body = \`<div class="note-body">
        <textarea id="ta-\${esc(note.id)}" class="note-textarea" rows="6"
          oninput="scheduleUpdate('\${esc(note.id)}', this.value)"
          placeholder="Start writing…"></textarea>
      </div>\`;
    } else {
      const items = (note.items ?? []).map((item, j) => \`
        <div class="checklist-row" id="row-\${esc(note.id)}-\${j}">
          <input type="checkbox" \${item.checked ? 'checked' : ''}
                 onchange="toggleItem('\${esc(note.id)}', \${j}, this.checked)">
          <input type="text" class="item-text \${item.checked ? 'done' : ''}"
                 value="\${esc(item.text)}"
                 placeholder="Item…"
                 oninput="scheduleItemUpdate('\${esc(note.id)}', \${j}, this.value)"
                 onkeydown="itemKeydown(event, '\${esc(note.id)}', \${j})">
          <button class="remove-item" onclick="removeItem('\${esc(note.id)}', \${j})" title="Remove">✕</button>
        </div>
      \`).join('');
      body = \`<div class="note-body">
        <div class="checklist-list">\${items}</div>
        <button class="add-item-btn" onclick="addItem('\${esc(note.id)}')">＋ add item</button>
      </div>\`;
    }

    return \`<div class="note-card" id="card-\${esc(note.id)}"\${active}>\${header}\${body}</div>\`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render() {
    renderSidebar();
    renderMain();
  }

  // ── Search ────────────────────────────────────────────────────────────────

  function onSearch(val) {
    searchQuery = val.trim();
    // if active note is filtered out, reset
    if (searchQuery && activeId && !visibleNotes().find(n => n.id === activeId)) {
      const v = visibleNotes();
      activeId = v.length ? v[0].id : null;
    }
    render();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function addText() {
    vscode.postMessage({ type: 'add', note: { title: 'Note', type: 'text', content: '' } });
  }

  function addChecklist() {
    vscode.postMessage({ type: 'add', note: { title: 'Checklist', type: 'checklist', items: [{ text: '', checked: false }] } });
  }

  function deleteNote(id) {
    vscode.postMessage({ type: 'delete', id });
    // If we deleted the active note, select next
    if (activeId === id) {
      const idx = notes.findIndex(n => n.id === id);
      const next = notes[idx + 1] ?? notes[idx - 1];
      activeId = next ? next.id : null;
    }
  }

  function updateTitle(id, title) {
    vscode.postMessage({ type: 'update', id, changes: { title } });
  }

  // Debounced content save so every keystroke doesn't hammer the filesystem
  const pendingUpdates = {};
  function scheduleUpdate(id, content) {
    clearTimeout(pendingUpdates[id]);
    pendingUpdates[id] = setTimeout(() => {
      vscode.postMessage({ type: 'update', id, changes: { content } });
    }, 400);
  }

  function toggleItem(id, j, checked) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const items = note.items.map((item, i) => i === j ? { ...item, checked } : item);
    vscode.postMessage({ type: 'update', id, changes: { items } });
    // Update class immediately for responsiveness
    const input = document.querySelector(\`#row-\${id}-\${j} .item-text\`);
    if (input) input.classList.toggle('done', checked);
  }

  const pendingItemUpdates = {};
  function scheduleItemUpdate(id, j, text) {
    const key = id + ':' + j;
    clearTimeout(pendingItemUpdates[key]);
    pendingItemUpdates[key] = setTimeout(() => {
      const note = notes.find(n => n.id === id);
      if (!note) return;
      const items = note.items.map((item, i) => i === j ? { ...item, text } : item);
      vscode.postMessage({ type: 'update', id, changes: { items } });
    }, 400);
  }

  function addItem(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const items = [...(note.items ?? []), { text: '', checked: false }];
    vscode.postMessage({ type: 'update', id, changes: { items } });
  }

  function removeItem(id, j) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const items = note.items.filter((_, i) => i !== j);
    vscode.postMessage({ type: 'update', id, changes: { items } });
  }

  function itemKeydown(e, id, j) {
    if (e.key === 'Enter') { e.preventDefault(); addItem(id); }
    if (e.key === 'Backspace' && e.target.value === '') {
      e.preventDefault();
      removeItem(id, j);
    }
  }

  // ── Sync from host ────────────────────────────────────────────────────────

  window.addEventListener('message', (event) => {
    if (event.data.type === 'sync') {
      // Preserve textarea focus & cursor
      const focused = document.activeElement;
      const focusedId = focused?.id;
      const cursorPos = focused?.selectionStart;

      notes = event.data.notes;

      // If we just added, select the newest
      if (event.data.lastAdded) activeId = event.data.lastAdded;

      render();

      // Restore focus
      if (focusedId) {
        const el = document.getElementById(focusedId);
        if (el) {
          el.focus();
          if (cursorPos != null && el.setSelectionRange) el.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────
  render();
</script>
</body>
</html>`;
}
