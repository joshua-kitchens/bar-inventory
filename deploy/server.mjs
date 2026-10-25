// Bar inventory server: serves the built app and a small JSON API backed by SQLite.
// No dependencies; needs Node 22.13+ (built-in node:sqlite).
// Caddy terminates HTTPS (and handles the login) and proxies to this on 127.0.0.1:3006.
//
//   PORT       (default 3006)
//   HOST       (default 127.0.0.1; only Caddy should reach this)
//   ROOT       (default: ./dist next to this file on the server, or ../dist when run from the repo)
//   DB_PATH    (default: ./inventory.db next to this file; the service uses /var/lib/inventory)
//   SEED_FILE  (default: inventory.json beside this file or in the repo root)
//
// API:
//   GET    /api/items       all items, in the order they were added
//   PUT    /api/items/:id   create or replace one item
//   DELETE /api/items/:id   remove one item
//
// Static files are read per request, so deploying new app builds needs no restart.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT ?? 3006);
const HOST = process.env.HOST ?? '127.0.0.1';
const besideServer = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const inRepo = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const pick = (name) => (!fs.existsSync(besideServer(name)) && fs.existsSync(inRepo(name)) ? inRepo(name) : besideServer(name));
const ROOT = path.resolve(process.env.ROOT ?? pick('dist'));
const DB_PATH = path.resolve(process.env.DB_PATH ?? besideServer('inventory.db'));
const SEED_FILE = path.resolve(process.env.SEED_FILE ?? pick('inventory.json'));

// ---------- database ----------

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS items (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    quantity      REAL NOT NULL DEFAULT 0,
    unit          TEXT NOT NULL,
    low_threshold REAL NOT NULL DEFAULT 0,
    tags          TEXT NOT NULL DEFAULT '[]',
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`);

const listItems = db.prepare('SELECT * FROM items ORDER BY rowid');
const upsertItem = db.prepare(`
  INSERT INTO items (id, name, category, quantity, unit, low_threshold, tags)
  VALUES (:id, :name, :category, :quantity, :unit, :lowThreshold, :tags)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name, category = excluded.category, quantity = excluded.quantity,
    unit = excluded.unit, low_threshold = excluded.low_threshold, tags = excluded.tags,
    updated_at = datetime('now')
`);
const deleteItem = db.prepare('DELETE FROM items WHERE id = ?');

const toItem = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  quantity: row.quantity,
  unit: row.unit,
  lowThreshold: row.low_threshold,
  tags: JSON.parse(row.tags),
});

/** Validate an item from a request body; returns the row params or throws a message. */
function parseItem(id, body) {
  const str = (v, field) => {
    if (typeof v !== 'string' || !v.trim()) throw `${field} is required`;
    return v.trim();
  };
  const num = (v, field) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw `${field} must be a non-negative number`;
    return v;
  };
  const tags = body.tags ?? [];
  if (!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')) throw 'tags must be a list of strings';
  return {
    id,
    name: str(body.name, 'name'),
    category: str(body.category, 'category'),
    quantity: num(body.quantity, 'quantity'),
    unit: str(body.unit, 'unit'),
    lowThreshold: num(body.lowThreshold ?? 0, 'lowThreshold'),
    tags: JSON.stringify(tags),
  };
}

// One-time import of the old GitHub-backed inventory.json. Recorded in meta so that
// deleting every item later doesn't bring the old list back on restart.
if (!db.prepare("SELECT 1 FROM meta WHERE key = 'seeded'").get()) {
  let imported = 0;
  db.exec('BEGIN');
  try {
    if (fs.existsSync(SEED_FILE)) {
      for (const item of JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')).items ?? []) {
        upsertItem.run(parseItem(String(item.id), item));
        imported++;
      }
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', datetime('now'))").run();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  console.log(imported ? `Imported ${imported} items from ${SEED_FILE}` : 'Started with an empty inventory');
}

// ---------- API ----------

function json(res, status, body) {
  const text = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

async function readJson(req, limit = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw 'request body too large';
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw 'request body must be JSON';
  }
}

async function api(req, res, pathname) {
  if (pathname === '/api/items') {
    if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
    return json(res, 200, listItems.all().map(toItem));
  }

  const match = pathname.match(/^\/api\/items\/([^/]+)$/);
  if (!match) return json(res, 404, { error: 'not found' });
  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return json(res, 400, { error: 'bad item id' });
  }

  if (req.method === 'PUT') {
    try {
      const row = parseItem(id, await readJson(req));
      upsertItem.run(row);
      return json(res, 200, toItem({ ...row, low_threshold: row.lowThreshold }));
    } catch (err) {
      if (typeof err === 'string') return json(res, 400, { error: err });
      throw err;
    }
  }
  if (req.method === 'DELETE') {
    deleteItem.run(id);
    return json(res, 204);
  }
  return json(res, 405, { error: 'method not allowed' });
}

// ---------- static files ----------

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const statFile = (p) => fs.promises.stat(p).catch(() => null);

/** Map a URL path to a file under ROOT, or null (404). */
async function resolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  let full = path.join(ROOT, decoded);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null; // ../ escape

  let stat = await statFile(full);
  if (stat?.isDirectory()) {
    full = path.join(full, 'index.html');
    stat = await statFile(full);
  }
  return stat?.isFile() ? { file: full, stat } : null;
}

function serveFile(req, res, { file, stat }) {
  // Vite fingerprints /assets/ files, so they never change. index.html always revalidates.
  const isAsset = file.startsWith(path.join(ROOT, 'assets') + path.sep);
  const since = Date.parse(req.headers['if-modified-since'] ?? '');
  if (!Number.isNaN(since) && Math.floor(stat.mtimeMs / 1000) <= since / 1000) {
    return res.writeHead(304).end();
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Last-Modified': stat.mtime.toUTCString(),
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname.startsWith('/api/')) return await api(req, res, pathname);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    }
    const hit = await resolve(pathname);
    if (hit) serveFile(req, res, hit);
    else res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end();
    else res.destroy();
  }
});

server.listen(PORT, HOST, () => console.log(`Serving ${ROOT} and ${DB_PATH} on http://${HOST}:${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
}
