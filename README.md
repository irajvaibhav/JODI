# Jodi — Astro-powered dating MVP

```
server/   Node 20+ · Express 5 · Postgres · Socket.IO · Gemini   (the API)
app/      Expo SDK 58 · React Native · expo-router               (the Android/iOS app → APK)
```

## Run locally (5 min)

```bash
docker compose up -d                       # Postgres on :5433
cd server && npm install
cp .env.example .env                       # already done for you, secrets generated; add GEMINI_API_KEY
npm run dev                                # API on :4000
npm run seed                               # 50 demo profiles (Indian names, cities, photos)
npm test                                   # astro / compatibility / privacy-filter tests

cd ../app && npm install
npx expo start --web                       # browser preview (EXPO_PUBLIC_API_URL=http://localhost:4000)
```

Demo login: phone **9999999999**, OTP **123456**. Any other number works too; while `OTP_DEV=true`, the code is shown on screen.
After you onboard a test account, run `npm run seed likes` so demo profiles "like" you and the Likes / match / chat flow can be shown.

## Ship the APK to the client

1. **Database:** create a free Postgres on [neon.tech](https://neon.tech). Copy the connection string.
2. **API:** push this repo to GitHub, then go to [render.com](https://render.com) → New → Blueprint and pick the repo (uses `render.yaml`).
   Fill in `DATABASE_URL`, `GEMINI_API_KEY` and `BIRTH_KEY` (`openssl rand -hex 32`). Then seed it once from your PC:
   `DATABASE_URL=<neon url> BIRTH_KEY=<same key> npm run seed` (from `server/`).
3. **App:** put the Render URL into `app/eas.json` (`EXPO_PUBLIC_API_URL`, both profiles), then:
   ```bash
   cd app
   npx eas-cli@latest login          # free Expo account
   npx eas-cli@latest init           # links project, adds projectId (also enables push)
   npx eas-cli@latest build -p android --profile preview
   ```
   EAS prints a link to the `.apk`. Send that link to the client.
4. **Admin:** `https://<api>/admin` → paste `ADMIN_TOKEN` → funnel metrics (PRD §9) + report queue (dismiss / ban).

## Before real users (closed alpha)

| Item | How |
|---|---|
| Real SMS OTP | MSG91 account → set `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, then `OTP_DEV=false` |
| Push notifications on Android | Firebase project → upload FCM V1 key in EAS (`eas credentials`) |
| Remove demo profiles | `npm run seed purge`. The 50 demo profiles use free-license Unsplash portraits of real people, so never show them to real users as if they were members |
| Google login | API ready (`POST /auth/google`, set `GOOGLE_CLIENT_IDS`); app button not added yet |
| Legal | Terms, Privacy Policy, astrology disclaimer text (PRD open decision) |

## What's built (PRD MVP checklist)

- [x] Splash, onboarding (18+ gate → birth details → photos → profile + interests → personality + lifestyle → preferences → Astro Profile)
- [x] Astrology engine: Sun (Western) + Vedic Moon/Rashi, Rising/Lagna, Nakshatra (Lahiri). Unknown birth time is supported
- [x] Compatibility: Astro (element, bhakoot, gana, nadi) + Interests + Personality + Lifestyle + intent → overall score + 3+ reasons (`server/src/compat.js`, weights in `WEIGHTS`)
- [x] Discover swipe cards with filters (All / Same Zodiac / Kundli / Hobbies), Jodi / Pass, mutual match
- [x] "Why You Might Vibe" (Gemini, grounded on deterministic signals) + Cosmic Tip
- [x] IT'S A JODI screen, AI icebreakers (send / regenerate / edit), real-time chat (text, emoji, photos, typing)
- [x] Report / Block / Unmatch from profile + chat; report queue with human review in /admin
- [x] Daily Cosmic Jodi + 9am push, Likes ("Someone's interested in you")
- [x] Compatibility Card share (image + public link `/c/:code`, no birth data, no photos)
- [x] Settings: edit everything, notifications + quiet hours, blocked users, privacy explainer, discoverability, export data, delete astro data, delete account, log out everywhere
- [x] Moderation: Gemini photo check on upload, chat text (instant keyword block + async Gemini → auto report), profile text check
- [x] Privacy: birth details AES-256-GCM encrypted; a whitelist serializer for other users; AI output filter strips dates, times and deterministic claims
- [x] Analytics events for the full funnel; metrics in /admin
- [ ] GIF picker in chat (needs a Giphy/Tenor key), Google sign-in button, referral rewards (PRD "later")

## Notes / deliberate shortcuts
- Images are stored in Postgres (`media` table). Move them to S3/R2 + CDN beyond a few thousand users.
- Discover scores up to 500 candidates per request in Node. Fine for the alpha; precompute or cache in Redis at scale.
- The daily push job runs in-process. Run a single API instance, or move it to a cron service.
- Without `GEMINI_API_KEY`, all AI copy falls back to templates, so the app still works.
