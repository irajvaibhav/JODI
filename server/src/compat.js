import { SIGNS, ELEMENTS, NAKSHATRAS, elementOf } from './astro.js';

// Single source of truth for onboarding options; the app fetches this from GET /meta.
export const META = {
  interests: ['Travel', 'Music', 'Reading', 'Fitness', 'Food', 'Movies', 'Art', 'Tech', 'Dance', 'Photography', 'Gaming', 'Yoga',
    'Cooking', 'Fashion', 'Cricket', 'Football', 'Trekking', 'Poetry', 'Anime', 'Startups', 'Pets', 'Coffee', 'Spirituality',
    'Astrology', 'Stand-up', 'Theatre', 'Volunteering', 'Cars', 'Podcasts', 'Board games'],
  personality: [
    { key: 'social', q: 'A perfect weekend is…', low: 'Cozy night in', high: 'Out with friends', trait: 'social energy' },
    { key: 'plan', q: 'Trips should be…', low: 'Fully planned', high: 'Totally spontaneous', trait: 'planning style' },
    { key: 'talk', q: 'In conversations you are…', low: 'The listener', high: 'The talker', trait: 'conversation balance', complementary: true },
    { key: 'adventure', q: 'Trying new things is…', low: 'Nice, sometimes', high: 'My whole personality', trait: 'love of adventure' },
    { key: 'heart', q: 'Big decisions come from your…', low: 'Head', high: 'Heart', trait: 'decision-making style' },
    { key: 'ambition', q: 'Career right now is…', low: 'Chill', high: 'Top priority', trait: 'ambition' },
    { key: 'romance', q: 'Romance means…', low: 'Small daily gestures', high: 'Grand surprises', trait: 'idea of romance' },
    { key: 'humor', q: 'Your humour is…', low: 'Dry & witty', high: 'Silly & goofy', trait: 'sense of humour' },
  ],
  lifestyle: {
    drink: { label: 'Drinking', options: ['Never', 'Socially', 'Often'] },
    smoke: { label: 'Smoking', options: ['Never', 'Sometimes', 'Yes'] },
    workout: { label: 'Workout', options: ['Rarely', 'Sometimes', 'Daily'] },
    diet: { label: 'Diet', options: ['Vegetarian', 'Eggetarian', 'Non-veg', 'Vegan'] },
    sleep: { label: 'Sleep', options: ['Early bird', 'Night owl', 'Depends'] },
  },
  intents: ['Long-term relationship', 'Something casual', 'New friends', 'Still figuring it out'],
  genders: ['Woman', 'Man', 'Non-binary'],
  reportReasons: ['Fake profile', 'Inappropriate photos', 'Harassment', 'Spam or scam', 'Underage', 'Other'],
};

// Open decision in the PRD ("how much weight should astrology have") — tune here.
export const WEIGHTS = { astro: 0.35, interests: 0.25, personality: 0.2, lifestyle: 0.2 };

const GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]; // 0 Deva, 1 Manushya, 2 Rakshasa
const NADI = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];
const GANA_SCORE = { '00': 100, '11': 100, '22': 100, '01': 80, '10': 80, '12': 40, '21': 40, '02': 30, '20': 30 };
const BHAKOOT = { 1: 80, 7: 85, 5: 95, 9: 95, 3: 80, 11: 80, 4: 70, 10: 70, 2: 55, 12: 55, 6: 50, 8: 50 };
const scale = raw => Math.round(55 + raw * 0.43); // keep the band friendly: 55–98

function astroScore(a, b, reasons) {
  if (!a?.sun || !b?.sun) return 60;
  const ea = elementOf(a.sun), eb = elementOf(b.sun);
  const pair = [ea, eb].sort().join('-');
  const diff = Math.abs(SIGNS.indexOf(a.sun) - SIGNS.indexOf(b.sun));
  let sun = ea === eb ? 90 : (pair === 'Air-Fire' || pair === 'Earth-Water') ? 85 : diff === 6 ? 75 : 60;
  if (a.sun === b.sun) reasons.push({ s: 0.8, text: `Same Sun sign (${a.sun}) — you'll recognise each other's energy` });
  else if (ea === eb) reasons.push({ s: 0.75, text: `Both ${ea.toLowerCase()} signs (${a.sun} + ${b.sun}) — a naturally similar wavelength` });
  else if (sun === 85) reasons.push({ s: 0.7, text: `${ea} meets ${eb} (${a.sun} + ${b.sun}) — an energising combination` });

  if (!a.moon || !b.moon || a.nakshatra == null || b.nakshatra == null) return scale(sun);
  const d = ((SIGNS.indexOf(b.moon) - SIGNS.indexOf(a.moon) + 12) % 12) + 1;
  const moon = BHAKOOT[d];
  if (moon >= 85) reasons.push({ s: 0.85, text: `Harmonious Moon signs (${a.moon} + ${b.moon}) — emotional rhythms that flow together` });
  const gana = GANA_SCORE[`${GANA[a.nakshatra]}${GANA[b.nakshatra]}`];
  if (gana === 100) reasons.push({ s: 0.6, text: `Matching temperament in Kundli terms (${NAKSHATRAS[a.nakshatra]} + ${NAKSHATRAS[b.nakshatra]})` });
  const nadi = NADI[a.nakshatra] === NADI[b.nakshatra] ? 40 : 100;
  return scale(0.3 * sun + 0.35 * moon + 0.2 * gana + 0.15 * nadi);
}

function interestScore(a = [], b = [], reasons) {
  if (!a.length || !b.length) return 55;
  const shared = a.filter(x => b.includes(x));
  if (shared.length) reasons.push({ s: 0.6 + Math.min(shared.length, 4) * 0.1, text: `You both love ${shared.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' & $1')}` });
  return scale(100 * Math.min(1, shared.length / Math.max(1, Math.min(a.length, b.length, 5))));
}

function personalityScore(a = {}, b = {}, reasons) {
  const qs = META.personality.filter(p => a[p.key] && b[p.key]);
  if (!qs.length) return 55;
  let best = null, total = 0;
  for (const p of qs) {
    const fit = p.complementary ? 100 - Math.abs(a[p.key] + b[p.key] - 6) * 25 : 100 - Math.abs(a[p.key] - b[p.key]) * 25;
    total += fit;
    if (fit === 100 && (!best || p.complementary)) best = p;
  }
  if (best) reasons.push({ s: 0.7, text: best.complementary ? `Great ${best.trait} — one of you talks, one listens` : `Similar ${best.trait}` });
  return scale(total / qs.length);
}

function lifestyleScore(a = {}, b = {}, reasons) {
  const keys = Object.keys(META.lifestyle).filter(k => a[k] && b[k]);
  if (!keys.length) return 55;
  const same = keys.filter(k => a[k] === b[k]);
  const label = { drink: 'drinking habits', smoke: 'take on smoking', workout: 'fitness routine', diet: 'food preferences', sleep: 'sleep schedule' };
  if (same.length >= 2) reasons.push({ s: 0.55 + same.length * 0.05, text: `Same ${same.slice(0, 2).map(k => label[k]).join(' and ')}` });
  return scale(100 * same.length / keys.length);
}

/** Deterministic, auditable compatibility. `x` = { astro, interests, personality, lifestyle, intent }. */
export function compatibility(x, y) {
  const reasons = [];
  const parts = {
    astro: astroScore(x.astro, y.astro, reasons),
    interests: interestScore(x.interests, y.interests, reasons),
    personality: personalityScore(x.personality, y.personality, reasons),
    lifestyle: lifestyleScore(x.lifestyle, y.lifestyle, reasons),
  };
  let overall = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + parts[k] * w, 0);
  if (x.intent && y.intent && x.intent === y.intent) reasons.push({ s: 0.65, text: `Looking for the same thing: ${y.intent.toLowerCase()}` });
  else if (x.intent && y.intent) overall -= 4;
  reasons.sort((p, q) => q.s - p.s);
  const fill = ['Profiles with a strong overall overlap', 'Balanced energy across interests and lifestyle', 'Room to discover new things together'];
  while (reasons.length < 3) reasons.push({ s: 0, text: fill[reasons.length] });
  return { overall: Math.round(overall), ...parts, reasons: reasons.slice(0, 4).map(r => r.text) };
}

export { SIGNS, ELEMENTS };
