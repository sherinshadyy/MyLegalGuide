/**
 * MySQL persistence for the LegalGuide Node server (shared schema with backend/db.py).
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

let pool = null;

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'mylegalguide',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
  };
}

function getDbPath() {
  const cfg = mysqlConfig();
  return `${cfg.host}:${cfg.port}/${cfg.database}`;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_e) {
    return fallback;
  }
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

async function ensureDatabaseExists() {
  const cfg = mysqlConfig();
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    charset: 'utf8mb4',
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

async function ensureSchema() {
  const p = pool;
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(64) NOT NULL DEFAULT '',
      password VARCHAR(255) NOT NULL DEFAULT '',
      role VARCHAR(32) NOT NULL DEFAULT 'User',
      specialty VARCHAR(128) DEFAULT '',
      description TEXT,
      profile_pic TEXT,
      gender VARCHAR(16) DEFAULT '',
      consultation_fee INT DEFAULT NULL,
      fee_min INT DEFAULT NULL,
      fee_max INT DEFAULT NULL,
      practice_details TEXT,
      availability TEXT,
      availability_slots JSON NOT NULL,
      documents JSON NOT NULL,
      lawyer_status VARCHAR(32) DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      deleted_at DATETIME DEFAULT NULL,
      location VARCHAR(255) DEFAULT '',
      years_of_experience INT DEFAULT NULL,
      consultation_duration INT DEFAULT NULL,
      booking_options JSON NOT NULL,
      rejection_reason TEXT,
      rejection_at DATETIME DEFAULT NULL,
      INDEX (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS admin_actions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      external_id VARCHAR(64) DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      admin_email VARCHAR(255) NOT NULL,
      action VARCHAR(128) NOT NULL,
      target_email VARCHAR(255) DEFAULT '',
      details TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lawyer VARCHAR(255) DEFAULT '',
      lawyer_email VARCHAR(255) DEFAULT '',
      name VARCHAR(255) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      date DATE DEFAULT NULL,
      time VARCHAR(32) DEFAULT '',
      note TEXT,
      meeting_type VARCHAR(64) DEFAULT '',
      status VARCHAR(64) DEFAULT '',
      messages JSON NOT NULL,
      acted_at DATETIME DEFAULT NULL,
      chat_read_at JSON NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      title VARCHAR(255) DEFAULT '',
      messages JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS lawyer_reviews (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      lawyer_email VARCHAR(255) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      user_name VARCHAR(255) DEFAULT '',
      rating INT DEFAULT NULL,
      comment TEXT,
      booking_id VARCHAR(64) DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_contacts_created (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(64) NOT NULL PRIMARY KEY,
      meta_value TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function initDatabase() {
  if (pool) return pool;
  await ensureDatabaseExists();
  pool = mysql.createPool(mysqlConfig());
  await ensureSchema();
  return pool;
}

async function getMeta(key) {
  const [rows] = await pool.query('SELECT meta_value FROM app_meta WHERE meta_key = ?', [key]);
  return rows.length ? rows[0].meta_value : null;
}

async function setMeta(key, value) {
  await pool.query(
    'INSERT INTO app_meta (meta_key, meta_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)',
    [key, String(value)]
  );
}

async function tableCount(table) {
  const allowed = ['users', 'bookings', 'admin_actions', 'ai_conversations', 'lawyer_reviews', 'contacts'];
  if (!allowed.includes(table)) return 0;
  const [rows] = await pool.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
  return rows[0] ? Number(rows[0].c) : 0;
}

async function isDbEmpty() {
  const counts = await Promise.all([
    tableCount('users'),
    tableCount('bookings'),
    tableCount('admin_actions'),
    tableCount('ai_conversations'),
    tableCount('lawyer_reviews'),
  ]);
  return counts.every((c) => c === 0);
}

function rowToUser(row) {
  return {
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    password: row.password || '',
    role: row.role || 'User',
    specialty: row.specialty || '',
    description: row.description || '',
    profilePic: row.profile_pic || '',
    gender: row.gender || '',
    consultationFee: row.consultation_fee,
    feeMin: row.fee_min,
    feeMax: row.fee_max,
    practiceDetails: row.practice_details || '',
    availability: row.availability || '',
    availabilitySlots: parseJson(row.availability_slots, []),
    documents: parseJson(row.documents, []),
    lawyerStatus: row.lawyer_status || '',
    isActive: row.is_active === undefined ? true : !!row.is_active,
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : null,
    location: row.location || '',
    yearsOfExperience: row.years_of_experience,
    consultationDuration: row.consultation_duration,
    bookingOptions: parseJson(row.booking_options, []),
    rejectionReason: row.rejection_reason || '',
    rejectionAt: row.rejection_at ? toIso(row.rejection_at) : null,
    createdAt: row.created_at ? toIso(row.created_at) : undefined,
  };
}

function userToRow(u) {
  return [
    u.createdAt || null,
    u.name || '',
    String(u.email || '').toLowerCase(),
    u.phone || '',
    u.password || '',
    u.role || 'User',
    u.specialty || '',
    u.description || '',
    u.profilePic || '',
    u.gender || '',
    u.consultationFee ?? null,
    u.feeMin ?? null,
    u.feeMax ?? null,
    u.practiceDetails || '',
    u.availability || '',
    JSON.stringify(u.availabilitySlots || []),
    JSON.stringify(u.documents || []),
    u.lawyerStatus || '',
    u.isActive === false ? 0 : 1,
    u.deletedAt || null,
    u.location || '',
    u.yearsOfExperience ?? null,
    u.consultationDuration ?? null,
    JSON.stringify(u.bookingOptions || []),
    u.rejectionReason || '',
    u.rejectionAt || null,
  ];
}

function rowToBooking(row) {
  return {
    id: row.id,
    lawyer: row.lawyer || '',
    lawyerEmail: row.lawyer_email || '',
    name: row.name || '',
    email: row.email || '',
    date: row.date ? toDateOnly(row.date) : '',
    time: row.time || '',
    note: row.note || '',
    meetingType: row.meeting_type || '',
    status: row.status || '',
    messages: parseJson(row.messages, []),
    createdAt: row.created_at ? toIso(row.created_at) : undefined,
    actedAt: row.acted_at ? toIso(row.acted_at) : null,
    chatReadAt: parseJson(row.chat_read_at, {}),
  };
}

function bookingToRow(b) {
  return [
    b.id || '',
    b.lawyer || '',
    b.lawyerEmail || '',
    b.name || '',
    b.email || '',
    b.date || null,
    b.time || '',
    b.note || '',
    b.meetingType || '',
    b.status || '',
    JSON.stringify(b.messages || []),
    b.createdAt || null,
    b.actedAt || null,
    JSON.stringify(b.chatReadAt || {}),
  ];
}

function rowToAdminAction(row) {
  return {
    id: row.external_id || String(row.id),
    adminEmail: row.admin_email || '',
    action: row.action || '',
    targetEmail: row.target_email || '',
    details: row.details || '',
    at: row.created_at ? toIso(row.created_at) : undefined,
  };
}

function rowToConversation(row) {
  const messages = parseJson(row.messages, []);
  return {
    id: row.id,
    userEmail: row.user_email || '',
    title: row.title || '',
    messages,
    createdAt: row.created_at ? toIso(row.created_at) : undefined,
    updatedAt: row.updated_at ? toIso(row.updated_at) : undefined,
  };
}

function conversationToRow(c) {
  return [
    c.id || '',
    String(c.userEmail || '').toLowerCase(),
    c.title || '',
    JSON.stringify(c.messages || []),
    c.createdAt || null,
    c.updatedAt || c.createdAt || null,
  ];
}

function rowToReview(row) {
  return {
    id: row.id,
    lawyerEmail: row.lawyer_email || '',
    userEmail: row.user_email || '',
    userName: row.user_name || '',
    rating: row.rating,
    comment: row.comment || '',
    bookingId: row.booking_id || '',
    createdAt: row.created_at ? toIso(row.created_at) : undefined,
    updatedAt: row.updated_at ? toIso(row.updated_at) : undefined,
  };
}

function reviewToRow(r) {
  return [
    r.id || '',
    r.lawyerEmail || '',
    r.userEmail || '',
    r.userName || '',
    r.rating ?? null,
    r.comment || '',
    r.bookingId || '',
    r.createdAt || null,
    r.updatedAt || r.createdAt || null,
  ];
}

async function importStateFromObject(data) {
  await saveAllState(data || {});
}

async function migrateFromJsonIfNeeded(jsonFilePath) {
  if ((await getMeta('json_migrated')) === '1') return { migrated: false, reason: 'already_migrated' };
  if (!(await isDbEmpty())) {
    await setMeta('json_migrated', '1');
    return { migrated: false, reason: 'db_has_data' };
  }
  if (!jsonFilePath || !fs.existsSync(jsonFilePath)) {
    return { migrated: false, reason: 'no_json_file' };
  }
  try {
    const raw = fs.readFileSync(jsonFilePath, 'utf8');
    const data = JSON.parse(raw);
    await importStateFromObject(data);
    await setMeta('json_migrated', '1');
    await setMeta('json_migrated_from', path.basename(jsonFilePath));
    await setMeta('json_migrated_at', new Date().toISOString());
    console.log('[db] Migrated data from', jsonFilePath);
    return { migrated: true, users: (data.users || []).length };
  } catch (e) {
    console.error('[db] JSON migration failed', e);
    return { migrated: false, reason: 'error', error: e.message };
  }
}

async function loadAllState() {
  const [userRows] = await pool.query('SELECT * FROM users');
  const [bookingRows] = await pool.query('SELECT * FROM bookings');
  const [actionRows] = await pool.query('SELECT * FROM admin_actions ORDER BY created_at ASC');
  const [convRows] = await pool.query('SELECT * FROM ai_conversations ORDER BY updated_at DESC');
  const [reviewRows] = await pool.query('SELECT * FROM lawyer_reviews');
  return {
    users: userRows.map(rowToUser),
    bookings: bookingRows.map(rowToBooking),
    adminActions: actionRows.map(rowToAdminAction),
    aiConversations: convRows.map(rowToConversation),
    lawyerReviews: reviewRows.map(rowToReview),
  };
}

async function saveAllState(state) {
  const payload = state || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM lawyer_reviews');
    await conn.query('DELETE FROM ai_conversations');
    await conn.query('DELETE FROM admin_actions');
    await conn.query('DELETE FROM bookings');
    await conn.query('DELETE FROM users');

    for (const u of payload.users || []) {
      const email = String(u.email || '').toLowerCase();
      if (!email) continue;
      await conn.query(
        `INSERT INTO users (
          created_at, name, email, phone, password, role, specialty, description, profile_pic,
          gender, consultation_fee, fee_min, fee_max, practice_details, availability,
          availability_slots, documents, lawyer_status, is_active, deleted_at,
          location, years_of_experience, consultation_duration, booking_options,
          rejection_reason, rejection_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userToRow(u)
      );
    }

    for (const b of payload.bookings || []) {
      if (!b.id) continue;
      await conn.query(
        `INSERT INTO bookings (
          id, lawyer, lawyer_email, name, email, date, time, note, meeting_type,
          status, messages, created_at, acted_at, chat_read_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        bookingToRow(b)
      );
    }

    for (const a of payload.adminActions || []) {
      await conn.query(
        `INSERT INTO admin_actions (external_id, admin_email, action, target_email, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          a.id || '',
          a.adminEmail || '',
          a.action || '',
          a.targetEmail || '',
          a.details || '',
          a.at || new Date().toISOString(),
        ]
      );
    }

    for (const c of payload.aiConversations || []) {
      if (!c.id) continue;
      await conn.query(
        `INSERT INTO ai_conversations (id, user_email, title, messages, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        conversationToRow(c)
      );
    }

    for (const r of payload.lawyerReviews || []) {
      if (!r.id) continue;
      await conn.query(
        `INSERT INTO lawyer_reviews (
          id, lawyer_email, user_email, user_name, rating, comment, booking_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        reviewToRow(r)
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return true;
}

async function insertContact({ name, email, message, createdAt }) {
  const at = createdAt || new Date().toISOString();
  const [result] = await pool.query(
    'INSERT INTO contacts (name, email, message, created_at, is_read) VALUES (?, ?, ?, ?, 0)',
    [String(name || '').trim(), String(email || '').trim(), String(message || '').trim(), at]
  );
  return {
    id: result.insertId,
    name: String(name || '').trim(),
    email: String(email || '').trim(),
    message: String(message || '').trim(),
    createdAt: at,
    isRead: false,
  };
}

async function listContacts({ limit = 200 } = {}) {
  const lim = Math.min(Math.max(1, limit), 500);
  const [rows] = await pool.query(
    'SELECT id, name, email, message, created_at, is_read FROM contacts ORDER BY created_at DESC LIMIT ?',
    [lim]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    message: r.message,
    createdAt: r.created_at ? toIso(r.created_at) : undefined,
    isRead: !!r.is_read,
  }));
}

async function markContactRead(id) {
  const [result] = await pool.query('UPDATE contacts SET is_read = 1 WHERE id = ?', [Number(id)]);
  return result.affectedRows > 0;
}

async function exportJsonBackup(filePath) {
  const state = await loadAllState();
  const contacts = await listContacts({ limit: 500 });
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
