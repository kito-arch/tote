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
        let updatedId: string | undefined;
        switch (msg.type) {
          case "add": {
            const result = await storage.addNote(notes, msg.note);
            notes = result.notes;
            lastAdded = result.id;
            break;
          }
          case "update":
            notes = await storage.updateNote(notes, msg.id, msg.changes);
            updatedId = msg.id;
            break;
          case "delete":
            notes = await storage.deleteNote(notes, msg.id);
            break;
        }
        panel.webview.postMessage({
          type: "sync",
          notes,
          lastAdded,
          updatedId,
        });
      });
    }),
  );
}

function getWebviewContent(notes: Note[]): string {
  const data = JSON.stringify(notes);
  return buildWebviewHtml(data);
}

function buildWebviewHtml(data: string): string {
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

    /* ── Sidebar toggle btn ── */
    #sidebar-toggle {
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 14px;
      padding: 2px 4px;
      border-radius: 3px;
      line-height: 1;
      flex-shrink: 0;
    }
    #sidebar-toggle:hover { color: var(--fg); background: var(--vscode-toolbar-hoverBackground); }

    /* ── Tree sidebar ── */
    #sidebar {
      width: 120px;
      min-width: 120px;
      border-right: 1px solid var(--border);
      overflow-y: auto;
      flex-shrink: 0;
      padding: 8px 0;
      transition: width 0.2s ease;
    }

    #sidebar.hidden {
      width: 0 !important;
      min-width: 0 !important;
      overflow: hidden;
      border-right: none;
      padding: 0;
    }

    #resizer.sidebar-hidden { display: none; }

    /* ── Resize handle ── */
    #resizer {
      width: 4px;
      flex-shrink: 0;
      cursor: col-resize;
      background: transparent;
      transition: background 0.15s;
      position: relative;
      z-index: 10;
    }

    #resizer:hover,
    #resizer.dragging { background: var(--accent); }

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

    .tree-item.note-hidden { opacity: 0.45; font-style: italic; }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }

    .minimize-btn {
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 13px;
      padding: 2px 5px;
      border-radius: 3px;
      line-height: 1;
      flex-shrink: 0;
    }
    .minimize-btn:hover { color: var(--fg); background: var(--vscode-toolbar-hoverBackground); }

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
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 12px;
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
  <div id="resizer"></div>
  <div id="main"></div>
</div>

<script>
  const vscode = acquireVsCodeApi();
  let notes = ${data};
  let activeId = notes.length ? notes[0].id : null;
  let searchQuery = '';
  let collapsed = {}; // folder collapse state by type
  let hiddenNotes = new Set(); // note ids removed from main view
  let sidebarHidden = false;   // whether sidebar is manually hidden
  let sidebarWasAutoShown = false; // true when sidebar shown only because of search

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
    var specials = new RegExp('[.*+?^$' + '{}()|[\\]\]', 'g');
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
    const resizer = document.getElementById('resizer');
    // Show sidebar if searching, even if manually hidden
    const shouldShow = !sidebarHidden || searchQuery;
    sidebar.classList.toggle('hidden', !shouldShow);
    resizer.classList.toggle('sidebar-hidden', !shouldShow);
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
        const hidden = hiddenNotes.has(n.id) ? ' note-hidden' : '';
        return \`<div class=\"tree-item\${active}\${hidden}\" onclick=\"openFromSidebar('\${esc(n.id)}')\" title=\"\${esc(n.title)}\">\n          <span class=\"tree-item-icon\">\${f.icon}</span>\n          <span class=\"tree-item-label\">\${highlight(n.title)}</span>\n        </div>\`;
      }).join('');
      return \`\n        <div class=\"tree-folder\">\n          <div class=\"tree-folder-label\" onclick=\"toggleFolder('\${f.key}')\">\n            <span class=\"folder-arrow \${open ? 'open' : ''}\">\u25B6</span>\n            \${f.label}\n            <span style=\"margin-left:auto;font-size:10px;opacity:0.6\">\${items.length}</span>\n          </div>\n          \${open ? \`<div class=\"tree-items\">\${rows}</div>\` : ''}\n        </div>\`;
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

  function openFromSidebar(id) {
    // If note is hidden, restore it to the main view then scroll to it
    hiddenNotes.delete(id);
    setActive(id);
  }

  function hideNote(id) {
    hiddenNotes.add(id);
    // If this was the active note, move focus to next visible
    if (activeId === id) {
      const shown = notes.filter(n => !hiddenNotes.has(n.id));
      activeId = shown.length ? shown[0].id : null;
    }
    render();
  }

  function toggleSidebar() {
    sidebarHidden = !sidebarHidden;
    render();
  }

  // ── Main area ─────────────────────────────────────────────────────────────

  function renderMain() {
    const main = document.getElementById('main');
    const visible = visibleNotes();

    if (visible.length === 0) {
      main.innerHTML = \`\n        <div id=\"empty-state\">\n          <div class=\"big\">📭</div>\n          <div>\${searchQuery ? 'No notes match "' + esc(searchQuery) + '"' : 'No notes yet — add one above'}</div>\n        </div>\`;
      return;
    }

    const shown = visible.filter(n => !hiddenNotes.has(n.id));
    main.innerHTML = shown.map(n => renderCard(n)).join('');

    // Restore textarea values (innerHTML strips them on re-render)
    shown.forEach(n => {
      if (n.type === 'text') {
        const ta = document.getElementById('ta-' + n.id);
        if (ta) ta.value = n.content ?? '';
      }
    });
  }

  function renderCard(note) {
    const active = note.id === activeId ? ' style=\"border-color:var(--accent)\"' : '';
    const header = \`\n      <div class=\"note-header\">\n        <span class=\"note-type-badge\">\${note.type === 'text' ? 'TXT' : 'LIST'}</span>\n        <input class=\"note-title-input\"\n               value=\"\${esc(note.title)}\"\n               placeholder=\"Untitled\"\n               onchange=\"updateTitle('\${esc(note.id)}', this.value)\"\n               title=\"Click to rename\">\n        <span class=\"note-meta\">\${fmtDate(note.updatedAt)}</span>\n        <div class=\"header-actions\">\n          <button class=\"minimize-btn\" onclick=\"hideNote('\${esc(note.id)}')\" title=\"Hide from view (reopen from sidebar)\">&#8212;</button>\n          <button class=\"delete-btn\" onclick=\"deleteNote('\${esc(note.id)}')\" title=\"Delete note permanently\">&#128465;</button>\n        </div>\n      </div>\`;

    let body = '';
    if (note.type === 'text') {
      // Use textarea without innerHTML to avoid escaping issues
      body = \`<div class=\"note-body\">\n        <textarea id=\"ta-\${esc(note.id)}\" class=\"note-textarea\" rows=\"6\"\n          oninput=\"scheduleUpdate('\${esc(note.id)}', this.value)\"\n          placeholder=\"Start writing…\"></textarea>\n      </div>\`;
    } else {
      const items = (note.items ?? []).map((item, j) => \`\n        <div class=\"checklist-row\" id=\"row-\${esc(note.id)}-\${j}\">\n          <input type=\"checkbox\" \${item.checked ? 'checked' : ''}\n                 onchange=\"toggleItem('\${esc(note.id)}', \${j}, this.checked)\">\n          <input type=\"text\" class=\"item-text \${item.checked ? 'done' : ''}\"\n                 value=\"\${esc(item.text)}\"\n                 placeholder=\"Item…\"\n                 oninput=\"scheduleItemUpdate('\${esc(note.id)}', \${j}, this.value)\"\n                 onkeydown=\"itemKeydown(event, '\${esc(note.id)}', \${j})\">\n          <button class=\"remove-item\" onclick=\"removeItem('\${esc(note.id)}', \${j})\" title=\"Remove\">✕</button>\n        </div>\n      \`).join('');
      body = \`<div class=\"note-body\">\n        <div class=\"checklist-list\">\${items}</div>\n        <button class=\"add-item-btn\" onclick=\"addItem('\${esc(note.id)}')\">＋ add item</button>\n      </div>\`;
    }

    return \`<div class=\"note-card\" id=\"card-\${esc(note.id)}\"\${active}>\${header}\${body}</div>\`;
  }

  // ── Render ───────────────────────────────────────────────────────────────-

  function render() {
    renderSidebar();
    console.debug && console.debug('[tote] render', { activeId, searchQuery, notesCount: notes.length });
    renderMain();
  }

  // ── Search ───────────────────────────────────────────────────────────────-

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
    // Optimistically update local state so incoming syncs match what the
    // user typed and we can skip a full re-render when the host echoes us.
    const note = notes.find(n => n.id === id);
    if (note) note.content = content;

    clearTimeout(pendingUpdates[id]);
    pendingUpdates[id] = setTimeout(() => {
      try { console.debug && console.debug('[tote] sending update', { id, type: 'content' }); } catch (e) {}
      // If the textarea is still focused, defer sending until blur to avoid
      // the host echoing back a sync while the user is typing (which can
      // cause a visible blur). Attach a one-time blur handler instead.
      const ta = document.getElementById('ta-' + id);
      if (ta && document.activeElement === ta) {
        if (!ta.__toteBlurBound) {
          const onBlur = () => {
            try { console.debug && console.debug('[tote] sending update on blur', { id, type: 'content' }); } catch (e) {}
            ta.removeEventListener('blur', onBlur);
            ta.__toteBlurBound = false;
            vscode.postMessage({ type: 'update', id, changes: { content } });
          };
          ta.__toteBlurBound = true;
          ta.addEventListener('blur', onBlur);
        }
        return;
      }

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
    // Update local notes immediately so the UI reflects edits optimistically
    const local = notes.find(n => n.id === id);
    if (local) {
      local.items = (local.items ?? []).map((it, i) => i === j ? { ...it, text } : it);
    }

    const key = id + ':' + j;
    clearTimeout(pendingItemUpdates[key]);
    pendingItemUpdates[key] = setTimeout(() => {
      try { console.debug && console.debug('[tote] sending update', { id, index: j, type: 'item' }); } catch (e) {}
      // If the checklist input is still focused, defer sending until blur
      // to avoid the host echoing back a sync while the user is typing.
      const rowEl = document.getElementById('row-' + id + '-' + j);
      const inputEl = rowEl ? rowEl.querySelector('.item-text') : null;
      if (inputEl && document.activeElement === inputEl) {
        if (!inputEl.__toteBlurBound) {
          const onBlur = () => {
            try { console.debug && console.debug('[tote] sending update on blur', { id, index: j, type: 'item' }); } catch (e) {}
            inputEl.removeEventListener('blur', onBlur);
            inputEl.__toteBlurBound = false;
            const note = notes.find(n => n.id === id);
            if (!note) return;
            const items = note.items.map((item, i) => i === j ? { ...item, text } : item);
            vscode.postMessage({ type: 'update', id, changes: { items } });
          };
          inputEl.__toteBlurBound = true;
          inputEl.addEventListener('blur', onBlur);
        }
        return;
      }

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

  // ── Sync from host ──────────────────────────────────────────────────────

  window.addEventListener('message', (event) => {
    if (event.data.type === 'sync') {
      // Preserve textarea focus & cursor
      const focused = document.activeElement;
      const focusedId = focused?.id;
      const cursorPos = focused?.selectionStart;
      const incoming = event.data.notes;
      try { console.debug && console.debug('[tote] sync received', event.data, { focusedId, focusedTag: focused?.tagName }); } catch (e) {}

      // If the host is echoing back an update we just sent, and the
      // focused element belongs to that note, skip a full re-render to
      // prevent a visible blur. 'updatedId' is set by the extension when it
      // responds to our own 'update' message.
      const updatedId = event.data.updatedId;
      if (updatedId && focused) {
        let focusedNoteId = null;
        if (focused.tagName === 'INPUT' && focused.classList && focused.classList.contains('item-text')) {
          const row = focused.closest ? focused.closest('.checklist-row') : (focused.parentElement || null);
          if (row && row.id) {
            const m = row.id.match(/^row-(.+)-(\d+)$/);
            if (m) focusedNoteId = m[1];
          }
        } else if (focused.tagName === 'INPUT' && focused.classList && focused.classList.contains('note-title-input')) {
          const card = focused.closest ? focused.closest('.note-card') : (focused.parentElement || null);
          if (card && card.id) {
            const m = card.id.match(/^card-(.+)$/);
            if (m) focusedNoteId = m[1];
          }
        } else if (focusedId && focusedId.startsWith && focusedId.startsWith('ta-')) {
          focusedNoteId = focusedId.slice(3);
        }
        if (focusedNoteId && updatedId === focusedNoteId) {
          notes = incoming;
          if (event.data.lastAdded) activeId = event.data.lastAdded;
          return;
        }
      }

      // If focused element is a checklist item input, attempt to avoid a
      // full re-render when the incoming content for that item matches the
      // focused value or the in-memory value. This prevents the input from
      // blurring/refocusing on every autosave.
      if (focused && focused.tagName === 'INPUT' && focused.classList && focused.classList.contains('item-text')) {
        const row = focused.closest ? focused.closest('.checklist-row') : (focused.parentElement || null);
        if (row && row.id) {
          const m = row.id.match(/^row-(.+)-(\d+)$/);
          if (m) {
            const noteId = m[1];
            const idx = parseInt(m[2], 10);
            const incomingNote = incoming.find(n => n.id === noteId);
            const localNote = notes.find(n => n.id === noteId);
            const focusedValue = focused.value ?? '';
            const incomingValue = (incomingNote && incomingNote.items && incomingNote.items[idx] && (incomingNote.items[idx].text ?? '')) || '';
            const localValue = (localNote && localNote.items && localNote.items[idx] && (localNote.items[idx].text ?? '')) || '';
            if (incomingNote && (incomingValue === focusedValue || incomingValue === localValue)) {
              notes = incoming;
              if (event.data.lastAdded) activeId = event.data.lastAdded;
              return;
            }
          }
        }
      }

      // If focused element is a note title input, similarly avoid re-render
      // when title hasn't actually changed on disk.
      if (focused && focused.tagName === 'INPUT' && focused.classList && focused.classList.contains('note-title-input')) {
        const card = focused.closest ? focused.closest('.note-card') : (focused.parentElement || null);
        if (card && card.id) {
          const m = card.id.match(/^card-(.+)$/);
          if (m) {
            const noteId = m[1];
            const incomingNote = incoming.find(n => n.id === noteId);
            const localNote = notes.find(n => n.id === noteId);
            const focusedValue = focused.value ?? '';
            const incomingTitle = incomingNote ? (incomingNote.title ?? '') : '';
            const localTitle = localNote ? (localNote.title ?? '') : '';
            if (incomingNote && (incomingTitle === focusedValue || incomingTitle === localTitle)) {
              notes = incoming;
              if (event.data.lastAdded) activeId = event.data.lastAdded;
              return;
            }
          }
        }
      }

      // If user is actively editing a text note, avoid a full re-render when
      // the incoming content matches what's already in the textarea or
      // matches the in-memory note. This prevents the textarea from
      // blurring/refocusing on every autosave.
      if (focusedId && focusedId.startsWith && focusedId.startsWith('ta-')) {
        const noteId = focusedId.slice(3);
        const incomingNote = incoming.find(n => n.id === noteId);
        const localNote = notes.find(n => n.id === noteId);
        const focusedValue = focused?.value ?? '';
        const incomingContent = (incomingNote && (incomingNote.content ?? '')) || '';
        const localContent = (localNote && (localNote.content ?? '')) || '';

        if (incomingNote && (incomingContent === focusedValue || incomingContent === localContent)) {
          // Update memory but skip DOM re-render to avoid blurring the textarea
          notes = incoming;
          if (event.data.lastAdded) activeId = event.data.lastAdded;
          return;
        }
      }

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

  // ── Sidebar resize ───────────────────────────────────────────────────────────
  (function() {
    var resizer  = document.getElementById('resizer');
    var sidebar  = document.getElementById('sidebar');
    var MIN_W = 140;
    var MAX_W = 400;
    var startX, startW;

    resizer.addEventListener('mousedown', function(e) {
      startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(e) {
        var newW = Math.min(MAX_W, Math.max(MIN_W, startW + (e.clientX - startX)));
        sidebar.style.width = newW + 'px';
      }

      function onUp() {
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  })();

  // ── Boot ──────────────────────────────────────────────────────────────────
  render();
</script>
</body>
</html>`;
}
