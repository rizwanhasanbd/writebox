/**
 * ============================================
 * WriteBox — Minimalist Writing App
 * ============================================
 * A distraction-free writing application with:
 *  - Multiple documents (CRUD)
 *  - Real-time auto-save to LocalStorage
 *  - Light / Dark theme with persistence
 *  - Word, character & reading-time stats
 *  - Import / Export .txt
 *  - Keyboard shortcuts
 *  - Offline-first (everything is local)
 */

(() => {
    'use strict';

    /* ---------- Constants ---------- */
    const STORAGE_KEYS = {
        DOCS: 'writebox.documents',
        ACTIVE: 'writebox.activeDocId',
        THEME: 'writebox.theme'
    };

    const AUTOSAVE_DELAY = 400; // ms (debounced)
    const SAVE_STATUS_TIMEOUT = 1200; // ms

    /* ---------- DOM References ---------- */
    const $ = (id) => document.getElementById(id);
    const editor          = $('editor');
    const docTitleInput   = $('doc-title');
    const saveStatus      = $('save-status');
    const wordCountEl     = $('word-count');
    const charCountEl     = $('char-count');
    const readingTimeEl   = $('reading-time');
    const sidebar         = $('sidebar');
    const backdrop        = $('backdrop');
    const docList         = $('doc-list');
    const fileInput       = $('file-input');
    const toastEl         = $('toast');
    const iconMoon        = $('icon-moon');
    const iconSun         = $('icon-sun');
    const toolbar         = $('toolbar');
    const statusBar       = $('status-bar');

    /* ---------- App State ---------- */
    let state = {
        documents: [],   // [{id, title, content, createdAt, updatedAt}]
        activeId: null
    };

    let autoSaveTimer = null;
    let saveStatusTimer = null;
    let toastTimer = null;
    let idleTimer = null;

    /* ---------- Utilities ---------- */
    const uid = () =>
        'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const now = () => Date.now();

    const formatDate = (ts) => {
        const d = new Date(ts);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        if (isToday) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        const diff = (today - d) / (1000 * 60 * 60 * 24);
        if (diff < 7) {
            return d.toLocaleDateString([], { weekday: 'short' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const escapeHTML = (str) =>
        String(str).replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        }[m]));

    /* ---------- Storage ---------- */
    function loadState() {
        try {
            const docsRaw = localStorage.getItem(STORAGE_KEYS.DOCS);
            const activeId = localStorage.getItem(STORAGE_KEYS.ACTIVE);
            const docs = docsRaw ? JSON.parse(docsRaw) : [];
            state.documents = Array.isArray(docs) ? docs : [];
            state.activeId = activeId || null;
        } catch (err) {
            console.error('Failed to load state:', err);
            state.documents = [];
            state.activeId = null;
        }

        // Ensure at least one document exists
        if (state.documents.length === 0) {
            const first = createDocumentObject('Welcome to WriteBox',
`Welcome to WriteBox ✍️

A minimalist, distraction-free writing space.

Tips:
• Just start typing — your work auto-saves to your browser.
• Open the menu (top-left) to manage multiple documents.
• Toggle dark mode with the moon icon (or Ctrl/Cmd + D).
• Export your text as a .txt file from the toolbar.

Keyboard shortcuts:
  Ctrl/Cmd + N   New document
  Ctrl/Cmd + S   Save (auto-saves anyway)
  Ctrl/Cmd + E   Export as .txt
  Ctrl/Cmd + D   Toggle theme
  Ctrl/Cmd + M   Toggle documents menu

Enjoy your writing.`);
            state.documents.push(first);
            state.activeId = first.id;
            persist();
        }

        // Ensure activeId points to a valid doc
        if (!state.documents.find((d) => d.id === state.activeId)) {
            state.activeId = state.documents[0].id;
        }
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(state.documents));
            localStorage.setItem(STORAGE_KEYS.ACTIVE, state.activeId || '');
        } catch (err) {
            console.error('Failed to save:', err);
            showToast('⚠ Storage full — could not save');
        }
    }

    /* ---------- Document operations ---------- */
    function createDocumentObject(title = 'Untitled', content = '') {
        const t = now();
        return {
            id: uid(),
            title: title || 'Untitled',
            content,
            createdAt: t,
            updatedAt: t
        };
    }

    function getActiveDoc() {
        return state.documents.find((d) => d.id === state.activeId);
    }

    function createDocument(title, content) {
        const doc = createDocumentObject(title, content);
        state.documents.unshift(doc);
        state.activeId = doc.id;
        persist();
        renderDocList();
        renderActiveDoc();
        editor.focus();
        showToast('New document created');
    }

    function deleteDocument(id) {
        const idx = state.documents.findIndex((d) => d.id === id);
        if (idx === -1) return;

        const doc = state.documents[idx];
        const ok = confirm(`Delete "${doc.title}"? This cannot be undone.`);
        if (!ok) return;

        state.documents.splice(idx, 1);

        // If we deleted the active document, choose another (or create one)
        if (state.activeId === id) {
            if (state.documents.length === 0) {
                const fresh = createDocumentObject('Untitled');
                state.documents.push(fresh);
                state.activeId = fresh.id;
            } else {
                state.activeId = state.documents[Math.max(0, idx - 1)].id;
            }
        }

        persist();
        renderDocList();
        renderActiveDoc();
        showToast('Document deleted');
    }

    function selectDocument(id) {
        if (state.activeId === id) {
            closeSidebar();
            return;
        }
        state.activeId = id;
        persist();
        renderDocList();
        renderActiveDoc();
        closeSidebar();
        editor.focus();
    }

    function updateActiveContent(content) {
        const doc = getActiveDoc();
        if (!doc) return;
        doc.content = content;
        doc.updatedAt = now();
        scheduleSave();
    }

    function updateActiveTitle(title) {
        const doc = getActiveDoc();
        if (!doc) return;
        doc.title = title.trim() || 'Untitled';
        doc.updatedAt = now();
        scheduleSave();
        renderDocList();
    }

    /* ---------- Auto-save (debounced) ---------- */
    function scheduleSave() {
        showSaveStatus('Saving…', true);
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            persist();
            showSaveStatus('Saved', false);
        }, AUTOSAVE_DELAY);
    }

    function showSaveStatus(text, saving) {
        saveStatus.textContent = text;
        saveStatus.classList.toggle('saving', !!saving);

        clearTimeout(saveStatusTimer);
        if (!saving) {
            saveStatusTimer = setTimeout(() => {
                saveStatus.textContent = 'Saved';
            }, SAVE_STATUS_TIMEOUT);
        }
    }

    /* ---------- Stats ---------- */
    function updateStats(text) {
        const trimmed = text.trim();
        const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
        const chars = text.length;
        // Average reading speed ~ 200 words per minute
        const minutes = Math.max(0, Math.ceil(words / 200));

        wordCountEl.textContent = `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
        charCountEl.textContent = `${chars.toLocaleString()} character${chars === 1 ? '' : 's'}`;
        readingTimeEl.textContent = words === 0 ? '0 min read' :
            (minutes < 1 ? '< 1 min read' : `${minutes} min read`);
    }

    /* ---------- Rendering ---------- */
    function renderActiveDoc() {
        const doc = getActiveDoc();
        if (!doc) return;
        editor.value = doc.content;
        docTitleInput.value = doc.title;
        updateStats(doc.content);
        autoResizeEditor();
    }

    function renderDocList() {
        // Sort documents by updatedAt desc
        const sorted = [...state.documents].sort((a, b) => b.updatedAt - a.updatedAt);
        docList.innerHTML = '';

        sorted.forEach((doc) => {
            const li = document.createElement('li');
            li.className = 'doc-item' + (doc.id === state.activeId ? ' active' : '');
            li.dataset.id = doc.id;
            li.setAttribute('role', 'listitem');

            const preview = (doc.content || '').slice(0, 60).replace(/\n/g, ' ').trim();
            const meta = `${formatDate(doc.updatedAt)}${preview ? ' · ' + escapeHTML(preview) : ''}`;

            li.innerHTML = `
                <div class="doc-item-info">
                    <div class="doc-item-title">${escapeHTML(doc.title || 'Untitled')}</div>
                    <div class="doc-item-meta">${meta}</div>
                </div>
                <button class="doc-item-delete" title="Delete document" aria-label="Delete document">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            `;

            // Select doc on click
            li.addEventListener('click', (e) => {
                if (e.target.closest('.doc-item-delete')) return;
                selectDocument(doc.id);
            });

            // Delete on button click
            li.querySelector('.doc-item-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteDocument(doc.id);
            });

            docList.appendChild(li);
        });
    }

    /**
     * The editor textarea has overflow:hidden — we let the parent
     * scroll. So we resize textarea to its content height.
     */
    function autoResizeEditor() {
        editor.style.height = 'auto';
        editor.style.height = editor.scrollHeight + 'px';
    }

    /* ---------- Theme ---------- */
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            iconMoon.style.display = 'none';
            iconSun.style.display = 'block';
        } else {
            document.documentElement.removeAttribute('data-theme');
            iconMoon.style.display = 'block';
            iconSun.style.display = 'none';
        }
    }

    function loadTheme() {
        let theme = localStorage.getItem(STORAGE_KEYS.THEME);
        if (!theme) {
            // Use OS preference as default
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light';
        }
        applyTheme(theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem(STORAGE_KEYS.THEME, next);
    }

    /* ---------- Sidebar ---------- */
    function openSidebar() {
        sidebar.classList.add('open');
        backdrop.classList.add('visible');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        backdrop.classList.remove('visible');
    }

    function toggleSidebar() {
        if (sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
    }

    /* ---------- Import / Export ---------- */
    function exportActiveDoc() {
        const doc = getActiveDoc();
        if (!doc) return;

        const safeName = (doc.title || 'untitled').replace(/[^a-z0-9-_ ]/gi, '_').trim() || 'untitled';
        const blob = new Blob([doc.content || ''], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Exported as .txt');
    }

    function importFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result || '';
            const title = file.name.replace(/\.[^/.]+$/, '') || 'Imported';
            createDocument(title, content);
            showToast(`Imported "${title}"`);
        };
        reader.onerror = () => showToast('⚠ Failed to read file');
        reader.readAsText(file);
    }

    /* ---------- Toast ---------- */
    function showToast(msg, duration = 2000) {
        toastEl.textContent = msg;
        toastEl.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('visible');
        }, duration);
    }

    /* ---------- Idle UI (auto-hide chrome while typing) ---------- */
    function showChrome() {
        toolbar.classList.remove('hidden');
        statusBar.classList.remove('hidden');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            // Only hide if the editor is focused (user is writing)
            if (document.activeElement === editor) {
                toolbar.classList.add('hidden');
                statusBar.classList.add('hidden');
            }
        }, 2500);
    }

    /* ---------- Keyboard shortcuts ---------- */
    function handleKeydown(e) {
        const cmd = e.ctrlKey || e.metaKey;

        if (cmd && e.key.toLowerCase() === 's') {
            e.preventDefault();
            persist();
            showSaveStatus('Saved', false);
            showToast('Saved');
        } else if (cmd && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            createDocument('Untitled', '');
        } else if (cmd && e.key.toLowerCase() === 'e') {
            e.preventDefault();
            exportActiveDoc();
        } else if (cmd && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            toggleTheme();
        } else if (cmd && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            toggleSidebar();
        } else if (e.key === 'Escape') {
            if (sidebar.classList.contains('open')) closeSidebar();
        }
    }

    /* ---------- Event Bindings ---------- */
    function bindEvents() {
        // Editor input → update doc + stats
        editor.addEventListener('input', () => {
            updateActiveContent(editor.value);
            updateStats(editor.value);
            autoResizeEditor();
            showChrome();
        });

        // Title input
        docTitleInput.addEventListener('input', () => {
            updateActiveTitle(docTitleInput.value);
        });
        docTitleInput.addEventListener('blur', () => {
            // Normalize empty title
            if (!docTitleInput.value.trim()) {
                docTitleInput.value = 'Untitled';
                updateActiveTitle('Untitled');
            }
        });
        docTitleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                editor.focus();
            }
        });

        // Toolbar buttons
        $('menu-toggle').addEventListener('click', toggleSidebar);
        $('sidebar-close').addEventListener('click', closeSidebar);
        $('sidebar-new-btn').addEventListener('click', () => {
            createDocument('Untitled', '');
            closeSidebar();
        });
        $('new-btn').addEventListener('click', () => createDocument('Untitled', ''));
        $('export-btn').addEventListener('click', exportActiveDoc);
        $('theme-toggle').addEventListener('click', toggleTheme);

        // Import
        $('import-btn').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            importFile(file);
            fileInput.value = ''; // allow reimport of same file
        });

        // Backdrop click closes sidebar
        backdrop.addEventListener('click', closeSidebar);

        // Global shortcuts
        document.addEventListener('keydown', handleKeydown);

        // Window resize → reflow textarea
        window.addEventListener('resize', autoResizeEditor);

        // Save before unload
        window.addEventListener('beforeunload', () => {
            clearTimeout(autoSaveTimer);
            persist();
        });

        // Show chrome whenever user moves the mouse
        document.addEventListener('mousemove', () => {
            toolbar.classList.remove('hidden');
            statusBar.classList.remove('hidden');
        });

        // React to OS theme changes if no preference set
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    /* ---------- Initialization ---------- */
    function init() {
        loadTheme();
        loadState();
        renderDocList();
        renderActiveDoc();
        bindEvents();
        // Auto-focus editor (per requirements)
        setTimeout(() => editor.focus(), 100);
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ============================================
   Font Size Controls
   ============================================ */
(function () {
    const STORAGE_KEY = 'writebox.fontSize';
    const MIN_SIZE = 12;
    const MAX_SIZE = 40;
    const STEP = 1;
    const DEFAULT_SIZE = 19;

    const decreaseBtn = document.getElementById('font-decrease');
    const increaseBtn = document.getElementById('font-increase');
    const display = document.getElementById('font-size-display');
    const editor = document.getElementById('editor');

    if (!editor) return; // safety

    let currentSize = loadSize();

    function loadSize() {
        const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
        if (!isNaN(saved) && saved >= MIN_SIZE && saved <= MAX_SIZE) {
            return saved;
        }
        return DEFAULT_SIZE;
    }

    function saveSize(size) {
        try {
            localStorage.setItem(STORAGE_KEY, String(size));
        } catch (e) { /* storage full / disabled */ }
    }

    function applySize(size) {
        currentSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
        document.documentElement.style.setProperty('--editor-font-size', currentSize + 'px');
        if (display) display.textContent = currentSize + 'px';
        updateButtonStates();
        saveSize(currentSize);
    }

    function updateButtonStates() {
        if (decreaseBtn) {
            const atMin = currentSize <= MIN_SIZE;
            decreaseBtn.disabled = atMin;
            decreaseBtn.setAttribute('aria-disabled', atMin);
        }
        if (increaseBtn) {
            const atMax = currentSize >= MAX_SIZE;
            increaseBtn.disabled = atMax;
            increaseBtn.setAttribute('aria-disabled', atMax);
        }
    }

    function increase() { applySize(currentSize + STEP); }
    function decrease() { applySize(currentSize - STEP); }
    function reset()    { applySize(DEFAULT_SIZE); }

    if (increaseBtn) increaseBtn.addEventListener('click', increase);
    if (decreaseBtn) decreaseBtn.addEventListener('click', decrease);

    // Keyboard shortcuts: Ctrl/Cmd + =  /  + -  /  + 0
    document.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        // "=" key (often shares with "+"); also accept NumpadAdd
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            increase();
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            decrease();
        } else if (e.key === '0') {
            e.preventDefault();
            reset();
        }
    });

    // Apply on load
    applySize(currentSize);
})();
