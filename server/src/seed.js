// Demo data for client demos / closed alpha warm-up.
//   npm run seed          -> creates 50 demo profiles (phones +910000000xxx)
//   npm run seed likes    -> makes ~40% of demo profiles send a Jodi to every real user (so Likes / matches can be demoed)
//   npm run seed purge    -> deletes all demo profiles
import { q, one, migrate, encrypt, pool } from './db.js';
import { computeAstro } from './astro.js';
import { META } from './compat.js';

const CITIES = [['Delhi', 28.61, 77.21], ['Mumbai', 19.08, 72.88], ['Bengaluru', 12.97, 77.59], ['Pune', 18.52, 73.86], ['Hyderabad', 17.39, 78.49],
  ['Jaipur', 26.91, 75.79], ['Kolkata', 22.57, 88.36], ['Chennai', 13.08, 80.27], ['Ahmedabad', 23.02, 72.57], ['Chandigarh', 30.73, 76.78], ['Gurugram', 28.46, 77.03]];
const WOMEN = ['Ananya', 'Riya', 'Priya', 'Ishita', 'Meera', 'Kavya', 'Sanya', 'Aditi', 'Tara', 'Nisha', 'Zoya', 'Diya', 'Pooja', 'Simran', 'Aisha',
  'Neha', 'Shreya', 'Tanvi', 'Mahi', 'Anjali', 'Kritika', 'Sneha', 'Radhika', 'Nandini', 'Ira'];
const MEN = ['Rohan', 'Arjun', 'Kabir', 'Vihaan', 'Aarav', 'Dev', 'Karan', 'Ishaan', 'Rahul', 'Aditya', 'Neel', 'Sameer', 'Yash', 'Varun', 'Kunal',
  'Siddharth', 'Manav', 'Harsh', 'Pranav', 'Aryan', 'Nikhil', 'Rehan', 'Abhinav', 'Dhruv', 'Arnav'];
// Hand-picked free-license Unsplash portraits of Indian adults (checked: single person, adult, no children). Demo only — purge before real users.
const PHOTOS = {
  women: [
    '1536766768598-e09213fdcf22', '1617297873650-aef8f4e00b9b', '1733316456795-5dded1b921fb', '1706943262459-3ef6ce03305c', '1624610806209-82a4cbb4339a',
    '1624610260135-8b3504b3ea27', '1677339276374-28460a1c2218', '1749700332258-775b1b6b9cd5', '1628620835051-8f40f48c928d', '1678855904567-d9e73fa2e01d',
    '1630001603446-585f8a8d5527', '1747264464985-2bc2e20c739e', '1554733998-0ddd4f28f5d0', '1761125135357-99cbe52a6271', '1767607740661-05e668190cdc',
    '1766749365634-0b6852c2a7e4', '1776440553775-75fc7e32abf7', '1595754883593-e274aaa13580', '1725611224357-52baf3c4e9b5', '1725611224180-4a50ef13a0e8',
    '1769275060315-905dd80915c9', '1759840278381-bf7d5e332050', '1596196524143-569109d9a645', '1789500381106-ba13068a6520', '1774437891793-2013f7b5a04a',
  ],
  men: [
    '1670110531916-41045e83cb0a', '1724225618359-a1d2763326f9', '1697517529954-b6845f3245a0', '1712425718137-491250cfde88', '1663560454891-9bdbdaaed84d',
    '1705513054794-d18a8eb0af6c', '1577933679437-f3171f9b963a', '1647689662423-7948c8523256', '1552642986-ccb41e7059e7', '1508341591423-4347099e1f19',
    '1762066436642-945a40f35097', '1581382575275-97901c2635b7', '1609770653328-a4d1dd377970', '1776007087050-dbc004f5d17c', '1637589274892-9bc2d5200eab',
    '1581072196863-ef8e23a4fac6', '1775342369616-f23a25e866d3', '1549045337-967927d923c0', '1637651808680-d054b0744fe8', '1569128782402-d1ec3d0c1b1b',
    '1603693857971-1005ce2939a0', '1785613590822-2c715efbc664', '1649433658557-54cf58577c68', '1638368349569-e49499196d9f', '1694871420416-9feeb629dda4',
  ],
};
const BIOS = ['Coffee lover | Dreamer | Books & travel', 'Weekend trekker, weekday coder ☕', 'Will judge you by your playlist 🎧', 'Foodie on a mission to find the best momos',
  'Startup brain, filmy heart', 'Sunsets, poetry and long drives', 'Gym in the morning, Netflix at night', 'Looking for someone to explore cafés with',
  'Dog parent 🐶 | amateur photographer', 'Trying to read 30 books this year 📚'];
const JOBS = ['Product Designer', 'Software Engineer', 'Marketing Manager', 'Doctor', 'Architect', 'Founder', 'Content Creator', 'CA', 'Data Analyst', 'Teacher'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);

async function create() {
  for (let i = 0; i < 50; i++) {
    const woman = i % 2 === 0;
    const name = (woman ? WOMEN : MEN)[Math.floor(i / 2)];
    const [city, lat, lng] = pick(CITIES);
    const dob = `${1996 + Math.floor(Math.random() * 10)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`;
    const time = `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`;
    const astro = computeAstro({ dob, time, lat, lng, tz: 'Asia/Kolkata' });
    const u = await one(`INSERT INTO users(phone, dob, onboarded) VALUES ($1,$2,true) ON CONFLICT (phone) DO UPDATE SET dob=$2 RETURNING id`, [`+910000000${String(i).padStart(3, '0')}`, dob]);
    await q(`INSERT INTO profiles(user_id, name, gender, bio, city, lat, lng, profession, interests, personality, lifestyle) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (user_id) DO NOTHING`, [u.id, name, woman ? 'Woman' : 'Man', pick(BIOS), city, lat, lng, pick(JOBS), sample(META.interests.slice(0, 16), 4 + Math.floor(Math.random() * 3)),
      Object.fromEntries(META.personality.map(p => [p.key, 1 + Math.floor(Math.random() * 5)])),
      Object.fromEntries(Object.entries(META.lifestyle).map(([k, v]) => [k, pick(v.options)]))]);
    await q(`INSERT INTO astro(user_id, birth_enc, time_known, sun, moon, rising, nakshatra, element) VALUES ($1,$2,true,$3,$4,$5,$6,$7) ON CONFLICT (user_id) DO NOTHING`,
      [u.id, encrypt({ dob, time, place: `${city}, India` }), astro.sun, astro.moon, astro.rising, astro.nakshatra, astro.element]);
    await q(`INSERT INTO preferences(user_id, genders, age_min, age_max, max_km, intent) VALUES ($1,$2,18,40,1000,$3) ON CONFLICT (user_id) DO NOTHING`,
      [u.id, [woman ? 'Man' : 'Woman'], META.intents[Math.floor(i / 2) % META.intents.length]]); // spread within each gender so every intent has matches
    const has = await one(`SELECT count(*)::int n FROM media WHERE owner_id=$1`, [u.id]);
    if (!has.n) {
      const id = PHOTOS[woman ? 'women' : 'men'][Math.floor(i / 2)];
      const r = await fetch(`https://images.unsplash.com/photo-${id}?w=1080&h=1350&fit=crop&crop=faces&fm=jpg&q=80`);
      if (r.ok) await q(`INSERT INTO media(owner_id, kind, position, mime, data) VALUES ($1,'profile',0,'image/jpeg',$2)`, [u.id, Buffer.from(await r.arrayBuffer())]);
      else console.warn(`photo ${id} failed: ${r.status}`);
    }
    console.log(`seeded ${name} (${astro.sun}) ${city}`);
  }
}

const cmd = process.argv[2];
await migrate();
if (cmd === 'purge') await q(`DELETE FROM users WHERE phone LIKE '+910000000%'`);
else if (cmd === 'likes') {
  const r = await q(`INSERT INTO swipes(swiper, target, action)
    SELECT d.id, u.id, 'jodi' FROM users d JOIN profiles dp ON dp.user_id=d.id JOIN preferences dpr ON dpr.user_id=d.id,
      users u JOIN profiles up ON up.user_id=u.id JOIN preferences upr ON upr.user_id=u.id
    WHERE d.phone LIKE '+910000000%' AND u.onboarded AND (u.phone IS NULL OR u.phone NOT LIKE '+910000000%')
      AND up.gender = ANY(dpr.genders) AND dp.gender = ANY(upr.genders) AND random() < 0.6
    ON CONFLICT DO NOTHING`);
  console.log(`${r.rowCount} demo likes sent`);
} else await create();
await pool.end();
