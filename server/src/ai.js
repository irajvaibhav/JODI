import { one, q } from './db.js';
import { SIGN_VIBES, NAKSHATRAS } from './astro.js';

// tried in order; falls through on 503/404/429
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash,gemini-3.5-flash-lite').split(',').map(s => s.trim()).filter(Boolean);

const GUARDRAILS = `You write copy for Jodi, an astrology-flavoured dating app for Indian Gen-Z (18-30).
Rules you must always follow:
- Astrology is a fun, exploratory signal. Never claim guaranteed matches, destiny, soulmates, or that anyone is unsuitable.
- Use soft language: "might vibe", "strong overlap", "could click".
- Never mention or guess birth dates, birth times, birth places, ages beyond what is given, caste, religion, health, mental health, income, or other sensitive traits.
- Only use the facts provided. Keep it warm, playful, short, and inclusive. No explicit or sexual content.`;

async function gemini(prompt, { image, maxTokens = 400 } = {}) {
  if (!process.env.GEMINI_API_KEY) return null;
  const parts = [{ text: prompt }];
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data.toString('base64') } });
  for (const model of MODELS) {
    for (const thinking of [{ thinkingConfig: { thinkingBudget: 0 } }, {}]) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: GUARDRAILS }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: maxTokens, ...thinking },
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (r.status === 400 && thinking.thinkingConfig) continue;
        if (!r.ok) { console.error('gemini', model, r.status, (await r.text()).slice(0, 150)); break; }
        const text = (await r.json()).candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        return JSON.parse(text);
      } catch (e) {
        console.error('gemini', model, e.message);
        break;
      }
    }
  }
  return null;
}

const LEAKS = [
  /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/, /\b\d{4}-\d{2}-\d{2}\b/, /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i, /\b(19|20)\d{2}\b/,
  /\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i,
  /\b(guarantee|destined|soul ?mate|unsuitable|incompatible|caste|religio|perfect match|meant to be)/i,
];
export const safe = s => typeof s === 'string' && s.trim() && s.length < 400 && !LEAKS.some(r => r.test(s));
const safeList = (xs, n) => Array.isArray(xs) && xs.filter(safe).length >= n ? xs.filter(safe).slice(0, n) : null;

async function cached(key, fn) {
  const hit = await one('SELECT value FROM ai_cache WHERE key=$1', [key]);
  if (hit) return hit.value;
  const value = await fn();
  if (value?.ai) await q('INSERT INTO ai_cache(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2', [key, value]);
  return value;
}

// only public fields go into prompts
const pub = p => ({ name: p.name, interests: p.interests, bio: p.bio, sun: p.astro?.sun, moon: p.astro?.moon, profession: p.profession });

export function vibe(me, them, compat, version) {
  return cached(`vibe:${[me.id, them.id].sort().join(':')}:${version}`, async () => {
    const out = await gemini(`Write "Why You Might Vibe" for ${me.name} looking at ${them.name}.
Deterministic compatibility signals (the only facts you may rely on): ${JSON.stringify({ scores: compat, reasons: compat.reasons })}
Public profiles: ${JSON.stringify({ viewer: pub(me), other: pub(them) })}
Return JSON {"headline": "<=8 words", "reasons": ["3 reasons, each <=14 words, addressed to the viewer as 'you both'/'you two'"], "tip": "one playful cosmic tip <=18 words"}`);
    const reasons = safeList(out?.reasons, 3);
    if (reasons && safe(out.headline) && safe(out.tip)) return { ai: true, headline: out.headline, reasons, tip: out.tip };
    return { ai: false, headline: compat.overall >= 80 ? 'Strong cosmic overlap ✨' : 'You two might vibe', reasons: compat.reasons.slice(0, 3), tip: 'Start with what you both love — the stars can only do so much!' };
  });
}

export async function icebreakers(me, them, compat) {
  const out = await gemini(`Write 3 different opening messages ${me.name} could send to ${them.name} on a dating app.
Make them specific to shared interests or profile details, friendly, light, not cheesy, no pickup lines, each <=22 words, max one emoji.
Facts: ${JSON.stringify({ sender: pub(me), receiver: pub(them), sharedReasons: compat.reasons })}
Return JSON {"icebreakers": ["...", "...", "..."]}`);
  const list = safeList(out?.icebreakers, 3);
  if (list) return list;
  const shared = (me.interests || []).filter(x => (them.interests || []).includes(x));
  return [
    shared[0] ? `Okay, fellow ${shared[0].toLowerCase()} fan — what got you into it?` : `Hey ${them.name}! What's the best thing that happened to you this week?`,
    them.astro?.sun ? `${/^[AEIOU]/.test(them.astro.sun) ? 'An' : 'A'} ${them.astro.sun}! Tell me, does your sign actually describe you? 😄` : `What's one thing your bio doesn't say about you?`,
    `If we grabbed coffee this weekend, where in ${them.city || 'town'} would you take me?`,
  ];
}

export async function dailyText(me, them, compat) {
  const out = await gemini(`Write today's "Daily Cosmic" card for ${me.name} (Sun ${me.astro?.sun || 'unknown'}, Moon ${me.astro?.moon || 'unknown'}).
Their recommended Jodi today is ${them ? `${them.name}, overlap reasons: ${JSON.stringify(compat.reasons)}` : 'not available'}.
Return JSON {"title": "2-3 words", "message": "<=30 words upbeat outlook for connection today", "loveTip": "<=16 words", "why": "<=20 words on why today's Jodi might vibe"}`);
  if (out && ['title', 'message', 'loveTip'].every(k => safe(out[k])) && (!them || safe(out.why))) return { ai: true, ...out };
  return {
    ai: false, title: 'Love Vibes', message: 'The universe is nudging you toward new connections. Keep an open heart and say hi first today.',
    loveTip: 'Be yourself — the right people will love you for it.', why: compat?.reasons?.[0] || '',
  };
}

export function astroSummary(userId, a) {
  return cached(`astro:${userId}:${a.sun}:${a.moon}:${a.rising}:${a.nakshatra}`, async () => {
    const facts = { sun: a.sun, moon: a.moon, rising: a.rising, nakshatra: a.nakshatra != null ? NAKSHATRAS[a.nakshatra] : null };
    const out = await gemini(`Explain this astro profile to someone who knows nothing about astrology, in second person, playful and positive.
${JSON.stringify(facts)}
Return JSON {"summary": "<=45 words", "inLove": "<=25 words on how they show up in relationships", "bestWith": ["3 Sun signs they often click with"]}`);
    if (out && safe(out.summary) && safe(out.inLove)) return { ai: true, ...out };
    return {
      ai: false,
      summary: `Your Sun in ${a.sun} makes you ${SIGN_VIBES[a.sun]}.${a.moon ? ` Your Moon in ${a.moon} shows you feel things in a way that's ${SIGN_VIBES[a.moon]}.` : ''}`,
      inLove: `In love you're ${SIGN_VIBES[a.moon || a.sun]}.`, bestWith: [],
    };
  });
}

const SCAM = /(upi|paytm|gpay|phonepe|bitcoin|crypto|invest(ment)?|send (me )?money|whats ?app me|telegram|onlyfans|\b\d{10}\b|\+91)/i;
const ABUSE = /\b(f+u+c+k+ (you|off)|bitch|slut|whore|randi|madarchod|behenchod|chutiya|kill yourself|kys)\b/i;

export function quickTextCheck(text) {
  if (ABUSE.test(text)) return 'harassment';
  if (SCAM.test(text)) return 'possible_scam';
  return null;
}
export async function deepTextCheck(text) {
  const out = await gemini(`Classify this dating-app chat message for safety. Message: ${JSON.stringify(text)}
Return JSON {"category": "ok|spam|scam|harassment|sexual|hate|self_harm|minor", "severity": "low|high"}`, { maxTokens: 60 });
  return out && out.category !== 'ok' ? out : null;
}
export async function moderateImage(data, mime) {
  const out = await gemini(`Is this an acceptable dating-profile photo? Reject nudity, sexual content, violence, weapons, hate symbols, apparent minors, or images with phone numbers/QR codes.
Return JSON {"ok": true|false, "reason": "short"}`, { image: { data, mime }, maxTokens: 60 });
  return out ? { ok: out.ok !== false, reason: out.reason } : { ok: true };
}
