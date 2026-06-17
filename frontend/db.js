/**
 * SQLite persistence for the LegalGuide Node server.
 * Uses better-sqlite3 for simple synchronous local dev (single-file DB).
 * Set SQLITE_PATH in frontend/.env (default: ./legalguide.db).
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let db = null;

function getDbPath() {
  const fromEnv = process.env.SQLITE_PATH || process.env.DATABASE_URL;
  if (fromEnv) {
    if (fromEnv.startsWith('sqlite:')) return fromEnv.replace(/^sqlite:\/\//, '');
    return fromEnv;
  }
  return path.join(__dirname, 'legalguide.db');
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lawyer_reviews (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_email);
    CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC);
  `);
}

function initDatabase() {
  if (db) return db;
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function getMeta(key) {
  const row = initDatabase().prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  initDatabase()
    .prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

function tableCount(table) {
  const allowed = ['users', 'bookings', 'admin_actions', 'ai_conversations', 'lawyer_reviews', 'contacts'];
  if (!allowed.includes(table)) return 0;
  const row = initDatabase().prepare(`SELECT COUNT(*) AS c FROM ${table}`).get();
  return row ? row.c : 0;
}

function isDbEmpty() {
  return tableCount('users') === 0
    && tableCount('bookings') === 0
    && tableCount('admin_actions') === 0
    && tableCount('ai_conversations') === 0
    && tableCount('lawyer_reviews') === 0;
}

function importStateFromObject(data) {
  const database = initDatabase();
  const importAll = database.transaction((payload) => {
    database.prepare('DELETE FROM users').run();
    database.prepare('DELETE FROM bookings').run();
    database.prepare('DELETE FROM admin_actions').run();
    database.prepare('DELETE FROM ai_conversations').run();
    database.prepare('DELETE FROM lawyer_reviews').run();

    const insertUser = database.prepare('INSERT INTO users (email, data_json) VALUES (?, ?)');
    (payload.users || []).forEach((u) => {
      const email = String(u.email || '').toLowerCase();
      if (!email) return;
      insertUser.run(email, JSON.stringify(u));
    });

    const insertBooking = database.prepare('INSERT INTO bookings (id, data_json) VALUES (?, ?)');
    (payload.bookings || []).forEach((b) => {
      const id = String(b.id || '');
      if (!id) return;
      insertBooking.run(id, JSON.stringify(b));
    });

    const insertAction = database.prepare(
      'INSERT INTO admin_actions (id, data_json, created_at) VALUES (?, ?, ?)'
    );
    (payload.adminActions || []).forEach((a) => {
      const id = String(a.id || `${Date.now()}${Math.random().toString(36).slice(2, 6)}`);
      insertAction.run(id, JSON.stringify({ ...a, id }), a.at || a.createdAt || new Date().toISOString());
    });

    const insertConv = database.prepare(
      'INSERT INTO ai_conversations (id, user_email, data_json, updated_at) VALUES (?, ?, ?, ?)'
    );
    (payload.aiConversations || []).forEach((c) => {
      const id = String(c.id || '');
      if (!id) return;
      insertConv.run(
        id,
        String(c.userEmail || '').toLowerCase(),
        JSON.stringify(c),
        c.updatedAt || c.createdAt || new Date().toISOString()
      );
    });

    const insertReview = database.prepare('INSERT INTO lawyer_reviews (id, data_json) VALUES (?, ?)');
    (payload.lawyerReviews || []).forEach((r) => {
      const id = String(r.id || '');
      if (!id) return;
      insertReview.run(id, JSON.stringify(r));
    });
  });

  importAll(data || {});
}

function migrateFromJsonIfNeeded(jsonFilePath) {
  if (getMeta('json_migrated') === '1') return { migrated: false, reason: 'already_migrated' };
  if (!isDbEmpty()) {
    setMeta('json_migrated', '1');
    return { migrated: false, reason: 'db_has_data' };
  }
  if (!jsonFilePath || !fs.existsSync(jsonFilePath)) {
    return { migrated: false, reason: 'no_json_file' };
  }

  try {
    const raw = fs.readFileSync(jsonFilePath, 'utf8');
    const data = JSON.parse(raw);
    importStateFromObject(data);
    setMeta('json_migrated', '1');
    setMeta('json_migrated_from', path.basename(jsonFilePath));
    setMeta('json_migrated_at', new Date().toISOString());
    console.log('[db] Migrated data from', jsonFilePath);
    return { migrated: true, users: (data.users || []).length };
  } catch (e) {
    console.error('[db] JSON migration failed', e);
    return { migrated: false, reason: 'error', error: e.message };
  }
}

function loadAllState() {
  const database = initDatabase();
  const users = database.prepare('SELECT data_json FROM users').all().map((r) => JSON.parse(r.data_json));
  const bookings = database.prepare('SELECT data_json FROM bookings').all().map((r) => JSON.parse(r.data_json));
  const adminActions = database
    .prepare('SELECT data_json FROM admin_actions ORDER BY created_at ASC')
    .all()
    .map((r) => JSON.parse(r.data_json));
  const aiConversations = database
    .prepare('SELECT data_json FROM ai_conversations ORDER BY updated_at DESC')
    .all()
    .map((r) => JSON.parse(r.data_json));
  const lawyerReviews = database.prepare('SELECT data_json FROM lawyer_reviews').all().map((r) => JSON.parse(r.data_json));
  return { users, bookings, adminActions, aiConversations, lawyerReviews };
}

function saveAllState(state) {
  const database = initDatabase();
  const persist = database.transaction((payload) => {
    database.prepare('DELETE FROM users').run();
    database.prepare('DELETE FROM bookings').run();
    database.prepare('DELETE FROM admin_actions').run();
    database.prepare('DELETE FROM ai_conversations').run();
    database.prepare('DELETE FROM lawyer_reviews').run();

    const insertUser = database.prepare('INSERT INTO users (email, data_json) VALUES (?, ?)');
    (payload.users || []).forEach((u) => {
      const email = String(u.email || '').toLowerCase();
      if (!email) return;
      insertUser.run(email, JSON.stringify(u));
    });

    const insertBooking = database.prepare('INSERT INTO bookings (id, data_json) VALUES (?, ?)');
    (payload.bookings || []).forEach((b) => {
      const id = String(b.id || '');
      if (!id) return;
      insertBooking.run(id, JSON.stringify(b));
    });

    const insertAction = database.prepare(
      'INSERT INTO admin_actions (id, data_json, created_at) VALUES (?, ?, ?)'
    );
    (payload.adminActions || []).forEach((a) => {
      const id = String(a.id || `${Date.now()}${Math.random().toString(36).slice(2, 6)}`);
      insertAction.run(id, JSON.stringify({ ...a, id }), a.at || new Date().toISOString());
    });

    const insertConv = database.prepare(
      'INSERT INTO ai_conversations (id, user_email, data_json, updated_at) VALUES (?, ?, ?, ?)'
    );
    (payload.aiConversations || []).forEach((c) => {
      const id = String(c.id || '');
      if (!id) return;
      insertConv.run(
        id,
        String(c.userEmail || '').toLowerCase(),
        JSON.stringify(c),
        c.updatedAt || c.createdAt || new Date().toISOString()
      );
    });

    const insertReview = database.prepare('INSERT INTO lawyer_reviews (id, data_json) VALUES (?, ?)');
    (payload.lawyerReviews || []).forEach((r) => {
      const id = String(r.id || '');
      if (!id) return;
      insertReview.run(id, JSON.stringify(r));
    });
  });

  persist(state || {});
  return true;
}

function insertContact({ name, email, message, createdAt }) {
  const at = createdAt || new Date().toISOString();
  const result = initDatabase()
    .prepare('INSERT INTO contacts (name, email, message, created_at, is_read) VALUES (?, ?, ?, ?, 0)')
    .run(String(name || '').trim(), String(email || '').trim(), String(message || '').trim(), at);
  return {
    id: result.lastInsertRowid,
    name: String(name || '').trim(),
    email: String(email || '').trim(),
    message: String(message || '').trim(),
    createdAt: at,
    isRead: false,
  };
}

function listContacts({ limit = 200 } = {}) {
  const rows = initDatabase()
    .prepare(
      'SELECT id, name, email, message, created_at, is_read FROM contacts ORDER BY created_at DESC LIMIT ?'
    )
    .all(Math.min(Math.max(1, limit), 500));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    message: r.message,
    createdAt: r.created_at,
    isRead: !!r.is_read,
  }));
}

function markContactRead(id) {
  const result = initDatabase()
    .prepare('UPDATE contacts SET is_read = 1 WHERE id = ?')
    .run(Number(id));
  return result.changes > 0;
}

function exportJsonBackup(filePath) {
  const state = loadAllState();
  const contacts = listContacts({ limit: 500 });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ ...state, contacts, exportedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );
}

module.exports = {
  initDatabase,
  getDbPath,
  migrateFromJsonIfNeeded,
  loadAllState,
  saveAllState,
  insertContact,
  listContacts,
  markContactRead,
  exportJsonBackup,
  isDbEmpty,
};
