# ✍ WriteBox

A **minimalist, distraction-free writing web app** built with vanilla **HTML, CSS & JavaScript** (no frameworks, no UI libraries). Your work is saved instantly to your browser's **LocalStorage** and works fully offline.

> Inspired by the simplicity of `write-box.appspot.com`, but written from scratch.

---

## 📁 Folder Structure

```
writebox/
├── index.html            # Markup
├── css/
│   └── style.css         # All styles (light + dark themes)
├── js/
│   └── script.js         # All app logic (vanilla JS)
├── server.js             # OPTIONAL Express static server
├── package.json          # OPTIONAL Node dependencies
└── README.md             # This file
```

---

## ✅ Currently Completed Features

### Core
- 🖋 **Distraction-free writing area** — full-screen, centered like a notepad
- 💾 **Real-time auto-save** to **LocalStorage** (debounced, ~400 ms)
- 📚 **Multiple documents** — create, switch, rename, and delete
- 🌗 **Light & Dark mode** with persistent preference (and OS-preference fallback)
- 🔢 **Live word count, character count & reading-time** in the status bar
- ⌨ **Keyboard shortcuts** (full list below)
- 📡 **Offline-first** — entire app runs without an internet connection

### UI / UX
- 🎯 Centered editor with a comfortable max-width (~720 px)
- 🔠 Beautiful serif typography for body text, sans-serif for chrome
- 📱 **Responsive design** — works on mobile, tablet, and desktop
- ✨ Subtle fade-in / transition animations
- 🪶 Toolbar fades while you type (idle-aware), reappears on hover/movement
- 🍞 Toast notifications for actions (save, delete, import, export)

### Extras
- 📥 **Import** `.txt` / `.md` files as new documents
- 📤 **Export** the current document as a `.txt` file
- 🪄 Editor auto-focuses on load
- 🧠 Theme preference persists across sessions
- ♿ ARIA labels & keyboard-accessible controls

---

## ⌨ Keyboard Shortcuts

| Shortcut          | Action                       |
| ----------------- | ---------------------------- |
| `Ctrl/Cmd + N`    | Create new document          |
| `Ctrl/Cmd + S`    | Force save (auto-saves anyway) |
| `Ctrl/Cmd + E`    | Export current doc as `.txt` |
| `Ctrl/Cmd + D`    | Toggle dark / light theme    |
| `Ctrl/Cmd + M`    | Toggle documents sidebar     |
| `Esc`             | Close sidebar                |

---

## 🚀 Run Locally

### Option 1 — No installation (recommended)

The app is **100 % static**. Just open `index.html` in any modern browser:

```bash
# from the project folder
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

Or drag-and-drop `index.html` into your browser.

### Option 2 — With the optional Node.js server

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Visit
#    http://localhost:3000
```

### Option 3 — Quick local server (no Node)

```bash
# Python 3
python -m http.server 8000

# Then visit http://localhost:8000
```

---

## 🌐 Functional Entry URIs

When served by `server.js`:

| Path               | Method   | Description                         |
| ------------------ | -------- | ----------------------------------- |
| `/`                | `GET`    | Loads the WriteBox app (index.html) |
| `/api/documents`   | `GET`    | (optional) List all documents       |
| `/api/documents`   | `POST`   | (optional) Create a document        |
| `/api/documents/:id` | `GET`  | (optional) Get a single document    |
| `/api/documents/:id` | `PUT`  | (optional) Update title / content   |
| `/api/documents/:id` | `DELETE` | (optional) Delete a document      |

> Note: the optional API uses an **in-memory** store and is for demonstration only. The frontend itself uses **LocalStorage** as its source of truth.

---

## 🧠 Data Model & Storage

All data is stored in the browser's `localStorage`:

| Key                       | Value                                                   |
| ------------------------- | ------------------------------------------------------- |
| `writebox.documents`      | `Array<Document>` (JSON)                                |
| `writebox.activeDocId`    | `string` — id of the currently open document           |
| `writebox.theme`          | `"light"` \| `"dark"`                                  |

### `Document` shape

```js
{
  id:        "doc_lwa3kzs9_a8b3xy",   // unique id
  title:     "My essay",
  content:   "Once upon a time...",
  createdAt: 1714670400000,           // ms timestamp
  updatedAt: 1714670450000
}
```

---

## 🛠 Features Not Yet Implemented

- ☁ Cloud / cross-device sync (the optional Express API is in-memory only)
- 👥 Multi-user accounts & authentication
- 📝 Markdown live-preview rendering
- 🔍 Full-text search across documents
- 🏷 Tags / folders for organising documents
- ⏪ Version history / undo beyond browser native
- 📦 Export to PDF / Markdown / DOCX
- 🌍 i18n / multilingual UI

---

## 🗺 Recommended Next Steps

1. **Persist the optional Express API** — replace the in-memory `Map` with SQLite or a JSON file so documents survive restarts.
2. **Add markdown preview** — toggle a side-by-side rendered view using a tiny markdown parser.
3. **Build full-text search** — add a search field above the document list.
4. **Add PWA support** — register a service worker + manifest so users can "install" the app and use it 100 % offline by default.
5. **Cloud sync** — add user accounts and sync LocalStorage with the backend on conflict-resolution rules (last-write-wins or CRDTs).
6. **Export formats** — PDF (via `window.print()` styling) and Markdown.

---

## 🎯 Project Goals

- Offer a **calm, beautiful** place to write — no menus to fight, no accounts required.
- Demonstrate that a polished, multi-document editor can be built **without any framework**.
- Stay **fully functional offline** by treating LocalStorage as the source of truth.

---

## 📜 License

MIT — do whatever you like, just don't sue.
