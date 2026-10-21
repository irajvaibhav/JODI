import * as A from 'astronomy-engine';

export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const ELEMENTS = ['Fire', 'Earth', 'Air', 'Water'];
export const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];

// Plain-language one-liners so users needn't know astrology terms.
export const SIGN_VIBES = {
  Aries: 'bold, energetic and quick to start things', Taurus: 'grounded, loyal and fond of life\'s comforts',
  Gemini: 'curious, witty and great at conversation', Cancer: 'caring, intuitive and home-loving',
  Leo: 'warm, expressive and generous', Virgo: 'thoughtful, practical and detail-minded',
  Libra: 'charming, fair-minded and harmony-seeking', Scorpio: 'intense, loyal and deeply perceptive',
  Sagittarius: 'adventurous, optimistic and freedom-loving', Capricorn: 'ambitious, steady and dependable',
  Aquarius: 'original, independent and idealistic', Pisces: 'dreamy, empathetic and creative',
};

const norm = d => ((d % 360) + 360) % 360;
const rad = d => d * Math.PI / 180;
const signOf = lon => SIGNS[Math.floor(norm(lon) / 30)];
export const elementOf = sign => ELEMENTS[SIGNS.indexOf(sign) % 4];

// Lahiri ayanamsa, linear approximation (~0.01° accurate for 1900–2100).
const ayanamsa = date => 23.85675 + (50.2879 / 3600) * ((date - Date.UTC(2000, 0, 1, 12)) / 31557600000);

function tzOffsetMs(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(x => [x.type, x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

// Local wall-clock time in an IANA zone -> UTC Date (second pass handles DST edges).
export function zonedToUtc(dob, time, tz) {
  const [y, m, d] = dob.split('-').map(Number);
  const [hh, mm] = (time || '12:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffsetMs(new Date(guess), tz);
  return new Date(guess - tzOffsetMs(new Date(first), tz));
}

/**
 * Western Sun sign (what Gen-Z already knows from horoscopes) + Vedic (sidereal, Lahiri) Moon sign,
 * Rising and Nakshatra (what Kundli matching uses). Unknown birth time -> noon, no Rising.
 */
export function computeAstro({ dob, time, lat, lng, tz }) {
  const date = zonedToUtc(dob, time, tz || 'Asia/Kolkata');
  const ay = ayanamsa(date.getTime());
  const sunTropical = A.SunPosition(date).elon;
  const moonSid = norm(A.EclipticGeoMoon(date).lon - ay);
  let rising = null;
  if (time && lat != null && lng != null) {
    const lst = rad(norm(A.SiderealTime(date) * 15 + lng));
    const T = (date - Date.UTC(2000, 0, 1, 12)) / 3155760000000;
    const eps = rad(23.4392911 - 0.0130042 * T);
    const asc = Math.atan2(Math.cos(lst), -(Math.sin(lst) * Math.cos(eps) + Math.tan(rad(lat)) * Math.sin(eps))) * 180 / Math.PI;
    rising = signOf(asc - ay);
  }
  const sun = signOf(sunTropical);
  return { sun, moon: signOf(moonSid), rising, nakshatra: Math.floor(moonSid / (360 / 27)), element: elementOf(sun), timeKnown: !!time };
}

export async function geocode(place) {
  const [name, ...rest] = place.split(',').map(s => s.trim()).filter(Boolean);
  if (!name) return null;
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=5&name=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(5000) });
  const results = (await r.json()).results || [];
  const hint = rest.join(' ').toLowerCase();
  const best = results.find(x => hint && (hint.includes((x.country || '').toLowerCase()) || hint.includes((x.admin1 || '').toLowerCase()))) || results[0];
  return best && { lat: best.latitude, lng: best.longitude, tz: best.timezone, label: [best.name, best.admin1, best.country].filter(Boolean).join(', ') };
}

export async function searchPlaces(qs) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&name=${encodeURIComponent(qs)}`, { signal: AbortSignal.timeout(5000) });
  return ((await r.json()).results || []).map(x => ({ label: [x.name, x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lng: x.longitude }));
}
