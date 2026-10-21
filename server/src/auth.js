import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { one, q, track } from './db.js';

const SECRET = () => process.env.JWT_SECRET;
const hash = (phone, code) => crypto.createHmac('sha256', SECRET()).update(`${phone}:${code}`).digest('hex');

export const normalizePhone = p => {
  const d = String(p || '').replace(/[^\d+]/g, '');
  if (/^\d{10}$/.test(d)) return `+91${d}`;
  if (/^\+\d{10,15}$/.test(d)) return d;
  return null;
};

async function sendSms(phone, code) {
  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID) {
    const r = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${process.env.MSG91_TEMPLATE_ID}&mobile=${phone.replace('+', '')}&otp=${code}`, {
      method: 'POST', headers: { authkey: process.env.MSG91_AUTH_KEY }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`MSG91 ${r.status}`);
    return true;
  }
  console.log(`[OTP] ${phone}: ${code}`); // no SMS provider configured yet
  return false;
}

async function startSession(user, method) {
  const s = await one('INSERT INTO sessions(user_id) VALUES ($1) RETURNING id', [user.id]);
  track(user.id, 'audit.login', { method });
  return { token: jwt.sign({ sid: s.id, uid: user.id }, SECRET(), { expiresIn: '90d' }), user: { id: user.id, onboarded: user.onboarded } };
}

export async function authenticate(token) {
  const { sid, uid } = jwt.verify(token, SECRET());
  const ok = await one(`SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND NOT u.banned`, [sid, uid]);
  if (!ok) throw new Error('session revoked');
  return { sid, uid };
}

export async function requireAuth(req, res, next) {
  try {
    const { sid, uid } = await authenticate((req.headers.authorization || '').replace(/^Bearer /, ''));
    req.uid = uid; req.sid = sid;
    q('UPDATE users SET last_seen_at=now() WHERE id=$1 AND last_seen_at < now() - interval \'5 minutes\'', [uid]).catch(() => {});
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again' });
  }
}

export const authRouter = Router();

authRouter.post('/otp/request', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid mobile number' });
  const demo = process.env.DEMO_PHONE && phone === normalizePhone(process.env.DEMO_PHONE);
  const prev = await one('SELECT * FROM otp_codes WHERE phone=$1', [phone]);
  if (prev && !demo) {
    if (Date.now() - prev.last_sent_at < 30_000) return res.status(429).json({ error: 'Please wait 30 seconds before requesting another code' });
    if (Date.now() - prev.window_start < 3600_000 && prev.sent_count >= 5) return res.status(429).json({ error: 'Too many codes requested. Try again in an hour.' });
  }
  const code = demo ? process.env.DEMO_OTP : String(crypto.randomInt(100000, 1000000));
  await q(`INSERT INTO otp_codes(phone, code_hash, expires_at) VALUES ($1,$2, now() + interval '5 minutes')
    ON CONFLICT (phone) DO UPDATE SET code_hash=$2, expires_at=now() + interval '5 minutes', attempts=0, last_sent_at=now(),
      sent_count = CASE WHEN otp_codes.window_start < now() - interval '1 hour' THEN 1 ELSE otp_codes.sent_count + 1 END,
      window_start = CASE WHEN otp_codes.window_start < now() - interval '1 hour' THEN now() ELSE otp_codes.window_start END`, [phone, hash(phone, code)]);
  let sent = false;
  if (!demo) {
    try { sent = await sendSms(phone, code); } catch (e) { console.error(e.message); return res.status(502).json({ error: 'Could not send SMS, try again' }); }
  }
  res.json({ ok: true, phone, ...(!sent && process.env.OTP_DEV === 'true' && !demo ? { devCode: code } : {}) });
});

authRouter.post('/otp/verify', async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const row = phone && await one('SELECT * FROM otp_codes WHERE phone=$1', [phone]);
  if (!row || row.expires_at < new Date()) return res.status(400).json({ error: 'Code expired, request a new one' });
  if (row.attempts >= 5) return res.status(429).json({ error: 'Too many attempts, request a new code' });
  if (!crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash(phone, String(req.body.code || ''))))) {
    await q('UPDATE otp_codes SET attempts=attempts+1 WHERE phone=$1', [phone]);
    return res.status(400).json({ error: 'Incorrect code' });
  }
  await q('UPDATE otp_codes SET expires_at=now() WHERE phone=$1', [phone]);
  const user = await one(`INSERT INTO users(phone) VALUES ($1) ON CONFLICT (phone) DO UPDATE SET phone=EXCLUDED.phone
    RETURNING id, onboarded, banned, (xmax = 0) AS created`, [phone]);
  if (user.banned) return res.status(403).json({ error: 'This account has been suspended' });
  if (user.created) track(user.id, 'signup', { method: 'phone' });
  res.json(await startSession(user, 'phone'));
});

authRouter.post('/google', async (req, res) => {
  const allowed = (process.env.GOOGLE_CLIENT_IDS || '').split(',').filter(Boolean);
  if (!allowed.length) return res.status(501).json({ error: 'Google login is not configured' });
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.idToken || '')}`);
  const info = await r.json();
  if (!r.ok || !allowed.includes(info.aud) || info.email_verified !== 'true') return res.status(401).json({ error: 'Google sign-in failed' });
  const user = await one(`INSERT INTO users(google_id, email) VALUES ($1,$2) ON CONFLICT (google_id) DO UPDATE SET email=$2
    RETURNING id, onboarded, banned, (xmax = 0) AS created`, [info.sub, info.email]);
  if (user.banned) return res.status(403).json({ error: 'This account has been suspended' });
  if (user.created) track(user.id, 'signup', { method: 'google' });
  res.json(await startSession(user, 'google'));
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await q('UPDATE sessions SET revoked_at=now() WHERE id=$1', [req.sid]);
  await q('UPDATE users SET push_token=NULL WHERE id=$1', [req.uid]);
  res.json({ ok: true });
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await q('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [req.uid]);
  track(req.uid, 'audit.logout_all');
  res.json({ ok: true });
});
