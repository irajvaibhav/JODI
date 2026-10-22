import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { q, one, track, encrypt, decrypt, ageFrom } from './db.js';
import { requireAuth } from './auth.js';
import { computeAstro, geocode, searchPlaces, NAKSHATRAS, SIGNS, elementOf } from './astro.js';
import { compatibility, intentsCompatible, META } from './compat.js';
import * as ai from './ai.js';
import { emitTo, notify } from './realtime.js';

export const api = Router();
const upload = multer({ limits: { fileSize: 6 * 1024 * 1024 }, storage: multer.memoryStorage() });
const IMAGE = /^image\/(jpeg|png|webp)$/;

const h = fn => (req, res, next) => fn(req, res, next).catch(next);
const bad = (res, error, status = 400) => res.status(status).json({ error });
const str = (v, max) => v == null ? undefined : String(v).trim().slice(0, max);

api.get('/meta', (req, res) => res.json(META));
api.get('/places', h(async (req, res) => res.json(req.query.q?.length >= 2 ? await searchPlaces(req.query.q) : [])));

// profile images are public by id, chat images need a match
api.get('/media/:id', h(async (req, res, next) => {
  if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.sendStatus(404);
  const m = await one('SELECT kind, mime, data, owner_id, status FROM media WHERE id=$1', [req.params.id]);
  if (!m || m.status !== 'approved') return res.sendStatus(404);
  if (m.kind === 'chat') {
    return requireAuth(req, res, () => (async () => {
      const ok = await one(`SELECT 1 FROM messages x JOIN matches mt ON mt.id=x.match_id WHERE x.media_id=$1 AND $2 IN (mt.user_a, mt.user_b)`, [req.params.id, req.uid]);
      if (!ok) return res.sendStatus(404);
      res.set({ 'content-type': m.mime, 'cache-control': 'private, max-age=86400' }).send(m.data);
    })().catch(next));
  }
  res.set({ 'content-type': m.mime, 'cache-control': 'public, max-age=31536000, immutable' }).send(m.data);
}));

api.use(requireAuth);

// ---------- loading & serialising users ----------

const USER_SQL = `SELECT u.id, u.dob, u.onboarded, u.discoverable, u.last_seen_at, p.name, p.gender, p.bio, p.city, p.lat, p.lng,
  p.profession, p.education, p.interests, p.personality, p.lifestyle, extract(epoch from p.updated_at)::bigint AS version,
  a.sun, a.moon, a.rising, a.nakshatra, a.element, a.time_known,
  pr.genders, pr.age_min, pr.age_max, pr.max_km, pr.intent,
  COALESCE((SELECT json_agg(m.id ORDER BY m.position) FROM media m WHERE m.owner_id=u.id AND m.kind='profile' AND m.status='approved'), '[]') AS photos
  FROM users u LEFT JOIN profiles p ON p.user_id=u.id LEFT JOIN astro a ON a.user_id=u.id LEFT JOIN preferences pr ON pr.user_id=u.id`;

const shape = r => r && ({ ...r, astro: r.sun ? { sun: r.sun, moon: r.moon, rising: r.rising, nakshatra: r.nakshatra, element: r.element } : null, age: r.dob ? ageFrom(r.dob) : null });
const loadUser = async id => shape(await one(`${USER_SQL} WHERE u.id=$1`, [id]));

const km = (a, b) => {
  if (a.lat == null || b.lat == null) return null;
  const R = Math.PI / 180, x = Math.sin((b.lat - a.lat) * R / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin((b.lng - a.lng) * R / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

// what other users can see - never birth details
function publicCard(u, viewer, compat) {
  const d = viewer ? km(viewer, u) : null;
  return {
    id: u.id, name: u.name, age: u.age, city: u.city, bio: u.bio, profession: u.profession, education: u.education,
    interests: u.interests, lifestyle: u.lifestyle, intent: u.intent, photos: u.photos.map(id => `/media/${id}`),
    astro: u.astro && { sun: u.astro.sun, moon: u.astro.moon, rising: u.astro.rising, element: u.astro.element, nakshatra: NAKSHATRAS[u.astro.nakshatra] ?? null },
    distanceKm: d == null ? null : Math.max(1, Math.round(d)),
    compat: compat && { overall: compat.overall, astro: compat.astro, interests: compat.interests, personality: compat.personality, lifestyle: compat.lifestyle, reasons: compat.reasons, difference: compat.difference },
  };
}

const blockedEither = (a, b) => one('SELECT 1 FROM blocks WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1)', [a, b]);

// ---------- me / onboarding ----------

api.get('/me', h(async (req, res) => {
  const u = await loadUser(req.uid);
  const a = await one('SELECT birth_enc FROM astro WHERE user_id=$1', [req.uid]);
  const n = await one('SELECT notif, phone, email FROM users WHERE id=$1', [req.uid]);
  res.json({
    ...publicCard(u), onboarded: u.onboarded, discoverable: u.discoverable, gender: u.gender, personality: u.personality,
    preferences: { genders: u.genders || [], ageMin: u.age_min ?? 18, ageMax: u.age_max ?? 35, maxKm: u.max_km ?? 50, intent: u.intent },
    birth: a?.birth_enc ? decrypt(a.birth_enc) : null, // owner only
    dob: u.dob, notif: n.notif, phone: n.phone, email: n.email,
    photoIds: u.photos,
  });
}));

api.put('/me/birth', h(async (req, res) => {
  const { dob, time, place } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob || '') || isNaN(new Date(dob))) return bad(res, 'Enter your date of birth');
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return bad(res, 'Enter birth time as HH:MM');
  const age = ageFrom(dob);
  if (age < 18) { track(req.uid, 'audit.underage_blocked'); return bad(res, 'Jodi is only for people 18 and over', 403); }
  if (age > 100) return bad(res, 'Please check your date of birth');
  const cur = await one('SELECT dob FROM users WHERE id=$1', [req.uid]);
  if (cur.dob && cur.dob.toISOString().slice(0, 10) !== dob) return bad(res, 'Date of birth can\'t be changed. Contact support if it\'s wrong.', 409);
  const geo = place ? await geocode(place).catch(() => null) : null;
  if (place && !geo) return bad(res, 'We couldn\'t find that birth place. Try "City, Country".');
  const astro = computeAstro({ dob, time: time || null, lat: geo?.lat, lng: geo?.lng, tz: geo?.tz });
  // astro before dob, otherwise a failed save skips the birth step
  await q(`INSERT INTO astro(user_id, birth_enc, time_known, sun, moon, rising, nakshatra, element) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (user_id) DO UPDATE SET birth_enc=$2, time_known=$3, sun=$4, moon=$5, rising=$6, nakshatra=$7, element=$8, updated_at=now()`,
    [req.uid, encrypt({ dob, time: time || null, place: geo?.label || null }), astro.timeKnown, astro.sun, astro.moon, astro.rising, astro.nakshatra, astro.element]);
  await q('UPDATE users SET dob=$2 WHERE id=$1', [req.uid, dob]);
  track(req.uid, 'onboarding.birth', { timeKnown: astro.timeKnown });
  res.json({ astro: { ...astro, nakshatra: NAKSHATRAS[astro.nakshatra] }, age });
}));

api.put('/me/profile', h(async (req, res) => {
  const b = req.body;
  const p = {
    name: str(b.name, 40), gender: b.gender && META.genders.includes(b.gender) ? b.gender : undefined, bio: str(b.bio, 300),
    city: str(b.city, 80), profession: str(b.profession, 60), education: str(b.education, 80),
    interests: Array.isArray(b.interests) ? b.interests.filter(i => META.interests.includes(i)).slice(0, 10) : undefined,
    personality: b.personality && Object.fromEntries(META.personality.filter(x => [1, 2, 3, 4, 5].includes(b.personality[x.key])).map(x => [x.key, b.personality[x.key]])),
    lifestyle: b.lifestyle && Object.fromEntries(Object.entries(META.lifestyle).filter(([k, v]) => v.options.includes(b.lifestyle[k])).map(([k]) => [k, b.lifestyle[k]])),
  };
  if (p.name === '') return bad(res, 'Name is required');
  const flagged = [p.name, p.bio, p.profession, p.education].find(t => t && ai.quickTextCheck(t));
  if (flagged) return bad(res, 'Please remove contact details, payment info or offensive words from your profile');
  let geo = {};
  if (p.city) { const g = await geocode(p.city).catch(() => null); if (g) geo = { lat: g.lat, lng: g.lng }; }
  await q(`INSERT INTO profiles(user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [req.uid]);
  await q(`UPDATE profiles SET name=COALESCE($2,name), gender=COALESCE($3,gender), bio=COALESCE($4,bio), city=COALESCE($5,city),
    profession=COALESCE($6,profession), education=COALESCE($7,education), interests=COALESCE($8,interests),
    personality=COALESCE($9,personality), lifestyle=COALESCE($10,lifestyle), lat=COALESCE($11,lat), lng=COALESCE($12,lng), updated_at=now()
    WHERE user_id=$1`, [req.uid, p.name, p.gender, p.bio, p.city, p.profession, p.education, p.interests, p.personality, p.lifestyle, geo.lat, geo.lng]);
  res.json({ ok: true });
}));

api.post('/me/photos', upload.single('photo'), h(async (req, res) => {
  if (!req.file || !IMAGE.test(req.file.mimetype)) return bad(res, 'Upload a JPG, PNG or WebP photo');
  const { n } = await one(`SELECT count(*)::int n FROM media WHERE owner_id=$1 AND kind='profile' AND status='approved'`, [req.uid]);
  if (n >= 6) return bad(res, 'You can have up to 6 photos');
  const mod = await ai.moderateImage(req.file.buffer, req.file.mimetype);
  const m = await one(`INSERT INTO media(owner_id, kind, position, mime, data, status) VALUES ($1,'profile',$2,$3,$4,$5) RETURNING id`,
    [req.uid, n, req.file.mimetype, req.file.buffer, mod.ok ? 'approved' : 'rejected']);
  if (!mod.ok) { track(req.uid, 'moderation.photo_rejected', { reason: mod.reason }); return bad(res, 'This photo doesn\'t meet our community guidelines. Try another one.', 422); }
  await q('UPDATE profiles SET updated_at=now() WHERE user_id=$1', [req.uid]);
  res.json({ id: m.id, url: `/media/${m.id}` });
}));

api.delete('/me/photos/:id', h(async (req, res) => {
  await q(`DELETE FROM media WHERE id=$1 AND owner_id=$2 AND kind='profile'`, [req.params.id, req.uid]);
  res.json({ ok: true });
}));

api.put('/me/photos/order', h(async (req, res) => {
  const ids = (req.body.ids || []).slice(0, 6);
  await Promise.all(ids.map((id, i) => q(`UPDATE media SET position=$3 WHERE id=$1 AND owner_id=$2`, [id, req.uid, i])));
  res.json({ ok: true });
}));

api.put('/me/preferences', h(async (req, res) => {
  const b = req.body;
  const genders = (b.genders || []).filter(g => META.genders.includes(g));
  const ageMin = Math.max(18, Math.min(99, b.ageMin | 0 || 18)), ageMax = Math.max(ageMin, Math.min(99, b.ageMax | 0 || 35));
  const maxKm = Math.max(1, Math.min(1000, b.maxKm | 0 || 50));
  const intent = META.intents.includes(b.intent) ? b.intent : null;
  await q(`INSERT INTO preferences(user_id, genders, age_min, age_max, max_km, intent) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (user_id) DO UPDATE SET genders=$2, age_min=$3, age_max=$4, max_km=$5, intent=$6`, [req.uid, genders, ageMin, ageMax, maxKm, intent]);
  res.json({ ok: true });
}));

api.post('/me/complete', h(async (req, res) => {
  const u = await loadUser(req.uid);
  const missing = [!u.dob && 'birth details', !u.name && 'name', !u.gender && 'gender', u.photos.length < 2 && 'at least 2 photos',
    (u.interests || []).length < 3 && 'at least 3 interests', !u.genders?.length && 'who you\'d like to meet'].filter(Boolean);
  if (missing.length) return bad(res, `Still needed: ${missing.join(', ')}`);
  if (!u.onboarded) {
    await q('UPDATE users SET onboarded=true WHERE id=$1', [req.uid]);
    track(req.uid, 'onboarding.completed');
    // demo only
    if (process.env.DEMO_LIKES === 'true') await q(`INSERT INTO swipes(swiper, target, action)
      SELECT d.id, $1, 'jodi' FROM users d JOIN profiles dp ON dp.user_id=d.id JOIN preferences dpr ON dpr.user_id=d.id
      WHERE d.phone LIKE '+910000000%' AND $2 = ANY(dpr.genders) AND (cardinality($3::text[])=0 OR dp.gender = ANY($3))
        AND ($4::text IS NULL OR dpr.intent IS NULL OR dpr.intent = $4 OR 'Still figuring it out' IN (dpr.intent, $4))
      ORDER BY random() LIMIT 6 ON CONFLICT DO NOTHING`, [req.uid, u.gender, u.genders || [], u.intent]);
  }
  res.json({ ok: true });
}));

api.get('/me/astro', h(async (req, res) => {
  const a = await one('SELECT sun, moon, rising, nakshatra, element, time_known FROM astro WHERE user_id=$1', [req.uid]);
  if (!a) return bad(res, 'Add your birth details first', 404);
  const summary = await ai.astroSummary(req.uid, a);
  res.json({ ...a, nakshatra: NAKSHATRAS[a.nakshatra] ?? null, timeKnown: a.time_known, ...summary });
}));

api.put('/me/settings', h(async (req, res) => {
  const { notif, discoverable, pushToken } = req.body;
  if (notif) {
    const n = { matches: !!notif.matches, messages: !!notif.messages, daily: !!notif.daily,
      quietStart: notif.quietStart == null ? null : notif.quietStart % 24, quietEnd: notif.quietEnd == null ? null : notif.quietEnd % 24 };
    await q('UPDATE users SET notif=$2 WHERE id=$1', [req.uid, n]);
  }
  if (typeof discoverable === 'boolean') { await q('UPDATE users SET discoverable=$2 WHERE id=$1', [req.uid, discoverable]); track(req.uid, 'audit.discoverable', { discoverable }); }
  if (pushToken !== undefined) await q('UPDATE users SET push_token=$2 WHERE id=$1', [req.uid, str(pushToken, 200) || null]);
  res.json({ ok: true });
}));

api.get('/me/export', h(async (req, res) => {
  const u = await one('SELECT id, phone, email, dob, created_at, notif, discoverable FROM users WHERE id=$1', [req.uid]);
  const a = await one('SELECT birth_enc, sun, moon, rising, nakshatra FROM astro WHERE user_id=$1', [req.uid]);
  const data = {
    account: u, profile: await one('SELECT * FROM profiles WHERE user_id=$1', [req.uid]),
    preferences: await one('SELECT * FROM preferences WHERE user_id=$1', [req.uid]),
    astro: a && { birth: a.birth_enc ? decrypt(a.birth_enc) : null, sun: a.sun, moon: a.moon, rising: a.rising, nakshatra: NAKSHATRAS[a.nakshatra] },
    photos: (await q(`SELECT id, created_at FROM media WHERE owner_id=$1 AND kind='profile'`, [req.uid])).rows,
    swipes: (await q('SELECT target, action, created_at FROM swipes WHERE swiper=$1', [req.uid])).rows,
    messagesSent: (await q('SELECT match_id, body, created_at FROM messages WHERE sender_id=$1', [req.uid])).rows,
    blocks: (await q('SELECT blocked, created_at FROM blocks WHERE blocker=$1', [req.uid])).rows,
  };
  track(req.uid, 'audit.export');
  res.json(data);
}));

api.delete('/me/astro', h(async (req, res) => {
  // dob stays for the 18+ check
  await q('DELETE FROM astro WHERE user_id=$1', [req.uid]);
  await q(`DELETE FROM ai_cache WHERE key LIKE $1`, [`astro:${req.uid}:%`]);
  track(req.uid, 'audit.astro_deleted');
  res.json({ ok: true });
}));

api.delete('/me', h(async (req, res) => {
  track(null, 'audit.account_deleted', { uid: req.uid });
  await q('DELETE FROM users WHERE id=$1', [req.uid]); // cascades everything
  res.json({ ok: true });
}));

api.post('/events', h(async (req, res) => {
  const name = str(req.body.name, 60);
  if (name && !name.startsWith('audit.')) track(req.uid, `app.${name}`, req.body.props || {});
  res.json({ ok: true });
}));

// ---------- discovery ----------

const dayKey = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // IST day
const jitter = (a, b) => crypto.createHash('md5').update(a + b + dayKey()).digest()[0] / 255 * 4;

// TODO: cache scores, this scores up to 500 candidates per request
async function candidates(me, { filter, limit = 20, extraWhere = '', params = [] } = {}) {
  const rows = (await q(`${USER_SQL}
    WHERE u.onboarded AND u.discoverable AND NOT u.banned AND u.id<>$1
      AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper=$1 AND s.target=u.id)
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker=$1 AND b.blocked=u.id) OR (b.blocker=u.id AND b.blocked=$1))
      AND (cardinality($2::text[])=0 OR p.gender = ANY($2))
      AND (pr.genders IS NULL OR cardinality(pr.genders)=0 OR $3 = ANY(pr.genders))
      AND u.dob > (now() - make_interval(years => $5::int + 1))::date AND u.dob <= (now() - make_interval(years => $4::int))::date
      AND EXISTS (SELECT 1 FROM media m WHERE m.owner_id=u.id AND m.kind='profile' AND m.status='approved')
      ${extraWhere}
    ORDER BY u.last_seen_at DESC LIMIT 500`, [me.id, me.genders || [], me.gender, me.age_min ?? 18, me.age_max ?? 99, ...params])).rows.map(shape);

  return rows
    .filter(u => (u.age_min == null || (me.age >= u.age_min && me.age <= u.age_max)))
    .filter(u => intentsCompatible(me.intent, u.intent))
    .filter(u => { const d = km(me, u); return d == null || me.max_km >= 1000 || d <= me.max_km; })
    .filter(u => filter !== 'same_zodiac' || (u.astro?.sun && u.astro.sun === me.astro?.sun))
    .map(u => ({ u, c: compatibility(me, u) }))
    .map(x => ({ ...x, rank: filter === 'kundli' ? x.c.astro : filter === 'hobbies' ? x.c.interests : x.c.overall + jitter(me.id, x.u.id) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);
}

api.get('/discover', h(async (req, res) => {
  const me = await loadUser(req.uid);
  if (!me.onboarded) return bad(res, 'Finish your profile first', 403);
  const list = await candidates(me, { filter: req.query.filter });
  track(req.uid, 'discover.loaded', { count: list.length, filter: req.query.filter || 'all' });
  res.json(list.map(({ u, c }) => publicCard(u, me, c)));
}));

api.get('/users/:id', h(async (req, res) => {
  if (await blockedEither(req.uid, req.params.id)) return bad(res, 'Profile not available', 404);
  const [me, them] = await Promise.all([loadUser(req.uid), loadUser(req.params.id)]);
  if (!them?.onboarded) return bad(res, 'Profile not available', 404);
  const c = compatibility(me, them);
  const vibe = await ai.vibe(me, them, c, `${me.version}-${them.version}`);
  const swipe = await one('SELECT action FROM swipes WHERE swiper=$1 AND target=$2', [req.uid, them.id]);
  const match = await one(`SELECT id FROM matches WHERE user_a=$1 AND user_b=$2 AND unmatched_at IS NULL`, [req.uid, them.id].sort());
  track(req.uid, 'compat.viewed', { target: them.id });
  res.json({ ...publicCard(them, me, c), vibe, swiped: swipe?.action || null, matchId: match?.id || null });
}));

api.post('/swipe', h(async (req, res) => {
  const { targetId, action } = req.body;
  if (!['jodi', 'pass'].includes(action) || targetId === req.uid) return bad(res, 'Invalid swipe');
  if (await blockedEither(req.uid, targetId)) return res.json({ matched: false });
  await q(`INSERT INTO swipes(swiper, target, action) VALUES ($1,$2,$3) ON CONFLICT (swiper, target) DO UPDATE SET action=$3, created_at=now()`, [req.uid, targetId, action]);
  track(req.uid, `swipe.${action}`, { target: targetId });
  if (action === 'pass') return res.json({ matched: false });
  const back = await one(`SELECT 1 FROM swipes WHERE swiper=$1 AND target=$2 AND action='jodi'`, [targetId, req.uid]);
  if (!back) {
    const me = await one('SELECT name FROM profiles WHERE user_id=$1', [req.uid]);
    notify(targetId, 'matches', 'Someone is interested in you ✨', `${me?.name || 'Someone'} sent you a Jodi. Tap to see who!`, { type: 'like', userId: req.uid });
    return res.json({ matched: false });
  }
  const [a, b] = [req.uid, targetId].sort();
  const [me, them] = await Promise.all([loadUser(req.uid), loadUser(targetId)]);
  const score = compatibility(me, them).overall;
  const m = await one(`INSERT INTO matches(user_a, user_b, score) VALUES ($1,$2,$3)
    ON CONFLICT (user_a, user_b) DO UPDATE SET unmatched_at=NULL, score=$3 RETURNING id`, [a, b, score]);
  track(req.uid, 'match.created', { matchId: m.id, score });
  emitTo(targetId, 'match', { matchId: m.id, userId: req.uid });
  notify(targetId, 'matches', 'IT\'S A JODI ✨', `You and ${me.name} liked each other — ${score}% cosmic overlap!`, { type: 'match', matchId: m.id });
  res.json({ matched: true, matchId: m.id });
}));

api.get('/likes', h(async (req, res) => {
  const me = await loadUser(req.uid);
  const rows = (await q(`${USER_SQL} JOIN swipes s ON s.swiper=u.id AND s.target=$1 AND s.action='jodi'
    WHERE NOT u.banned AND u.onboarded AND (cardinality($2::text[])=0 OR p.gender = ANY($2))
      AND NOT EXISTS (SELECT 1 FROM swipes s2 WHERE s2.swiper=$1 AND s2.target=u.id)
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker=$1 AND b.blocked=u.id) OR (b.blocker=u.id AND b.blocked=$1))
    ORDER BY s.created_at DESC LIMIT 50`, [req.uid, me.genders || []])).rows.map(shape);
  res.json(rows.map(u => publicCard(u, me, compatibility(me, u))));
}));

const LUCKY_COLORS = ['Lavender', 'Rose gold', 'Sky blue', 'Emerald', 'Sunset orange', 'Ivory', 'Royal purple', 'Coral', 'Teal', 'Champagne'];
const ELEMENT_FRIENDS = { Fire: ['Fire', 'Air'], Air: ['Air', 'Fire'], Earth: ['Earth', 'Water'], Water: ['Water', 'Earth'] };

api.get('/daily', h(async (req, res) => {
  const day = dayKey();
  const hit = await one('SELECT data FROM daily_cosmic WHERE user_id=$1 AND day=$2', [req.uid, day]);
  let data = hit?.data;
  if (!data) {
    const me = await loadUser(req.uid);
    const [top] = me.onboarded ? await candidates(me, { limit: 1 }) : [];
    const text = await ai.dailyText(me, top?.u, top?.c);
    const seed = crypto.createHash('md5').update(req.uid + day).digest();
    const el = me.astro?.element;
    data = {
      day, ...text, jodiId: top?.u.id || null,
      highlights: {
        bestSigns: el ? SIGNS.filter(s => ELEMENT_FRIENDS[el].includes(elementOf(s)) && s !== me.astro.sun).sort(() => seed[2] / 255 - 0.5).slice(0, 3) : [],
        luckyColor: LUCKY_COLORS[seed[0] % LUCKY_COLORS.length], luckyNumber: (seed[1] % 9) + 1,
      },
    };
    await q('INSERT INTO daily_cosmic(user_id, day, target_id, data) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [req.uid, day, data.jodiId, data]);
  }
  let jodi = null;
  if (data.jodiId && !(await blockedEither(req.uid, data.jodiId))) {
    const [me, them] = await Promise.all([loadUser(req.uid), loadUser(data.jodiId)]);
    if (them?.onboarded && them.discoverable) jodi = publicCard(them, me, compatibility(me, them));
  }
  track(req.uid, 'daily.viewed');
  res.json({ ...data, jodi });
}));

// ---------- matches & chat ----------

async function myMatch(req, res) {
  const m = await one(`SELECT * FROM matches WHERE id=$1 AND $2 IN (user_a, user_b) AND unmatched_at IS NULL`, [req.params.id, req.uid]);
  if (!m) { bad(res, 'Chat not available', 404); return null; }
  m.other = m.user_a === req.uid ? m.user_b : m.user_a;
  if (await blockedEither(req.uid, m.other)) { bad(res, 'Chat not available', 404); return null; }
  return m;
}

api.get('/matches', h(async (req, res) => {
  const rows = (await q(`SELECT m.id, m.score, m.created_at, o.id AS other_id, p.name,
      (SELECT id FROM media x WHERE x.owner_id=o.id AND x.kind='profile' AND x.status='approved' ORDER BY position LIMIT 1) AS photo,
      lm.body AS last_body, lm.media_id AS last_media, lm.sender_id AS last_sender, lm.created_at AS last_at
    FROM matches m JOIN users o ON o.id = CASE WHEN m.user_a=$1 THEN m.user_b ELSE m.user_a END
    JOIN profiles p ON p.user_id=o.id
    LEFT JOIN LATERAL (SELECT body, media_id, sender_id, created_at FROM messages WHERE match_id=m.id ORDER BY created_at DESC LIMIT 1) lm ON true
    WHERE $1 IN (m.user_a, m.user_b) AND m.unmatched_at IS NULL AND NOT o.banned
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker=$1 AND b.blocked=o.id) OR (b.blocker=o.id AND b.blocked=$1))
    ORDER BY COALESCE(lm.created_at, m.created_at) DESC`, [req.uid])).rows;
  res.json(rows.map(r => ({
    id: r.id, score: r.score, createdAt: r.created_at, user: { id: r.other_id, name: r.name, photo: r.photo && `/media/${r.photo}` },
    last: r.last_at ? { body: r.last_media ? '📷 Photo' : r.last_body, mine: r.last_sender === req.uid, at: r.last_at } : null,
  })));
}));

api.get('/matches/:id', h(async (req, res) => {
  const m = await myMatch(req, res); if (!m) return;
  const [me, them] = await Promise.all([loadUser(req.uid), loadUser(m.other)]);
  const c = compatibility(me, them);
  res.json({ id: m.id, shareCode: m.share_code, createdAt: m.created_at, me: publicCard(me), user: publicCard(them, me, c), vibe: await ai.vibe(me, them, c, `${me.version}-${them.version}`) });
}));

const msgOut = r => ({ id: r.id, matchId: r.match_id, senderId: r.sender_id, body: r.body, image: r.media_id && `/media/${r.media_id}`, createdAt: r.created_at });

api.get('/matches/:id/messages', h(async (req, res) => {
  const m = await myMatch(req, res); if (!m) return;
  const rows = (await q(`SELECT * FROM messages WHERE match_id=$1 AND ($2::timestamptz IS NULL OR created_at < $2)
    ORDER BY created_at DESC LIMIT 50`, [m.id, req.query.before || null])).rows;
  res.json(rows.reverse().map(msgOut));
}));

api.post('/matches/:id/messages', upload.single('image'), h(async (req, res) => {
  const m = await myMatch(req, res); if (!m) return;
  const body = str(req.body.body, 2000) || null;
  if (!body && !req.file) return bad(res, 'Empty message');
  let mediaId = null;
  if (req.file) {
    if (!IMAGE.test(req.file.mimetype)) return bad(res, 'Only photos can be sent');
    const mod = await ai.moderateImage(req.file.buffer, req.file.mimetype);
    if (!mod.ok) return bad(res, 'This image can\'t be sent — it may break our community guidelines', 422);
    mediaId = (await one(`INSERT INTO media(owner_id, kind, mime, data) VALUES ($1,'chat',$2,$3) RETURNING id`, [req.uid, req.file.mimetype, req.file.buffer])).id;
  }
  const flag = body && ai.quickTextCheck(body);
  if (flag === 'harassment') return bad(res, 'This message looks hurtful. Please keep Jodi kind 💜', 422);
  const first = !(await one('SELECT 1 FROM messages WHERE match_id=$1 LIMIT 1', [m.id]));
  const replyTo = await one('SELECT sender_id FROM messages WHERE match_id=$1 ORDER BY created_at DESC LIMIT 1', [m.id]);
  const msg = await one(`INSERT INTO messages(match_id, sender_id, body, media_id, flagged) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [m.id, req.uid, body, mediaId, flag]);
  track(req.uid, first ? 'chat.first_message' : 'chat.message', { matchId: m.id, icebreaker: !!req.body.icebreaker });
  if (replyTo && replyTo.sender_id !== req.uid && !(await one('SELECT 1 FROM messages WHERE match_id=$1 AND sender_id=$2 AND id<>$3 LIMIT 1', [m.id, req.uid, msg.id]))) {
    track(req.uid, 'chat.first_reply', { matchId: m.id });
  }
  const out = msgOut(msg);
  emitTo(m.other, 'message', out);
  const me = await one('SELECT name FROM profiles WHERE user_id=$1', [req.uid]);
  notify(m.other, 'messages', me?.name || 'New message', body ? body.slice(0, 100) : '📷 Sent you a photo', { type: 'message', matchId: m.id });

  if (flag === 'possible_scam') await q(`INSERT INTO reports(reported, reason, details) VALUES ($1,'auto: possible_scam',$2)`, [req.uid, body]);
  else if (body) ai.deepTextCheck(body).then(r => r?.severity === 'high' &&
    q(`INSERT INTO reports(reported, reason, details) VALUES ($1,$2,$3)`, [req.uid, `auto: ${r.category}`, body])).catch(() => {});
  res.json(out);
}));

api.get('/matches/:id/icebreakers', h(async (req, res) => {
  const m = await myMatch(req, res); if (!m) return;
  const [me, them] = await Promise.all([loadUser(req.uid), loadUser(m.other)]);
  track(req.uid, 'icebreaker.generated', { matchId: m.id });
  res.json({ icebreakers: await ai.icebreakers(me, them, compatibility(me, them)) });
}));

api.post('/matches/:id/unmatch', h(async (req, res) => {
  const m = await myMatch(req, res); if (!m) return;
  await q('UPDATE matches SET unmatched_at=now() WHERE id=$1', [m.id]);
  await q(`UPDATE swipes SET action='pass' WHERE swiper=$1 AND target=$2`, [req.uid, m.other]);
  emitTo(m.other, 'unmatch', { matchId: m.id });
  track(req.uid, 'match.unmatched', { matchId: m.id });
  res.json({ ok: true });
}));

// ---------- safety ----------

async function block(uid, other) {
  await q('INSERT INTO blocks(blocker, blocked) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, other]);
  const [a, b] = [uid, other].sort();
  const m = await one('UPDATE matches SET unmatched_at=now() WHERE user_a=$1 AND user_b=$2 AND unmatched_at IS NULL RETURNING id', [a, b]);
  if (m) emitTo(other, 'unmatch', { matchId: m.id });
}

api.post('/block', h(async (req, res) => {
  if (!req.body.userId || req.body.userId === req.uid) return bad(res, 'Invalid user');
  await block(req.uid, req.body.userId);
  track(req.uid, 'safety.block', { target: req.body.userId });
  res.json({ ok: true });
}));

api.delete('/block/:userId', h(async (req, res) => {
  await q('DELETE FROM blocks WHERE blocker=$1 AND blocked=$2', [req.uid, req.params.userId]);
  res.json({ ok: true });
}));

api.get('/blocks', h(async (req, res) => {
  res.json((await q(`SELECT b.blocked AS id, p.name, b.created_at FROM blocks b LEFT JOIN profiles p ON p.user_id=b.blocked
    WHERE b.blocker=$1 ORDER BY b.created_at DESC`, [req.uid])).rows);
}));

api.post('/report', h(async (req, res) => {
  const { userId, reason, details } = req.body;
  if (!userId || userId === req.uid || !META.reportReasons.includes(reason)) return bad(res, 'Choose a reason');
  await q('INSERT INTO reports(reporter, reported, reason, details) VALUES ($1,$2,$3,$4)', [req.uid, userId, reason, str(details, 1000)]);
  await block(req.uid, userId); // reporting always hides them from you
  track(req.uid, 'safety.report', { reason });
  res.json({ ok: true });
}));
