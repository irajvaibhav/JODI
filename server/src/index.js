import express from 'express';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool, q, one, migrate, track } from './db.js';
import { authRouter } from './auth.js';
import { api } from './api.js';
import { attachSockets, notify, istHour } from './realtime.js';
import { compatibility } from './compat.js';
import * as pages from './pages.js';

for (const k of ['DATABASE_URL', 'JWT_SECRET', 'BIRTH_KEY']) if (!process.env[k]) throw new Error(`Missing env ${k}`);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  // bearer auth, no cookies
  res.set({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, DELETE' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// hits the db so uptime pings keep supabase from pausing
app.get('/health', async (req, res) => { await q('SELECT 1'); res.json({ ok: true }); });
app.use('/auth', authRouter);
app.get('/', (req, res) => res.send(pages.home()));
app.get('/privacy', (req, res) => res.send(pages.privacy()));
app.get('/terms', (req, res) => res.send(pages.terms()));

// ---------- share card ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
app.get('/c/:code', async (req, res) => {
  const m = await one(`SELECT m.score, pa.name a, pb.name b, pa.interests ia, pb.interests ib, aa.sun sa, ab.sun sb
    FROM matches m JOIN profiles pa ON pa.user_id=m.user_a JOIN profiles pb ON pb.user_id=m.user_b
    LEFT JOIN astro aa ON aa.user_id=m.user_a LEFT JOIN astro ab ON ab.user_id=m.user_b WHERE m.share_code=$1`, [req.params.code]).catch(() => null);
  if (!m) return res.status(404).send('This Jodi card has expired.');
  const reasons = compatibility({ interests: m.ia, astro: m.sa && { sun: m.sa } }, { interests: m.ib, astro: m.sb && { sun: m.sb } }).reasons.slice(0, 3);
  track(null, 'share.card_opened', { code: req.params.code });
  const download = process.env.APP_DOWNLOAD_URL || '#';
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.a)} + ${esc(m.b)} · Jodi</title><meta property="og:title" content="${esc(m.a)} + ${esc(m.b)}: ${m.score}% cosmic Jodi ✨">
<meta property="og:description" content="Dating, written in the stars. Find your Jodi.">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 30% 10%,#3b2a6b,#0b0b1f 60%);color:#fff;font-family:system-ui,sans-serif;padding:16px;box-sizing:border-box}
.c{max-width:380px;width:100%;text-align:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:28px;padding:32px 24px}
h1{letter-spacing:8px;font-weight:300;margin:0 0 8px}.s{font-size:64px;font-weight:700;background:linear-gradient(90deg,#c9a7ff,#f7b4e0);-webkit-background-clip:text;color:transparent}
li{text-align:left;margin:10px 0;color:#ddd}a{display:block;margin-top:24px;padding:16px;border-radius:999px;background:linear-gradient(90deg,#c9a7ff,#f7b4e0);color:#1a1033;font-weight:700;text-decoration:none}</style></head>
<body><div class="c"><h1>JODI</h1><p>${esc(m.a)} ✦ ${esc(m.b)}</p><div class="s">${m.score}%</div><p>cosmic compatibility</p>
<ul>${reasons.map(r => `<li>✨ ${esc(r)}</li>`).join('')}</ul>
<a href="${esc(download)}">Find your own Jodi</a><p style="font-size:12px;color:#999;margin-top:20px">Compatibility is for fun & discovery — not a guarantee.</p></div></body></html>`);
});

// ---------- admin ----------
const admin = (req, res, next) => {
  const t = req.get('x-admin-token') || req.query.token || '';
  const want = process.env.ADMIN_TOKEN || '';
  return want && t.length === want.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(want)) ? next() : res.sendStatus(401);
};
app.get('/admin', (req, res) => res.sendFile(fileURLToPath(new URL('./admin.html', import.meta.url))));
app.get('/admin/api/reports', admin, async (req, res) => {
  res.json((await q(`SELECT r.*, p.name, (SELECT count(*) FROM reports r2 WHERE r2.reported=r.reported)::int total,
    (SELECT json_agg(id) FROM media m WHERE m.owner_id=r.reported AND m.kind='profile') photos, u.banned
    FROM reports r JOIN users u ON u.id=r.reported LEFT JOIN profiles p ON p.user_id=r.reported
    WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 200`)).rows);
});
app.post('/admin/api/reports/:id', admin, async (req, res) => {
  const r = await one(`UPDATE reports SET status=$2 WHERE id=$1 RETURNING reported`, [req.params.id, req.body.action === 'ban' ? 'actioned' : 'dismissed']);
  if (r && req.body.action === 'ban') {
    await q('UPDATE users SET banned=true WHERE id=$1', [r.reported]);
    await q('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [r.reported]);
    await q(`UPDATE reports SET status='actioned' WHERE reported=$1 AND status='open'`, [r.reported]);
    track(null, 'audit.ban', { uid: r.reported });
  }
  res.json({ ok: true });
});
app.get('/admin/api/metrics', admin, async (req, res) => {
  const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : 0);
  const n = async (sql, p) => (await one(sql, p)).n;
  const users = await n('SELECT count(*)::int n FROM users');
  const onboarded = await n('SELECT count(*)::int n FROM users WHERE onboarded');
  const activated = await n(`SELECT count(DISTINCT user_id)::int n FROM events WHERE name='discover.loaded'`);
  const jodiers = await n(`SELECT count(DISTINCT s.swiper)::int n FROM swipes s WHERE s.action='jodi'
    AND EXISTS (SELECT 1 FROM events e WHERE e.user_id=s.swiper AND e.name='discover.loaded')`);
  const jodis = await n(`SELECT count(*)::int n FROM swipes WHERE action='jodi'`);
  const matches = await n('SELECT count(*)::int n FROM matches');
  const convo = await n('SELECT count(DISTINCT match_id)::int n FROM messages');
  const replied = await n('SELECT count(*)::int n FROM (SELECT match_id FROM messages GROUP BY match_id HAVING count(DISTINCT sender_id) > 1) x');
  const d7base = await n(`SELECT count(*)::int n FROM users WHERE created_at < now() - interval '7 days'`);
  const d7 = await n(`SELECT count(*)::int n FROM users WHERE created_at < now() - interval '7 days' AND last_seen_at >= created_at + interval '7 days'`);
  const d30base = await n(`SELECT count(*)::int n FROM users WHERE created_at < now() - interval '30 days'`);
  const d30 = await n(`SELECT count(*)::int n FROM users WHERE created_at < now() - interval '30 days' AND last_seen_at >= created_at + interval '30 days'`);
  const matchedUsers = await n('SELECT count(*)::int n FROM (SELECT user_a u FROM matches UNION SELECT user_b FROM matches) x');
  const sharers = await n(`SELECT count(DISTINCT user_id)::int n FROM events WHERE name='app.card_shared'`);
  const active30 = await n(`SELECT count(*)::int n FROM users WHERE last_seen_at > now() - interval '30 days'`);
  const reporters = await n(`SELECT count(DISTINCT reporter)::int n FROM reports WHERE created_at > now() - interval '30 days'`);
  const wau = await n(`SELECT count(*)::int n FROM users WHERE last_seen_at > now() - interval '7 days'`);
  const meaningful = await n(`SELECT count(DISTINCT match_id)::int n FROM messages WHERE created_at > now() - interval '7 days'`);
  res.json([
    ['Users', users, ''], ['Profile completion', pct(onboarded, users), '70%+'], ['Activation', pct(activated, users), '60%+'],
    ['First Jodi', pct(jodiers, activated), '50%+'], ['Match rate', pct(matches * 2, jodis), '10%+'], ['Conversation rate', pct(convo, matches), '60%+'],
    ['Reply rate', pct(replied, convo), '40%+'], ['D7 retention', pct(d7, d7base), '25%+'], ['D30 retention', pct(d30, d30base), '12%+'],
    ['Card share rate', pct(sharers, matchedUsers), '15%+'], ['Report rate', pct(reporters, active30), '<2%'],
    ['Meaningful Jodis / WAU (7d)', wau ? Math.round(100 * meaningful / wau) / 100 : 0, 'North star'],
  ].map(([name, value, target]) => ({ name, value, target })));
});

app.use(api);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : 'Something went wrong' });
});

// daily push at 9am IST (in-process, assumes one instance)
let lastDaily = null;
setInterval(async () => {
  const day = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  if (istHour() !== 9 || lastDaily === day) return;
  lastDaily = day;
  const { rows } = await q(`SELECT id FROM users WHERE onboarded AND NOT banned AND push_token IS NOT NULL AND (notif->>'daily')::boolean`);
  for (const r of rows) notify(r.id, 'daily', 'Your Daily Cosmic Jodi is here ✨', 'One person the stars picked for you today. Tap to see why you might vibe.', { type: 'daily' });
}, 10 * 60 * 1000);

await migrate();
const server = createServer(app);
attachSockets(server);
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Jodi API on :${port}`));
process.on('SIGTERM', () => server.close(() => pool.end()));
