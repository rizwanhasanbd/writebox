/**
 * ============================================
 * WriteBox — Optional Express Server
 * ============================================
 * A tiny Node.js server that statically serves the WriteBox
 * frontend. The app works fully offline using LocalStorage,
 * so this server is only needed if you want to host it.
 *
 * It also exposes a couple of optional REST endpoints that you
 * can use for a backend-backed sync (currently in-memory).
 *
 * Run:
 *   npm install
 *   npm start
 *
 * Then open http://localhost:3000
 */

const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

/* ---------- Optional in-memory document store ---------- */
const documents = new Map();

// List all documents
app.get('/api/documents', (req, res) => {
    res.json(Array.from(documents.values()));
});

// Get a single document
app.get('/api/documents/:id', (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
});

// Create a document
app.post('/api/documents', (req, res) => {
    const id = 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const t = Date.now();
    const doc = {
        id,
        title: (req.body && req.body.title) || 'Untitled',
        content: (req.body && req.body.content) || '',
        createdAt: t,
        updatedAt: t
    };
    documents.set(id, doc);
    res.status(201).json(doc);
});

// Update a document
app.put('/api/documents/:id', (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (typeof req.body.title === 'string') doc.title = req.body.title;
    if (typeof req.body.content === 'string') doc.content = req.body.content;
    doc.updatedAt = Date.now();
    res.json(doc);
});

// Delete a document
app.delete('/api/documents/:id', (req, res) => {
    const ok = documents.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
});

/* ---------- Fallback to index.html ---------- */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✍  WriteBox running at  http://localhost:${PORT}`);
});
