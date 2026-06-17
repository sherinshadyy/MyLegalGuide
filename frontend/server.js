const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const DATA_FILE = path.join(__dirname, 'legalguide-data.json');

function parseLawyerSlotServer(raw){
  let s = String(raw || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\uFEFF/g, '');
  s = s.replace(/(\d{4})\/(\d{2})\/(\d{2})/g, '$1-$2-$3');
  s = s.replace(/,/g, ' ').replace(/\s*T\s*/i, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  let m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
  if(!m){
    const glued = s.match(/^(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}(?::\d{2})?)$/);
    if(glued){
      s = `${glued[1]} ${glued[2]}`;
      m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    }
  }
  if(!m) return { date: '', time: '' };
  const timePart = m[2].trim();
  let tm = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!tm){
    const alt = timePart.match(/^(\d{1,2})\s*:\s*(\d{2})(?::(\d{2}))?\s*$/);
    if(alt) tm = alt;
  }
  if(!tm) return { date: m[1], time: '' };
  const hh = String(parseInt(tm[1], 10)).padStart(2, '0');
  const mm = tm[2];
  return { date: m[1], time: `${hh}:${mm}` };
}

function canonicalSlotKey(date, time){
  const d = String(date || '').trim();
  const st = String(time || '').trim();
  const tm = st.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const normTime = tm ? `${String(parseInt(tm[1], 10)).padStart(2, '0')}:${tm[2]}` : st;
  return `${d} ${normTime}`.trim();
}

function slotAllowed(date, time, allowedSlots){
  const slots = Array.isArray(allowedSlots) ? allowedSlots : [];
  const want = canonicalSlotKey(date, time);
  return slots.some(raw => {
    const p = parseLawyerSlotServer(raw);
    if(!p.date || !p.time) return false;
    return canonicalSlotKey(p.date, p.time) === want;
  });
}

function saveState(){
  try{
    db.saveAllState({ users, bookings, adminActions, aiConversations, lawyerReviews });
    return true;
  } catch(e){
    console.error('saveState', e);
    return false;
  }
}

function loadState(){
  try{
    const data = db.loadAllState();
    if(Array.isArray(data.users) && data.users.length){
      users.splice(0, users.length, ...data.users);
    }
    if(Array.isArray(data.bookings)){
      bookings.splice(0, bookings.length, ...data.bookings);
    }
    if(Array.isArray(data.adminActions)){
      adminActions.splice(0, adminActions.length, ...data.adminActions);
    }
    if(Array.isArray(data.aiConversations)){
      aiConversations.splice(0, aiConversations.length, ...data.aiConversations);
    }
    if(Array.isArray(data.lawyerReviews)){
      lawyerReviews.splice(0, lawyerReviews.length, ...data.lawyerReviews);
    }
  } catch(e){
    console.error('loadState', e);
  }
}

function newConversationId(){
  return String(Date.now()) + Math.random().toString(36).slice(2, 8);
}

function conversationTitleFromMessage(text){
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if(!t) return 'محادثة جديدة';
  return t.length > 42 ? t.slice(0, 42) + '…' : t;
}

function findConversation(id, userEmail){
  return aiConversations.find(c =>
    c.id === id &&
    String(c.userEmail || '').toLowerCase() === String(userEmail || '').toLowerCase()
  );
}

function listConversationsForUser(userEmail){
  return aiConversations
    .filter(c => String(c.userEmail || '').toLowerCase() === String(userEmail || '').toLowerCase())
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

const PORT = process.env.PORT || 3000;
const RAG_API_URL = (process.env.RAG_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_prod';

const PERSONAL_STATUS_SPECIALTIES = [
  'Divorce & Separation',
  'Child Custody',
  'Alimony & Maintenance',
  'Marriage & Engagement',
  'Inheritance & Estate',
  'General Personal Status'
];

function sanitizeProfilePic(value){
  const s = String(value || '').trim();
  if(!s) return '';
  if(s.length > 2800000) return null;
  if(/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
  return '';
}

function normalizeConsultationFee(value){
  if(value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if(!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function normalizeFeeRange(feeMin, feeMax){
  let min = normalizeConsultationFee(feeMin);
  let max = normalizeConsultationFee(feeMax);
  if(min !== null && max !== null && max < min){
    const t = min;
    min = max;
    max = t;
  }
  return { feeMin: min, feeMax: max };
}

function lawyerFeeMin(u){
  if(u.feeMin !== undefined && u.feeMin !== null && u.feeMin !== '') return normalizeConsultationFee(u.feeMin);
  return normalizeConsultationFee(u.consultationFee);
}

function lawyerFeeMax(u){
  return normalizeConsultationFee(u.feeMax);
}

const CONSULTATION_DURATIONS = [15, 30, 45, 60, 90, 120];

function normalizeConsultationDuration(value){
  const n = parseInt(value, 10);
  return CONSULTATION_DURATIONS.includes(n) ? n : null;
}

function normalizeBookingOptions(opts){
  if(!Array.isArray(opts)) return [];
  const allowed = ['online', 'in_person'];
  const seen = new Set();
  const out = [];
  opts.forEach(o=>{
    const key = String(o || '').trim().toLowerCase().replace(/\s+/g, '_');
    const norm = key === 'in-person' || key === 'inperson' ? 'in_person' : key;
    if(allowed.includes(norm) && !seen.has(norm)){
      seen.add(norm);
      out.push(norm);
    }
  });
  return out;
}

function lawyerMatchesPriceFilter(u, minPrice, maxPrice){
  const lMin = lawyerFeeMin(u);
  const lMax = lawyerFeeMax(u);
  if(lMin === null && lMax === null){
    return !Number.isFinite(minPrice) && !Number.isFinite(maxPrice);
  }
  const rangeMin = lMin !== null ? lMin : lMax;
  const rangeMax = lMax !== null ? lMax : lMin;
  if(Number.isFinite(minPrice) && rangeMax !== null && rangeMax < minPrice) return false;
  if(Number.isFinite(maxPrice) && rangeMin !== null && rangeMin > maxPrice) return false;
  return true;
}

function normalizePhone(phone){
  let s = String(phone || '').trim().replace(/[\s\-().]/g, '');
  if(!s) return '';
  if(s.startsWith('+')) s = '+' + s.slice(1).replace(/\D/g, '');
  else s = s.replace(/\D/g, '');
  return s;
}

function findUserByPhone(phone){
  const p = normalizePhone(phone);
  if(!p) return null;
  return users.find(u => normalizePhone(u.phone) === p && !u.deletedAt) || null;
}

function findUserByIdentifier(identifier){
  const raw = String(identifier || '').trim();
  if(!raw) return null;
  if(raw.includes('@')) return findUserByEmail(raw);
  return findUserByPhone(raw);
}

function latestRejectionReasonForUser(user){
  const stored = String((user && user.rejectionReason) || '').trim();
  if(stored) return stored;
  const email = String((user && user.email) || '').toLowerCase();
  for(let i = adminActions.length - 1; i >= 0; i--){
    const a = adminActions[i];
    if(a.action === 'reject_lawyer' && String(a.targetEmail || '').toLowerCase() === email){
      const details = String(a.details || '').trim();
      if(details) return details;
    }
  }
  return '';
}

function accountUserFields(user){
  const isLawyer = (user.role || '').toLowerCase().startsWith('law');
  const rejectionReason = isLawyer ? latestRejectionReasonForUser(user) : (user.rejectionReason || '');
  return {
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    profilePic: user.profilePic || '',
    lawyerStatus: user.lawyerStatus || '',
    rejectionReason,
    rejectionAt: user.rejectionAt || '',
    specialty: user.specialty || '',
    isActive: user.isActive !== false
  };
}

function lawyerAccountExtras(user){
  if(!user || !(user.role || '').toLowerCase().startsWith('law')) return {};
  return {
    description: user.description || '',
    gender: user.gender || '',
    practiceDetails: user.practiceDetails || '',
    feeMin: lawyerFeeMin(user),
    feeMax: lawyerFeeMax(user),
    consultationFee: lawyerFeeMin(user),
    availability: user.availability || '',
    availabilitySlots: Array.isArray(user.availabilitySlots) ? user.availabilitySlots : [],
    documents: Array.isArray(user.documents) ? user.documents : [],
    location: user.location || '',
    yearsOfExperience: user.yearsOfExperience != null ? user.yearsOfExperience : null,
    consultationDuration: normalizeConsultationDuration(user.consultationDuration),
    bookingOptions: normalizeBookingOptions(user.bookingOptions)
  };
}

function getLawyerReviewStats(lawyerEmail){
  const email = String(lawyerEmail || '').toLowerCase();
  const list = lawyerReviews.filter(r => (r.lawyerEmail || '').toLowerCase() === email);
  if(!list.length) return { ratingAverage: 0, ratingCount: 0 };
  const sum = list.reduce((acc, r) => acc + Math.min(5, Math.max(1, Number(r.rating) || 0)), 0);
  const ratingCount = list.length;
  const ratingAverage = Math.round((sum / ratingCount) * 10) / 10;
  return { ratingAverage, ratingCount };
}

function publicLawyerFields(u, availabilitySlotsOverride){
  const slots = availabilitySlotsOverride !== undefined
    ? availabilitySlotsOverride
    : (Array.isArray(u.availabilitySlots) ? u.availabilitySlots : []);
  const stats = getLawyerReviewStats(u.email);
  return {
    name: u.name,
    email: u.email,
    specialty: u.specialty || 'General Personal Status',
    description: u.description || '',
    profilePic: u.profilePic || '',
    gender: u.gender || '',
    practiceDetails: u.practiceDetails || '',
    feeMin: lawyerFeeMin(u),
    feeMax: lawyerFeeMax(u),
    consultationFee: lawyerFeeMin(u),
    phone: u.phone || '',
    location: String(u.location || '').trim(),
    yearsOfExperience: (() => {
      if(u.yearsOfExperience == null || u.yearsOfExperience === '') return null;
      const y = parseInt(u.yearsOfExperience, 10);
      return Number.isFinite(y) && y >= 0 ? Math.min(80, y) : null;
    })(),
    consultationDuration: normalizeConsultationDuration(u.consultationDuration),
    bookingOptions: normalizeBookingOptions(u.bookingOptions),
    availability: u.availability || '',
    availabilitySlots: slots,
    ratingAverage: stats.ratingAverage,
    ratingCount: stats.ratingCount
  };
}

function filterAvailableSlotsForLawyer(u){
  return (Array.isArray(u.availabilitySlots) ? u.availabilitySlots : []).filter(slot => {
    const p = parseLawyerSlotServer(slot);
    if(!p.date || !p.time) return false;
    return !bookings.some(b =>
      (b.lawyerEmail || '').toLowerCase() === (u.email || '').toLowerCase() &&
      canonicalSlotKey(b.date, b.time) === canonicalSlotKey(p.date, p.time) &&
      !['cancelled', 'declined'].includes(String(b.status || '').toLowerCase())
    );
  });
}

function findReviewByUserAndLawyer(userEmail, lawyerEmail){
  const u = String(userEmail || '').toLowerCase();
  const l = String(lawyerEmail || '').toLowerCase();
  return lawyerReviews.find(r =>
    (r.userEmail || '').toLowerCase() === u &&
    (r.lawyerEmail || '').toLowerCase() === l
  ) || null;
}

function enrichBookingForClient(book, clientEmail){
  const lawyer = findUserByEmail(book.lawyerEmail);
  const existing = clientEmail ? findReviewByUserAndLawyer(clientEmail, book.lawyerEmail) : null;
  const st = String(book.status || '').toLowerCase();
  const canReview = st === 'accepted' && !!clientEmail;
  return {
    ...book,
    lawyerProfilePic: lawyer ? (lawyer.profilePic || '') : '',
    lawyerSpecialty: lawyer ? (lawyer.specialty || '') : '',
    lawyerGender: lawyer ? (lawyer.gender || '') : '',
    lawyerFeeMin: lawyer ? lawyerFeeMin(lawyer) : null,
    lawyerFeeMax: lawyer ? lawyerFeeMax(lawyer) : null,
    lawyerConsultationFee: lawyer ? lawyerFeeMin(lawyer) : null,
    lawyerPracticeDetails: lawyer ? (lawyer.practiceDetails || '') : '',
    canReview,
    hasReview: !!existing,
    userReviewRating: existing ? existing.rating : null
  };
}

// Simple in-memory users and bookings store (demo only)
const users = [];
const bookings = [];
const adminActions = [];
const aiConversations = [];
const lawyerReviews = [];
const defaultPasswordHash = bcrypt.hashSync('12345678', 8);
users.push(
  {
    name: 'Ahmed Hassan',
    email: 'ahmed.hassan@legalguide.local',
    phone: '+201000000001',
    password: defaultPasswordHash,
    role: 'Lawyer',
    specialty: 'Divorce & Separation',
    description: 'Personal status lawyer focused on divorce and separation cases.',
    profilePic: '',
    gender: 'male',
    consultationFee: 450,
    feeMin: 400,
    feeMax: 600,
    practiceDetails: 'Consultations for divorce filings, settlements, and court representation.',
    availability: '',
    availabilitySlots: [],
    documents: [],
    lawyerStatus: 'approved',
    isActive: true,
    deletedAt: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Sara Ali',
    email: 'sara.ali@legalguide.local',
    phone: '+201000000002',
    password: defaultPasswordHash,
    role: 'Lawyer',
    specialty: 'Child Custody',
    description: 'Specialist in child custody and guardianship under personal status law.',
    profilePic: '',
    gender: 'female',
    consultationFee: 380,
    feeMin: 350,
    feeMax: 500,
    practiceDetails: 'Guidance on custody arrangements, visitation rights, and child support matters.',
    availability: '',
    availabilitySlots: [],
    documents: [],
    lawyerStatus: 'approved',
    isActive: true,
    deletedAt: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Mohamed Kareem',
    email: 'mohamed.kareem@legalguide.local',
    phone: '+201000000003',
    password: defaultPasswordHash,
    role: 'Lawyer',
    specialty: 'Marriage & Engagement',
    description: 'Advises on marriage contracts, engagement disputes, and related personal status matters.',
    profilePic: '',
    gender: 'male',
    consultationFee: 320,
    feeMin: 300,
    feeMax: 450,
    practiceDetails: 'Pre-nuptial agreements, marriage contract review, and engagement disputes.',
    availability: '',
    availabilitySlots: [],
    documents: [],
    lawyerStatus: 'approved',
    isActive: true,
    deletedAt: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Platform Admin',
    email: 'admin@legalguide.local',
    phone: '+201000000099',
    password: defaultPasswordHash,
    role: 'Admin',
    specialty: '',
    description: '',
    profilePic: '',
    availability: '',
    availabilitySlots: [],
    documents: [],
    lawyerStatus: 'approved',
    isActive: true,
    deletedAt: null,
    createdAt: new Date().toISOString()
  }
);

db.initDatabase();
const migration = db.migrateFromJsonIfNeeded(DATA_FILE);
if(migration.migrated){
  console.log('[db] Imported', migration.users || 0, 'users from legalguide-data.json');
}
loadState();
let lawyerProfileFieldsPersisted = false;
users.forEach(u=>{
  if(typeof u.isActive !== 'boolean') u.isActive = true;
  if(typeof u.deletedAt === 'undefined') u.deletedAt = null;
  if(!u.lawyerStatus){
    u.lawyerStatus = (String(u.role || '').toLowerCase().startsWith('law') ? 'pending' : 'approved');
  }
  if(!Array.isArray(u.documents)) u.documents = [];
  if(typeof u.gender === 'undefined') u.gender = '';
  if(typeof u.consultationFee === 'undefined') u.consultationFee = null;
  if(typeof u.feeMin === 'undefined') u.feeMin = lawyerFeeMin(u);
  if(typeof u.feeMax === 'undefined') u.feeMax = null;
  if(typeof u.practiceDetails === 'undefined') u.practiceDetails = '';
  if(typeof u.phone === 'undefined') u.phone = '';
  if((u.role || '').toLowerCase().startsWith('law') && !u.specialty){
    u.specialty = 'General Personal Status';
  }
  if((u.role || '').toLowerCase().startsWith('law')){
    if(typeof u.location !== 'string'){ u.location = ''; lawyerProfileFieldsPersisted = true; }
    if(typeof u.yearsOfExperience === 'undefined'){ u.yearsOfExperience = null; lawyerProfileFieldsPersisted = true; }
    if(typeof u.consultationDuration === 'undefined'){ u.consultationDuration = null; lawyerProfileFieldsPersisted = true; }
    if(!Array.isArray(u.bookingOptions)){ u.bookingOptions = []; lawyerProfileFieldsPersisted = true; }
  }
});
if(lawyerProfileFieldsPersisted) saveState();
if(db.isDbEmpty() && users.length){
  saveState();
  console.log('[db] Seeded default users into SQLite at', db.getDbPath());
}

async function askRagBackend(message, history) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.RAG_API_TIMEOUT_MS || 120000));
  try {
    const ragRes = await fetch(`${RAG_API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: history || [] }),
      signal: controller.signal,
    });
    const data = await ragRes.json().catch(() => ({}));
    if (!ragRes.ok) {
      const detail = data.detail || data.error || ragRes.statusText;
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
      if (ragRes.status === 503 && /loading/i.test(msg)) {
        throw new Error(msg);
      }
      throw new Error(msg);
    }
    return {
      reply: data.reply || '',
      sources: Array.isArray(data.sources) ? data.sources : [],
      documentTitle: data.document_title || null,
      documentText: data.document_text || null,
      generatedDocument: !!data.generated_document,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function optionalAuth(req, _res, next){
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if(!m) return next();
  try{
    const decoded = jwt.verify(m[1], JWT_SECRET);
    const user = findUserByEmail(decoded.email);
    if(user && user.isActive && !user.deletedAt){
      req.user = decoded;
      req.userRecord = user;
    }
  }catch(_e){}
  next();
}

app.get('/api/ai/conversations', verifyToken, (req, res) => {
  const list = listConversationsForUser(req.user.email).map(c => ({
    id: c.id,
    title: c.title || 'محادثة',
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
    preview: (c.messages && c.messages.length)
      ? String(c.messages[c.messages.length - 1].content || '').slice(0, 80)
      : '',
  }));
  res.json({ ok: true, conversations: list });
});

app.get('/api/ai/conversations/:id', verifyToken, (req, res) => {
  const conv = findConversation(req.params.id, req.user.email);
  if(!conv) return res.status(404).json({ ok: false, error: 'Conversation not found' });
  res.json({ ok: true, conversation: conv });
});

app.post('/api/ai/conversations', verifyToken, (req, res) => {
  const id = newConversationId();
  const now = new Date().toISOString();
  const conv = {
    id,
    userEmail: req.user.email,
    title: 'محادثة جديدة',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  aiConversations.push(conv);
  saveState();
  res.json({ ok: true, conversation: conv });
});

app.delete('/api/ai/conversations/:id', verifyToken, (req, res) => {
  const idx = aiConversations.findIndex(c =>
    c.id === req.params.id &&
    String(c.userEmail || '').toLowerCase() === String(req.user.email || '').toLowerCase()
  );
  if(idx < 0) return res.status(404).json({ ok: false, error: 'Not found' });
  aiConversations.splice(idx, 1);
  saveState();
  res.json({ ok: true });
});

async function askRagDocument(text, filename, userNote, jurisdiction, history, pdfBase64) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.RAG_DOC_TIMEOUT_MS || 300000));
  try {
    const ragRes = await fetch(`${RAG_API_URL}/analyze-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text || '',
        pdf_base64: pdfBase64 || '',
        filename: filename || '',
        user_note: userNote || '',
        jurisdiction: jurisdiction || 'مصر',
        history: history || [],
      }),
      signal: controller.signal,
    });
    const data = await ragRes.json().catch(() => ({}));
    if (!ragRes.ok) {
      const detail = data.detail || data.error || ragRes.statusText;
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return { reply: data.reply || '', sources: [] };
  } finally {
    clearTimeout(timeout);
  }
}

app.post('/api/chat/analyze-document', optionalAuth, async (req, res) => {
  const { text, pdfBase64, filename, userNote, jurisdiction, history, conversationId } = req.body || {};
  if ((!text || String(text).trim().length < 20) && !pdfBase64) {
    return res.status(400).json({ error: 'Provide document text or PDF file' });
  }

  const userEmail = req.user && req.user.email;
  let conv = null;
  let chatHistory = Array.isArray(history) ? history : [];

  if (userEmail) {
    if (conversationId) conv = findConversation(conversationId, userEmail);
    if (!conv) {
      const id = newConversationId();
      const now = new Date().toISOString();
      conv = { id, userEmail, title: 'تحليل وثيقة', messages: [], createdAt: now, updatedAt: now };
      aiConversations.push(conv);
    }
    if (conv.messages && conv.messages.length) {
      chatHistory = conv.messages.map(m => ({ role: m.role, content: m.content }));
    }
  }

  const label = filename ? `📎 تحليل وثيقة: ${filename}` : '📎 تحليل وثيقة';
  const now = new Date().toISOString();

  if (conv) {
    if (!conv.messages) conv.messages = [];
    conv.messages.push({ role: 'user', content: label, at: now });
    chatHistory = conv.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  }

  try {
    const result = await askRagDocument(
      text ? String(text).trim() : '',
      filename,
      userNote,
      jurisdiction,
      chatHistory,
      pdfBase64 || ''
    );
    const reply = result.reply || 'No response';

    if (conv) {
      conv.messages.push({ role: 'assistant', content: reply, at: new Date().toISOString() });
      conv.title = filename ? `وثيقة: ${String(filename).slice(0, 30)}` : 'تحليل وثيقة';
      conv.updatedAt = conv.messages[conv.messages.length - 1].at;
      if (conv.messages.length > 40) conv.messages = conv.messages.slice(-40);
      saveState();
    }

    return res.json({
      reply,
      sources: [],
      conversationId: conv ? conv.id : null,
      title: conv ? conv.title : null,
    });
  } catch (err) {
    console.error('Document analysis error', err);
    const msg = err.message || 'Analysis failed';
    return res.status(503).json({ error: msg, reply: `تعذر تحليل الوثيقة: ${msg}` });
  }
});

/** Future server-side STT — wire your provider here (Whisper, Azure, etc.) */
app.post('/api/chat/voice/transcribe', optionalAuth, (req, res) => {
  res.status(501).json({
    ok: false,
    error: 'Voice transcription is not configured yet. Use browser voice input or implement this endpoint.',
    feature: 'voice_stt'
  });
});

app.post('/api/chat', optionalAuth, async (req, res) => {
  const { message, history, conversationId } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Missing message' });
  }

  const userEmail = req.user && req.user.email;
  let conv = null;
  let chatHistory = Array.isArray(history) ? history : [];

  if(userEmail){
    if(conversationId){
      conv = findConversation(conversationId, userEmail);
    }
    if(!conv){
      const id = newConversationId();
      const now = new Date().toISOString();
      conv = {
        id,
        userEmail,
        title: 'محادثة جديدة',
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      aiConversations.push(conv);
    }
    if(conv.messages && conv.messages.length){
      chatHistory = conv.messages.map(m => ({ role: m.role, content: m.content }));
    }
  }

  const trimmed = String(message).trim();
  const now = new Date().toISOString();

  if(conv){
    if(!conv.messages) conv.messages = [];
    conv.messages.push({ role: 'user', content: trimmed, at: now });
    if(conv.messages.filter(m => m.role === 'user').length === 1){
      conv.title = conversationTitleFromMessage(trimmed);
    }
    conv.updatedAt = now;
    chatHistory = conv.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
  }

  try {
    const result = await askRagBackend(trimmed, chatHistory);
    const reply = result.reply || 'No response';

    const docFields = result.documentText
      ? { documentText: result.documentText, documentTitle: result.documentTitle || 'مسودة قانونية' }
      : {};

    if(conv){
      conv.messages.push({
        role: 'assistant',
        content: reply,
        at: new Date().toISOString(),
        ...docFields,
      });
      conv.updatedAt = conv.messages[conv.messages.length - 1].at;
      if(conv.messages.length > 40){
        conv.messages = conv.messages.slice(-40);
      }
      saveState();
    }

    return res.json({
      reply,
      sources: result.sources || [],
      conversationId: conv ? conv.id : null,
      title: conv ? conv.title : null,
      documentTitle: result.documentTitle || null,
      documentText: result.documentText || null,
      generatedDocument: !!result.generatedDocument,
    });
  } catch (err) {
    console.error('RAG API error', err);
    const msg = err.name === 'AbortError'
      ? 'Legal AI is taking too long. Try a shorter question.'
      : (err.message || 'RAG service unavailable');
    const hint = `Start the Python RAG API: cd Final_grad_project && set GROQ_API_KEY=... && python rag_api.py (${RAG_API_URL})`;
    return res.status(503).json({
      error: msg,
      reply: `تعذر الاتصال بمساعد القانون الذكي. ${hint}`,
    });
  }
});

// Health-check route
app.get('/api/health', async (req, res) => {
  let ragOk = false;
  try {
    const r = await fetch(`${RAG_API_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const data = await r.json();
      ragOk = !!data.ok;
    }
  } catch (_e) {
    ragOk = false;
  }
  res.json({ ok: true, rag: ragOk, ragUrl: RAG_API_URL, profileFieldsVersion: 2, database: 'sqlite', dbPath: db.getDbPath() });
});

// Contact form (persisted in SQLite)
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.json({ ok: false, error: 'Missing fields' });
  try {
    const row = db.insertContact({ name, email, message });
    console.log('Contact received', { id: row.id, email: row.email });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/contact', e);
    res.status(500).json({ ok: false, error: 'Could not save contact message' });
  }
});

app.get('/api/lawyers/meta', (_req, res) => {
  res.json({
    ok: true,
    specialties: PERSONAL_STATUS_SPECIALTIES,
    genders: ['male', 'female'],
    profileFieldsVersion: 2
  });
});

app.get('/api/lawyers', (req, res) => {
  const specialtyQ = String(req.query.specialty || '').trim();
  const genderQ = String(req.query.gender || '').trim().toLowerCase();
  const minPrice = parseFloat(req.query.minPrice);
  const maxPrice = parseFloat(req.query.maxPrice);

  let list = users.filter(u =>
    (u.role || '').toLowerCase().startsWith('law') &&
    (u.lawyerStatus || '').toLowerCase() === 'approved' &&
    u.isActive &&
    !u.deletedAt
  );

  if(specialtyQ){
    list = list.filter(u => String(u.specialty || '').toLowerCase() === specialtyQ.toLowerCase());
  }
  if(genderQ === 'male' || genderQ === 'female'){
    list = list.filter(u => String(u.gender || '').toLowerCase() === genderQ);
  }
  if(Number.isFinite(minPrice) || Number.isFinite(maxPrice)){
    list = list.filter(u => lawyerMatchesPriceFilter(u, minPrice, maxPrice));
  }

  const lawyers = list.map(u => publicLawyerFields(u, filterAvailableSlotsForLawyer(u)));
  res.json({ ok: true, lawyers });
});

app.get('/api/lawyers/:email', optionalAuth, (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const u = users.find(x =>
    (x.role || '').toLowerCase().startsWith('law') &&
    (x.email || '').toLowerCase() === email &&
    x.isActive &&
    !x.deletedAt
  );
  if(!u) return res.status(404).json({ ok: false, error: 'Lawyer not found' });
  const isOwner = req.userRecord &&
    (req.userRecord.role || '').toLowerCase().startsWith('law') &&
    (req.userRecord.email || '').toLowerCase() === email;
  const isPublic = (u.lawyerStatus || '').toLowerCase() === 'approved';
  if(!isPublic && !isOwner){
    return res.status(404).json({ ok: false, error: 'Lawyer not found' });
  }
  res.json({ ok: true, lawyer: publicLawyerFields(u, filterAvailableSlotsForLawyer(u)) });
});

app.get('/api/lawyers/:email/reviews', (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const u = users.find(x =>
    (x.role || '').toLowerCase().startsWith('law') &&
    (x.email || '').toLowerCase() === email &&
    (x.lawyerStatus || '').toLowerCase() === 'approved' &&
    x.isActive &&
    !x.deletedAt
  );
  if(!u) return res.status(404).json({ ok: false, error: 'Lawyer not found' });
  const stats = getLawyerReviewStats(email);
  const reviews = lawyerReviews
    .filter(r => (r.lawyerEmail || '').toLowerCase() === email)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 50)
    .map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment || '',
      userName: r.userName || 'Client',
      createdAt: r.createdAt || ''
    }));
  res.json({ ok: true, stats, reviews });
});

app.post('/api/lawyers/:email/reviews', verifyToken, (req, res) => {
  const lawyerEmail = String(req.params.email || '').trim().toLowerCase();
  const userEmail = String(req.user.email || '').toLowerCase();
  const role = String(req.user.role || '').toLowerCase();
  if(role.startsWith('law') || role.startsWith('admin')){
    return res.status(403).json({ ok: false, error: 'Only clients can submit reviews' });
  }
  const lawyer = users.find(x =>
    (x.role || '').toLowerCase().startsWith('law') &&
    (x.email || '').toLowerCase() === lawyerEmail &&
    (x.lawyerStatus || '').toLowerCase() === 'approved' &&
    x.isActive &&
    !x.deletedAt
  );
  if(!lawyer) return res.status(404).json({ ok: false, error: 'Lawyer not found' });

  const rating = Math.round(Number((req.body || {}).rating));
  const comment = String((req.body || {}).comment || '').trim().slice(0, 2000);
  if(!Number.isFinite(rating) || rating < 1 || rating > 5){
    return res.status(400).json({ ok: false, error: 'Rating must be between 1 and 5 stars' });
  }

  const hasAccepted = bookings.some(b =>
    (b.email || '').toLowerCase() === userEmail &&
    (b.lawyerEmail || '').toLowerCase() === lawyerEmail &&
    String(b.status || '').toLowerCase() === 'accepted'
  );
  if(!hasAccepted){
    return res.status(400).json({ ok: false, error: 'You can review after a confirmed consultation with this lawyer' });
  }

  const reviewer = findUserByEmail(userEmail);
  const userName = (reviewer && reviewer.name) || req.user.name || 'Client';
  const bookingId = String((req.body || {}).bookingId || '').trim();
  const now = new Date().toISOString();

  let review = findReviewByUserAndLawyer(userEmail, lawyerEmail);
  if(review){
    review.rating = rating;
    review.comment = comment;
    review.updatedAt = now;
    if(bookingId) review.bookingId = bookingId;
  } else {
    review = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
      lawyerEmail,
      userEmail,
      userName,
      rating,
      comment,
      bookingId: bookingId || '',
      createdAt: now,
      updatedAt: now
    };
    lawyerReviews.push(review);
  }
  if(!saveState()) return res.status(500).json({ ok: false, error: 'Could not save review' });

  const stats = getLawyerReviewStats(lawyerEmail);
  res.json({
    ok: true,
    review: {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt
    },
    stats
  });
});

// Auth helpers
function generateToken(user){
  return jwt.sign({ email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(req, res, next){
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if(!m) return res.status(401).json({ error: 'Missing token' });
  const token = m[1];
  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserByEmail(decoded.email);
    if(!user || user.deletedAt) return res.status(401).json({ error: 'Account not found' });
    if(!user.isActive) return res.status(403).json({ error: 'Account is suspended' });
    req.user = decoded;
    req.userRecord = user;
    next();
  }catch(e){
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function findUserByEmail(email){
  return users.find(u => (u.email || '').toLowerCase() === String(email || '').toLowerCase());
}

function requireAdmin(req, res, next){
  const role = String((req.userRecord && req.userRecord.role) || req.user.role || '').toLowerCase();
  if(!role.startsWith('admin')) return res.status(403).json({ error: 'Admin only' });
  next();
}

function logAdminAction(adminEmail, action, targetEmail, details){
  adminActions.push({
    id: String(Date.now()) + Math.random().toString(36).slice(2,6),
    adminEmail,
    action,
    targetEmail,
    details: details || '',
    at: new Date().toISOString()
  });
  saveState();
}

// Signup / login (server-backed)
app.post('/api/signup', (req, res) => {
  const { name, email, phone, password, role, specialty, description, practiceDetails, feeMin, feeMax, consultationFee, gender, documents } = req.body || {};
  const nameClean = String(name || '').trim();
  const emailClean = String(email || '').trim().toLowerCase();
  const phoneClean = normalizePhone(phone);
  if(!nameClean || !emailClean || !phoneClean || !password) return res.status(400).json({ error: 'Name, email, phone, and password are required' });
  if(users.find(u => u.email.toLowerCase() === emailClean)) return res.status(400).json({ error: 'Email already registered' });
  if(users.find(u => normalizePhone(u.phone) === phoneClean)) return res.status(400).json({ error: 'Phone number already registered' });
  const hashed = bcrypt.hashSync(String(password), 8);
  const requestedRole = String(role || 'User').trim();
  const roleLower = requestedRole.toLowerCase();
  if(roleLower.startsWith('admin')){
    return res.status(403).json({ error: 'Admin accounts cannot be created from signup' });
  }
  const roleClean = roleLower.startsWith('law') ? 'Lawyer' : 'User';
  const isLawyer = roleClean.toLowerCase().startsWith('law');
  const docList = Array.isArray(documents) ? documents.map(d=>String(d || '').trim()).filter(Boolean).slice(0, 30) : [];
  if(isLawyer && !docList.length){
    return res.status(400).json({ error: 'Lawyers must provide at least one credential document (link or file)' });
  }
  const fees = normalizeFeeRange(
    feeMin !== undefined ? feeMin : consultationFee,
    feeMax
  );
  const g = String(gender || '').trim().toLowerCase();
  const user = {
    name: nameClean,
    email: emailClean,
    phone: phoneClean,
    password: hashed,
    role: roleClean,
    specialty: isLawyer ? String(specialty || 'General Personal Status').trim() : (specialty || ''),
    description: isLawyer ? String(description || '').trim() : '',
    practiceDetails: isLawyer ? String(practiceDetails || '').trim() : '',
    profilePic: '',
    gender: (g === 'male' || g === 'female') ? g : '',
    consultationFee: fees.feeMin,
    feeMin: fees.feeMin,
    feeMax: fees.feeMax,
    availability: '',
    availabilitySlots: [],
    documents: docList,
    location: '',
    yearsOfExperience: null,
    consultationDuration: null,
    bookingOptions: [],
    lawyerStatus: isLawyer ? 'pending' : 'approved',
    isActive: true,
    deletedAt: null,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveState();
  const token = generateToken(user);
  res.json({
    ok: true,
    token,
    user: { ...accountUserFields(user), ...lawyerAccountExtras(user) }
  });
});

app.post('/api/login', (req, res) => {
  const identifier = String((req.body || {}).email || (req.body || {}).identifier || '').trim();
  const password = String((req.body || {}).password || '');
  if(!identifier || !password) return res.status(400).json({ error: 'Missing fields' });
  const user = findUserByIdentifier(identifier);
  if(!user || user.deletedAt) return res.status(400).json({ error: 'Invalid credentials' });
  if(!user.isActive) return res.status(403).json({ error: 'Account is suspended' });
  const ok = bcrypt.compareSync(password, user.password);
  if(!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const token = generateToken(user);
  res.json({ ok: true, token, user: { ...accountUserFields(user), ...lawyerAccountExtras(user) } });
});

app.get('/api/me', verifyToken, (req, res) => {
  const user = findUserByEmail(req.user.email);
  if(!user) return res.status(404).json({ ok:false, error: 'User not found' });
  if((user.role || '').toLowerCase().startsWith('law')){
    const recovered = latestRejectionReasonForUser(user);
    if(recovered && !String(user.rejectionReason || '').trim()){
      user.rejectionReason = recovered;
      saveState();
    }
  }
  res.json({
    ok: true,
    user: { ...accountUserFields(user), ...lawyerAccountExtras(user) }
  });
});

app.put('/api/account/profile', verifyToken, (req, res) => {
  try{
    const user = req.userRecord || findUserByEmail(req.user.email);
    if(!user) return res.status(404).json({ ok:false, error: 'User not found' });
    const { name, profilePic } = req.body || {};
    if(name !== undefined){
      const nameClean = String(name || '').trim();
      if(!nameClean) return res.status(400).json({ ok:false, error: 'Name is required' });
      user.name = nameClean;
    }
    if(profilePic !== undefined){
      const pic = sanitizeProfilePic(profilePic);
      if(pic === null) return res.status(400).json({ ok:false, error: 'Profile picture is too large or invalid. Try a smaller image.' });
      user.profilePic = pic;
    }
    if(!saveState()){
      return res.status(500).json({ ok:false, error: 'Could not save profile to disk' });
    }
    res.json({ ok:true, user: accountUserFields(user) });
  } catch(err){
    console.error('PUT /api/account/profile', err);
    res.status(500).json({ ok:false, error: 'Server error while saving profile' });
  }
});

app.put('/api/account/contact', verifyToken, (req, res) => {
  const user = req.userRecord || findUserByEmail(req.user.email);
  if(!user) return res.status(404).json({ ok:false, error: 'User not found' });
  const emailClean = String((req.body || {}).email || '').trim().toLowerCase();
  const phoneClean = normalizePhone((req.body || {}).phone);
  if(!emailClean) return res.status(400).json({ ok:false, error: 'Email is required' });
  if(!phoneClean) return res.status(400).json({ ok:false, error: 'Valid phone number is required' });
  const emailTaken = users.some(u => u !== user && (u.email || '').toLowerCase() === emailClean);
  if(emailTaken) return res.status(400).json({ ok:false, error: 'Email already in use' });
  const phoneTaken = users.some(u => u !== user && normalizePhone(u.phone) === phoneClean);
  if(phoneTaken) return res.status(400).json({ ok:false, error: 'Phone number already in use' });
  user.email = emailClean;
  user.phone = phoneClean;
  saveState();
  const token = generateToken(user);
  res.json({ ok:true, token, user: accountUserFields(user) });
});

app.put('/api/account/password', verifyToken, (req, res) => {
  const user = req.userRecord || findUserByEmail(req.user.email);
  if(!user) return res.status(404).json({ ok:false, error: 'User not found' });
  const currentPassword = String((req.body || {}).currentPassword || '');
  const newPassword = String((req.body || {}).newPassword || '');
  if(!currentPassword || !newPassword) return res.status(400).json({ ok:false, error: 'Current and new password are required' });
  if(newPassword.length < 6) return res.status(400).json({ ok:false, error: 'New password must be at least 6 characters' });
  if(!bcrypt.compareSync(currentPassword, user.password)) return res.status(400).json({ ok:false, error: 'Current password is incorrect' });
  user.password = bcrypt.hashSync(newPassword, 8);
  saveState();
  res.json({ ok:true });
});

app.put('/api/lawyer/profile', verifyToken, (req, res) => {
  try{
  const user = findUserByEmail(req.user.email);
  if(!user) return res.status(404).json({ ok:false, error: 'User not found' });
  if(!user.role || !user.role.toLowerCase().startsWith('law')){
    return res.status(403).json({ ok:false, error: 'Only lawyers allowed' });
  }
  const { specialty, description, practiceDetails, availability, availabilitySlots, documents, gender, consultationFee, feeMin, feeMax, location, yearsOfExperience, consultationDuration, bookingOptions, phone } = req.body || {};
  if(specialty !== undefined) user.specialty = String(specialty || user.specialty || 'General Personal Status').trim();
  if(description !== undefined) user.description = String(description || '').trim();
  if(practiceDetails !== undefined) user.practiceDetails = String(practiceDetails || '').trim();
  if(gender !== undefined){
    const g = String(gender || '').trim().toLowerCase();
    user.gender = (g === 'male' || g === 'female') ? g : '';
  }
  if(feeMin !== undefined || feeMax !== undefined || consultationFee !== undefined){
    const fees = normalizeFeeRange(
      feeMin !== undefined ? feeMin : (consultationFee !== undefined ? consultationFee : user.feeMin),
      feeMax !== undefined ? feeMax : user.feeMax
    );
    user.feeMin = fees.feeMin;
    user.feeMax = fees.feeMax;
    user.consultationFee = fees.feeMin;
  }
  if(availability !== undefined) user.availability = String(availability || '').trim();
  if(Array.isArray(availabilitySlots)){
    const flat = [];
    availabilitySlots.forEach(s=>{
      String(s || '').split(/[,;\n\r]+/).forEach(part=>{
        const raw = part.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/\s+/g, ' ');
        if(raw) flat.push(raw);
      });
    });
    user.availabilitySlots = flat.map(raw=>{
      const p = parseLawyerSlotServer(raw);
      if(p.date && p.time) return canonicalSlotKey(p.date, p.time);
      return raw;
    }).filter(Boolean).slice(0, 100);
  }
  if(Array.isArray(documents)){
    user.documents = documents.map(d=>String(d || '').trim()).filter(Boolean).slice(0, 30);
  }
  if(location !== undefined) user.location = String(location || '').trim().slice(0, 200);
  if(yearsOfExperience !== undefined){
    const raw = typeof yearsOfExperience === 'number'
      ? String(yearsOfExperience)
      : String(yearsOfExperience ?? '').trim();
    if(raw === '') user.yearsOfExperience = null;
    else {
      const y = parseInt(raw, 10);
      user.yearsOfExperience = Number.isFinite(y) && y >= 0 ? Math.min(80, y) : null;
    }
  }
  if(consultationDuration !== undefined){
    const d = typeof consultationDuration === 'number'
      ? consultationDuration
      : (String(consultationDuration ?? '').trim() === '' ? '' : consultationDuration);
    user.consultationDuration = normalizeConsultationDuration(d);
  }
  if(bookingOptions !== undefined){
    user.bookingOptions = normalizeBookingOptions(bookingOptions);
  }
  if(phone !== undefined){
    const p = normalizePhone(phone);
    if(!p && String(phone || '').trim()) {
      return res.status(400).json({ ok:false, error: 'Valid phone number is required' });
    }
    if(p){
      const taken = users.some(u => u !== user && normalizePhone(u.phone) === p);
      if(taken) return res.status(400).json({ ok:false, error: 'Phone number already in use' });
    }
    user.phone = p;
  }
  const practiceReviewTouched =
    specialty !== undefined || description !== undefined || practiceDetails !== undefined ||
    gender !== undefined || feeMin !== undefined || feeMax !== undefined || consultationFee !== undefined;
  if(practiceReviewTouched){
    const st = String(user.lawyerStatus || '').toLowerCase();
    if(st === 'approved' || st === 'rejected' || !st){
      user.lawyerStatus = 'pending';
      if(st === 'approved'){
        user.rejectionReason = '';
        user.rejectionAt = '';
      }
    }
  }
  if(!saveState()){
    return res.status(500).json({ ok:false, error: 'Could not save profile' });
  }
  res.json({
    ok:true,
    user: { ...accountUserFields(user), ...lawyerAccountExtras(user) }
  });
  } catch(err){
    console.error('PUT /api/lawyer/profile', err);
    res.status(500).json({ ok:false, error: 'Server error while saving profile' });
  }
});

// Bookings: create, list, accept, decline (server-backed)
app.post('/api/book', verifyToken, (req, res) => {
  const { lawyer, lawyerEmail, date, time, note, meetingType } = req.body || {};
  if(!lawyer || !date || !time) return res.status(400).json({ ok: false, error: 'Missing fields' });
  const mtRaw = String(meetingType || '').trim().toLowerCase().replace(/\s+/g, '_');
  const meetingNorm = (mtRaw === 'in-person' || mtRaw === 'inperson') ? 'in_person' : mtRaw;
  let selectedLawyer = null;
  if(lawyerEmail){
    selectedLawyer = users.find(u =>
      (u.role || '').toLowerCase().startsWith('law') &&
      u.email.toLowerCase() === String(lawyerEmail).toLowerCase()
    );
  }
  if(!selectedLawyer){
    selectedLawyer = users.find(u =>
      (u.role || '').toLowerCase().startsWith('law') &&
      u.name.toLowerCase() === String(lawyer).toLowerCase()
    );
  }
  if(!selectedLawyer) return res.status(400).json({ ok: false, error: 'Selected lawyer not found' });
  const lawyerBookingOpts = normalizeBookingOptions(selectedLawyer.bookingOptions);
  if(meetingNorm && !['online', 'in_person'].includes(meetingNorm)){
    return res.status(400).json({ ok: false, error: 'Invalid meeting type' });
  }
  if(meetingNorm && lawyerBookingOpts.length && !lawyerBookingOpts.includes(meetingNorm)){
    return res.status(400).json({ ok: false, error: 'This lawyer does not offer that meeting type' });
  }
  if((selectedLawyer.lawyerStatus || '').toLowerCase() !== 'approved' || !selectedLawyer.isActive || selectedLawyer.deletedAt){
    return res.status(400).json({ ok: false, error: 'This lawyer is not currently available for booking' });
  }
  const allowedSlots = Array.isArray(selectedLawyer.availabilitySlots) ? selectedLawyer.availabilitySlots : [];
  if(!allowedSlots.length){
    return res.status(400).json({ ok: false, error: 'Lawyer has not published available times yet' });
  }
  if(!slotAllowed(date, time, allowedSlots)){
    return res.status(400).json({ ok: false, error: 'This time is not in lawyer availability' });
  }
  const requestedKey = canonicalSlotKey(date, time);
  const alreadyBooked = bookings.some(b =>
    (b.lawyerEmail || '').toLowerCase() === (selectedLawyer.email || '').toLowerCase() &&
    canonicalSlotKey(b.date, b.time) === requestedKey &&
    !['cancelled', 'declined'].includes(String(b.status || '').toLowerCase())
  );
  if(alreadyBooked){
    return res.status(409).json({ ok: false, error: 'This slot was just booked. Please choose another time.' });
  }

  const parsed = parseLawyerSlotServer(`${String(date).trim()} ${String(time).trim()}`);
  const dateNorm = parsed.date || date;
  const timeNorm = parsed.time || time;

  const id = String(Date.now()) + Math.random().toString(36).slice(2,8);
  const book = {
    id,
    lawyer: selectedLawyer.name,
    lawyerEmail: selectedLawyer.email,
    name: req.user.name,
    email: req.user.email,
    date: dateNorm,
    time: timeNorm,
    note,
    meetingType: meetingNorm || (lawyerBookingOpts.length === 1 ? lawyerBookingOpts[0] : ''),
    status: 'pending',
    messages: [],
    createdAt: new Date().toISOString()
  };
  bookings.push(book);
  saveState();
  console.log('Booking created', book);
  res.json({ ok: true, booking: book });
});

app.get('/api/bookings', verifyToken, (req, res) => {
  if(req.user.role && req.user.role.toLowerCase().startsWith('admin')){
    return res.json({ ok:true, bookings });
  }
  if(req.user.role && req.user.role.toLowerCase().startsWith('law')){
    const mine = bookings.filter(b => (b.lawyerEmail||'').toLowerCase() === (req.user.email||'').toLowerCase());
    return res.json({ ok:true, bookings: mine });
  }
  const clientEmail = (req.user.email || '').toLowerCase();
  const mine = bookings.filter(b => (b.email||'').toLowerCase() === clientEmail)
    .map(b => enrichBookingForClient(b, clientEmail));
  res.json({ ok:true, bookings: mine });
});

app.post('/api/book/:id/accept', verifyToken, (req, res) => {
  const id = req.params.id;
  const book = bookings.find(b=>b.id===id);
  if(!book) return res.status(404).json({ error: 'Not found' });
  if(!req.user.role || !req.user.role.toLowerCase().startsWith('law')) return res.status(403).json({ error: 'Only lawyers allowed' });
  if((req.user.email||'').toLowerCase() !== (book.lawyerEmail||'').toLowerCase()) return res.status(403).json({ error: 'Not your booking' });
  book.status = 'accepted';
  book.actedAt = new Date().toISOString();
  saveState();
  res.json({ ok:true, booking: book });
});

app.post('/api/book/:id/decline', verifyToken, (req, res) => {
  const id = req.params.id;
  const book = bookings.find(b=>b.id===id);
  if(!book) return res.status(404).json({ error: 'Not found' });
  if(!req.user.role || !req.user.role.toLowerCase().startsWith('law')) return res.status(403).json({ error: 'Only lawyers allowed' });
  if((req.user.email||'').toLowerCase() !== (book.lawyerEmail||'').toLowerCase()) return res.status(403).json({ error: 'Not your booking' });
  book.status = 'declined';
  book.actedAt = new Date().toISOString();
  saveState();
  res.json({ ok:true, booking: book });
});

app.post('/api/book/:id/cancel', verifyToken, (req, res) => {
  const id = req.params.id;
  const book = bookings.find(b=>b.id===id);
  if(!book) return res.status(404).json({ error: 'Not found' });
  if((book.email||'').toLowerCase() !== (req.user.email||'').toLowerCase()){
    return res.status(403).json({ error: 'Not your appointment' });
  }
  if(book.status === 'cancelled'){
    return res.json({ ok:true, booking: book });
  }
  book.status = 'cancelled';
  book.actedAt = new Date().toISOString();
  book.cancelledBy = req.user.email;
  console.log('Booking cancelled', { id: book.id, by: req.user.email, lawyer: book.lawyerEmail });
  saveState();
  res.json({ ok:true, booking: book });
});

app.post('/api/book/:id/cancel-by-lawyer', verifyToken, (req, res) => {
  const id = req.params.id;
  const book = bookings.find(b=>b.id===id);
  if(!book) return res.status(404).json({ error: 'Not found' });
  if(!req.user.role || !req.user.role.toLowerCase().startsWith('law')) return res.status(403).json({ error: 'Only lawyers allowed' });
  if((req.user.email||'').toLowerCase() !== (book.lawyerEmail||'').toLowerCase()) return res.status(403).json({ error: 'Not your booking' });
  book.status = 'cancelled';
  book.actedAt = new Date().toISOString();
  book.cancelledBy = req.user.email;
  saveState();
  res.json({ ok:true, booking: book });
});

function canAccessBooking(reqUser, booking){
  const email = (reqUser.email || '').toLowerCase();
  const role = (reqUser.role || '').toLowerCase();
  // Privacy rule: admin must not access lawyer-user private chats.
  if(role.startsWith('admin')) return false;
  if(email === (booking.email || '').toLowerCase()) return true;
  if(email === (booking.lawyerEmail || '').toLowerCase()) return true;
  return false;
}

app.get('/api/book/:id/messages', verifyToken, (req, res) => {
  const book = bookings.find(b=>b.id===req.params.id);
  if(!book) return res.status(404).json({ ok:false, error: 'Not found' });
  if(!canAccessBooking(req.user, book)) return res.status(403).json({ ok:false, error: 'Forbidden' });
  res.json({ ok:true, messages: Array.isArray(book.messages) ? book.messages : [] });
});

app.post('/api/book/:id/message', verifyToken, (req, res) => {
  const book = bookings.find(b=>b.id===req.params.id);
  if(!book) return res.status(404).json({ ok:false, error: 'Not found' });
  if(!canAccessBooking(req.user, book)) return res.status(403).json({ ok:false, error: 'Forbidden' });
  const text = String((req.body || {}).text || '').trim();
  if(!text) return res.status(400).json({ ok:false, error: 'Message is required' });
  const user = findUserByEmail(req.user.email);
  if(!Array.isArray(book.messages)) book.messages = [];
  const msg = {
    id: String(Date.now()) + Math.random().toString(36).slice(2,6),
    senderEmail: req.user.email,
    senderName: user ? user.name : req.user.email,
    text,
    at: new Date().toISOString()
  };
  book.messages.push(msg);
  saveState();
  res.json({ ok:true, message: msg });
});

// ---------------- Admin APIs ----------------
app.get('/api/admin/users', verifyToken, requireAdmin, (_req, res) => {
  const list = users.map(u => ({
    name: u.name,
    email: u.email,
    role: u.role,
    lawyerStatus: u.lawyerStatus || '',
    isActive: u.isActive !== false,
    deletedAt: u.deletedAt || null,
    createdAt: u.createdAt || null
  }));
  res.json({ ok: true, users: list });
});

app.get('/api/admin/lawyer-applications', verifyToken, requireAdmin, (_req, res) => {
  const pending = users
    .filter(u => (u.role || '').toLowerCase().startsWith('law') && (u.lawyerStatus || '').toLowerCase() === 'pending' && !u.deletedAt)
    .map(u => ({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      specialty: u.specialty || '',
      description: u.description || '',
      practiceDetails: u.practiceDetails || '',
      gender: u.gender || '',
      feeMin: lawyerFeeMin(u),
      feeMax: lawyerFeeMax(u),
      profilePic: u.profilePic || '',
      documents: Array.isArray(u.documents) ? u.documents : [],
      createdAt: u.createdAt || null
    }));
  res.json({ ok: true, applications: pending });
});

app.post('/api/admin/lawyers/:email/approve', verifyToken, requireAdmin, (req, res) => {
  const email = String(req.params.email || '').toLowerCase();
  const user = findUserByEmail(email);
  if(!user || user.deletedAt) return res.status(404).json({ ok:false, error: 'User not found' });
  if(!(user.role || '').toLowerCase().startsWith('law')) return res.status(400).json({ ok:false, error: 'Not a lawyer account' });
  user.lawyerStatus = 'approved';
  user.isActive = true;
  user.rejectionReason = '';
  user.rejectionAt = '';
  saveState();
  logAdminAction(req.user.email, 'approve_lawyer', user.email, '');
  res.json({ ok: true, user: { email: user.email, lawyerStatus: user.lawyerStatus, rejectionReason: '' } });
});

app.post('/api/admin/lawyers/:email/reject', verifyToken, requireAdmin, (req, res) => {
  const email = String(req.params.email || '').toLowerCase();
  const reason = String((req.body || {}).reason || '').trim();
  if(!reason) return res.status(400).json({ ok:false, error: 'Rejection reason is required so the lawyer knows what to fix' });
  const user = findUserByEmail(email);
  if(!user || user.deletedAt) return res.status(404).json({ ok:false, error: 'User not found' });
  if(!(user.role || '').toLowerCase().startsWith('law')) return res.status(400).json({ ok:false, error: 'Not a lawyer account' });
  user.lawyerStatus = 'rejected';
  user.rejectionReason = reason;
  user.rejectionAt = new Date().toISOString();
  user.isActive = true;
  saveState();
  logAdminAction(req.user.email, 'reject_lawyer', user.email, reason);
  res.json({ ok: true, user: { email: user.email, lawyerStatus: user.lawyerStatus, rejectionReason: user.rejectionReason } });
});

app.post('/api/admin/users/:email/toggle-active', verifyToken, requireAdmin, (req, res) => {
  const email = String(req.params.email || '').toLowerCase();
  const user = findUserByEmail(email);
  if(!user || user.deletedAt) return res.status(404).json({ ok:false, error: 'User not found' });
  if((user.role || '').toLowerCase().startsWith('admin') && user.email.toLowerCase() === String(req.user.email || '').toLowerCase()){
    return res.status(400).json({ ok:false, error: 'Admin cannot suspend self' });
  }
  user.isActive = !(user.isActive !== false);
  saveState();
  logAdminAction(req.user.email, user.isActive ? 'unsuspend_user' : 'suspend_user', user.email, '');
  res.json({ ok: true, user: { email: user.email, isActive: user.isActive } });
});

app.delete('/api/admin/users/:email', verifyToken, requireAdmin, (req, res) => {
  const email = String(req.params.email || '').toLowerCase();
  const user = findUserByEmail(email);
  if(!user || user.deletedAt) return res.status(404).json({ ok:false, error: 'User not found' });
  if((user.role || '').toLowerCase().startsWith('admin')){
    return res.status(400).json({ ok:false, error: 'Cannot delete admin account' });
  }
  user.deletedAt = new Date().toISOString();
  user.isActive = false;
  saveState();
  logAdminAction(req.user.email, 'soft_delete_user', user.email, '');
  res.json({ ok: true });
});

app.get('/api/admin/actions', verifyToken, requireAdmin, (_req, res) => {
  res.json({ ok: true, actions: adminActions.slice().reverse().slice(0, 200) });
});

app.get('/api/admin/contacts', verifyToken, requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 200;
    const contacts = db.listContacts({ limit });
    res.json({ ok: true, contacts });
  } catch (e) {
    console.error('GET /api/admin/contacts', e);
    res.status(500).json({ ok: false, error: 'Could not load contacts' });
  }
});

app.patch('/api/admin/contacts/:id/read', verifyToken, requireAdmin, (req, res) => {
  try {
    const ok = db.markContactRead(req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Contact not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/admin/contacts/:id/read', e);
    res.status(500).json({ ok: false, error: 'Could not update contact' });
  }
});

// Static files last so /api/* routes are never shadowed
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${db.getDbPath()}`);
  console.log(`Lawyer profile fields API version: 2 (location, experience, booking options)`);
});
