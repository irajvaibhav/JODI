import pg from 'pg';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

const ssl = /sslmode=require|neon\.tech|supabase|render\.com/.test(process.env.DATABASE_URL || '')
  ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl, max: 10 });

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0];

export async function migrate() {
  await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
}

export function track(userId, name, props = {}) {
  pool.query('INSERT INTO events(user_id, name, props) VALUES ($1,$2,$3)', [userId, name, props])
    .catch(e => console.error('track', e.message));
}

// AES-256-GCM for birth details. BIRTH_KEY should be 64 hex chars; any other value is hashed to 32 bytes
// so a mistyped key degrades to "still encrypted" instead of every birth-details save failing.
const key = () => {
  const k = process.env.BIRTH_KEY || '';
  return /^[0-9a-f]{64}$/i.test(k) ? Buffer.from(k, 'hex') : crypto.createHash('sha256').update(k).digest();
};
export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function decrypt(s) {
  const [iv, tag, data] = s.split('.').map(p => Buffer.from(p, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString());
}

export const ageFrom = dob => {
  const d = new Date(dob), now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
};
