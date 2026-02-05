/**
 * Vasteroids Global Scoreboard Server (Postgres)
 *
 * Express server + WebSocket for real-time score updates.
 * Persists scores in Postgres for real durability + multi-instance scalability.
 *
 * Local dev:
 *  - Start Postgres via ../docker-compose.yml
 *  - DATABASE_URL defaults to local Postgres if not set
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_SCORES = 100;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ALLOWED_ACHIEVEMENT_ICONS = {
  'assets/Badge_Data_Engineer_20.png': true,
  'assets/Badge_Petabyte_Architect_40.png': true,
  'assets/Badge_Exabyte_Legend_60.png': true,
  // legacy emoji entries
  '🧪': true,
  '🏗️': true,
  '👑': true
};

function normalizeAchievementIcon(icon) {
  if (!icon) return null;
  if (icon === '🧪') return 'assets/Badge_Data_Engineer_20.png';
  if (icon === '🏗️') return 'assets/Badge_Petabyte_Architect_40.png';
  if (icon === '👑') return 'assets/Badge_Exabyte_Legend_60.png';
  return icon;
}

const DEFAULT_DATABASE_URL = 'postgresql://vasteroids:vasteroids@localhost:5432/vasteroids';
const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const IS_PROD = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false
});

function parseCorsOrigins(value) {
  const raw = (value || '').trim();
  if (!raw || raw === '*') return '*';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function buildCorsOptions() {
  const origins = parseCorsOrigins(process.env.CORS_ORIGIN || '*');
  if (origins === '*') return { origin: true };
  return {
    origin: function(origin, cb) {
      // Allow non-browser tools / same-origin requests
      if (!origin) return cb(null, true);
      if (origins.indexOf(origin) !== -1) return cb(null, true);
      return cb(new Error('CORS blocked for origin: ' + origin));
    }
  };
}

function normalizeName(input) {
  const name = String(input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
  return name || 'ACE';
}

function normalizeScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 0) return null;
  // Safety cap (prevents abuse / accidental huge numbers)
  return Math.min(i, 2_000_000_000);
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function generatePlaceholderEntries(count) {
  const namePool = [
    'NOVA', 'ACE', 'BLAZE', 'ORION', 'PULSE', 'DRIFT', 'KITE', 'ZEN', 'LUNA', 'VAST',
    'ECHO', 'BYTE', 'NEON', 'SOL', 'RIFT', 'STAR', 'VORTEX', 'NIMBUS', 'ION', 'FLUX'
  ];

  const entries = [];
  // "Intermediate" distribution: strong top, smooth mid, long tail.
  // Deterministic-ish per process: seed from current day.
  const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  function rand() {
    // xorshift32
    let x = (daySeed ^ (entries.length * 2654435761)) >>> 0;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    return (x >>> 0) / 4294967296;
  }

  let score = 220000 + Math.floor(rand() * 40000);
  for (let i = 0; i < count; i++) {
    const baseName = namePool[i % namePool.length];
    const suffix = (i >= namePool.length) ? ('' + (i % 10)) : '';
    const name = (baseName + suffix).substring(0, 10);

    // Decrease with a ratio, add small noise
    const ratio = 0.86 + (rand() * 0.08); // 0.86 - 0.94
    score = Math.max(250, Math.floor(score * ratio - (rand() * 1200)));
    if (i === 0) score = Math.max(score, 180000);
    if (i === 9) score = Math.min(score, 35000);

    entries.push({
      id: makeId(),
      client_submission_id: null,
      name,
      score,
      placeholder: true,
      created_at: new Date(Date.now() - (count - i) * 60 * 1000).toISOString()
    });
  }

  return entries;
}

function requireAdmin(req, res, next) {
  // If no token configured, restrict admin routes to localhost only
  if (!ADMIN_TOKEN) {
    var host = (req.ip || '').toString();
    if (host === '127.0.0.1' || host === '::1' || host.endsWith('127.0.0.1')) {
      return next();
    }
    return res.status(401).json({ error: 'Admin token required' });
  }

  var token = req.get('x-admin-token') || req.query.token || '';
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
  return next();
}

async function applySchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

async function getTopScores(limit) {
  const { rows } = await pool.query(
    `SELECT id, name, score,
            achievement_icon AS "achievementIcon",
            achievement_icon AS "achievement_icon",
            created_at AS timestamp
     FROM scores
     ORDER BY score DESC, created_at ASC, id ASC
     LIMIT $1`,
    [limit]
  );
  return rows.map(row => {
    const normalized = normalizeAchievementIcon(row.achievementIcon || row.achievement_icon || null);
    row.achievementIcon = normalized;
    row.achievement_icon = normalized;
    return row;
  });
}

async function countScores() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM scores');
  return rows[0] ? rows[0].count : 0;
}

async function seedPlaceholdersIfNeeded() {
  const existing = await countScores();
  const needed = Math.max(0, MAX_SCORES - existing);
  if (needed <= 0) return;

  const placeholders = generatePlaceholderEntries(needed);
  const values = [];
  const params = [];
  let p = 1;
  for (const e of placeholders) {
    values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
    params.push(e.id, e.client_submission_id, e.name, e.score, null, e.placeholder, e.created_at);
  }

  await pool.query(
    `INSERT INTO scores (id, client_submission_id, name, score, achievement_icon, placeholder, created_at)
     VALUES ${values.join(',')}
     ON CONFLICT (id) DO NOTHING`,
    params
  );

  console.log(`[DB] Seeded ${needed} placeholder scores`);
}

async function resetScoresToDefault() {
  await pool.query('BEGIN');
  try {
    await pool.query('DELETE FROM scores');
    const placeholders = generatePlaceholderEntries(MAX_SCORES);
    const values = [];
    const params = [];
    let p = 1;
    for (const e of placeholders) {
      values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(e.id, e.client_submission_id, e.name, e.score, null, e.placeholder, e.created_at);
    }
    await pool.query(
      `INSERT INTO scores (id, client_submission_id, name, score, achievement_icon, placeholder, created_at)
       VALUES ${values.join(',')}`,
      params
    );
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
}

async function insertScore({ name, score, clientSubmissionId, achievementIcon }) {
  const id = makeId();
  const createdAt = new Date().toISOString();

  const normalizedIcon = normalizeAchievementIcon(achievementIcon);
  const icon = ALLOWED_ACHIEVEMENT_ICONS[normalizedIcon] ? normalizedIcon : null;

  const { rows } = await pool.query(
    `INSERT INTO scores (id, client_submission_id, name, score, achievement_icon, placeholder, created_at)
     VALUES ($1, $2, $3, $4, $5, false, $6)
     ON CONFLICT (client_submission_id) DO UPDATE SET
       name = EXCLUDED.name,
       score = EXCLUDED.score,
       achievement_icon = EXCLUDED.achievement_icon,
       placeholder = false
     RETURNING id, name, score,
               achievement_icon AS "achievementIcon",
               achievement_icon AS "achievement_icon",
               created_at AS timestamp`,
    [id, clientSubmissionId || null, name, score, icon, createdAt]
  );

  return rows[0];
}

async function computeRankForInserted(entry) {
  // Rank semantics: score DESC, created_at ASC, id ASC.
  // This yields "new equal scores go below existing equals".
  const { rows } = await pool.query(
    `SELECT 1 + COUNT(*)::int AS rank
     FROM scores
     WHERE (score > $1)
        OR (score = $1 AND created_at < $2)
        OR (score = $1 AND created_at = $2 AND id < $3)`,
    [entry.score, entry.timestamp, entry.id]
  );
  return rows[0] ? rows[0].rank : 1;
}

async function computeRankPreview(score) {
  // Preview semantics used by the original JSON server: rank goes AFTER equals.
  const { rows } = await pool.query(
    `SELECT 1 + COUNT(*)::int AS rank
     FROM scores
     WHERE score >= $1`,
    [score]
  );
  return rows[0] ? rows[0].rank : 1;
}

// Middleware
app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '16kb' }));

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.SCORE_POST_MAX_PER_MIN || '60', 10),
  standardHeaders: true,
  legacyHeaders: false
});

// Health check for Render
app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false });
  }
});

// Admin moderation endpoints
app.get('/admin/scores', requireAdmin, async (req, res) => {
  try {
    const scores = await getTopScores(MAX_SCORES);
    res.json({ scores });
  } catch (err) {
    console.error('Error fetching admin scores:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

app.delete('/admin/scores/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query('DELETE FROM scores WHERE id = $1', [id]);
    const scores = await getTopScores(MAX_SCORES);
    res.json({ success: true, scores });
  } catch (err) {
    console.error('Error deleting score:', err);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

app.post('/admin/scores/reset', requireAdmin, async (req, res) => {
  try {
    await resetScoresToDefault();
    const scores = await getTopScores(MAX_SCORES);
    res.json({ success: true, scores });
  } catch (err) {
    console.error('Error resetting scores:', err);
    res.status(500).json({ error: 'Failed to reset scores' });
  }
});

// GET /api/scores - Fetch top 100
app.get('/api/scores', async (req, res) => {
  try {
    const scores = await getTopScores(MAX_SCORES);
    res.json({ scores });
  } catch (err) {
    console.error('Error fetching scores:', err);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// POST /api/scores - Add a new score
app.post('/api/scores', postLimiter, async (req, res) => {
  try {
    const name = normalizeName(req.body && req.body.name);
    const score = normalizeScore(req.body && req.body.score);
    const clientSubmissionId = req.body && req.body.clientSubmissionId ? String(req.body.clientSubmissionId) : null;
    const achievementIcon = req.body && req.body.achievementIcon ? String(req.body.achievementIcon) : null;

    if (score === null) {
      return res.status(400).json({ error: 'Invalid data. Required: name (string), score (number)' });
    }

    const entry = await insertScore({ name, score, clientSubmissionId, achievementIcon });
    const rank = await computeRankForInserted(entry);

    // Always return top 100 payload (stable size for clients)
    const scores = await getTopScores(MAX_SCORES);

    // Broadcast to all WebSocket clients
    broadcastNewScore(entry, scores);

    res.json({
      success: true,
      entry,
      rank,
      scores
    });
  } catch (err) {
    console.error('Error submitting score:', err);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// GET /api/scores/rank/:score - Get rank for a score without submitting
app.get('/api/scores/rank/:score', async (req, res) => {
  const score = parseInt(req.params.score, 10);
  if (isNaN(score)) {
    return res.status(400).json({ error: 'Invalid score' });
  }

  try {
    const rank = await computeRankPreview(score);
    res.json({ score, rank, isTop100: rank <= MAX_SCORES });
  } catch (err) {
    console.error('Error computing rank preview:', err);
    res.status(500).json({ error: 'Failed to compute rank' });
  }
});

// Optional: serve the game frontend from the same Render web service.
// This makes the frontend work out-of-the-box on Render without needing a separate static site.
// It also keeps API calls same-origin when you open https://<service>.onrender.com/index.html
const REPO_ROOT = path.join(__dirname, '..');

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.use((req, res, next) => {
  // Avoid exposing server source/config via static hosting.
  const p = req.path || '';
  if (p === '/server' || p.indexOf('/server/') === 0) return res.status(404).end();
  return next();
});

app.use(express.static(REPO_ROOT, {
  index: false,
  dotfiles: 'ignore',
  maxAge: IS_PROD ? '1h' : 0
}));

// Create HTTP server
const server = http.createServer(app);

// WebSocket server on same port
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Set();

wss.on('connection', async (ws) => {
  clients.add(ws);
  console.log(`Client connected. Total: ${clients.size}`);

  try {
    const scores = await getTopScores(MAX_SCORES);
    ws.send(JSON.stringify({ type: 'init', scores }));
  } catch (err) {
    console.error('Error sending WS init:', err);
    try { ws.send(JSON.stringify({ type: 'init', scores: [] })); } catch (e) {}
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected. Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    clients.delete(ws);
  });
});

// Broadcast new score to all clients
function broadcastNewScore(entry, scores) {
  const message = JSON.stringify({
    type: 'new_score',
    entry,
    scores
  });

  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

async function boot() {
  try {
    await applySchema();
    await seedPlaceholdersIfNeeded();

    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║   VASTEROIDS SCOREBOARD SERVER (PG)        ║
╠════════════════════════════════════════════╣
║   REST API:    http://localhost:${PORT}       ║
║   WebSocket:   ws://localhost:${PORT}         ║
╠════════════════════════════════════════════╣
║   Endpoints:                               ║
║     GET  /api/scores       - Get top 100   ║
║     POST /api/scores       - Add score     ║
║     GET  /api/scores/rank/:score           ║
╚════════════════════════════════════════════╝
  `);
    });
  } catch (err) {
    console.error('Failed to boot server:', err);
    process.exitCode = 1;
  }
}

process.on('SIGINT', async () => {
  try { await pool.end(); } catch (e) {}
  process.exit(0);
});
process.on('SIGTERM', async () => {
  try { await pool.end(); } catch (e) {}
  process.exit(0);
});

boot();
