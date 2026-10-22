# Jodi

Astrology-based dating app.

- `server/` – Node 20, Express 5, Postgres, Socket.IO, Gemini
- `app/` – Expo SDK 58, React Native, expo-router

## Local setup

```bash
docker compose up -d        # Postgres on :5433

cd server
npm install
cp .env.example .env        # fill in JWT_SECRET, BIRTH_KEY, GEMINI_API_KEY
npm run dev                 # API on :4000
npm run seed                # 50 demo profiles
npm test

cd ../app
npm install
npx expo start
```

The app reads the API URL from `EXPO_PUBLIC_API_URL` (`app/.env`). Use `http://10.0.2.2:4000` for the Android emulator, or your PC's LAN IP for a real phone.

Demo login: `9999999999` / `123456`. With `OTP_DEV=true` the code for any number is shown on screen.
`npm run seed likes` makes demo profiles like your test accounts so the likes/match/chat flow can be shown.

## Deploy

**API** – Render blueprint (`render.yaml`). Set `DATABASE_URL`, `GEMINI_API_KEY`, `BIRTH_KEY` (`openssl rand -hex 32`, never change it once there's real data), `ADMIN_TOKEN` and `GOOGLE_CLIENT_IDS`. Pushing to `main` redeploys.

Seed the hosted DB once from `server/`:

```bash
DATABASE_URL=<url> BIRTH_KEY=<same key> npm run seed
```

**App** – EAS:

```bash
cd app
npx eas-cli@latest build -p android --profile preview      # installable APK
npx eas-cli@latest build -p android --profile production   # Play Store bundle
```

**Admin** – `https://<api>/admin` with `ADMIN_TOKEN`: report queue and funnel metrics.

## Before going live

- SMS OTP: set `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID`, then `OTP_DEV=false`
- `DEMO_LIKES=false`, and `npm run seed purge` to remove demo profiles
- Push notifications: upload an FCM V1 key in EAS (`eas credentials`)
- Google login: add the build's SHA-1 as an Android OAuth client in Google Cloud
- Have the privacy policy and terms (`server/src/pages.js`) reviewed

## Known limits

- Photos are stored in Postgres; move to object storage once usage grows.
- Discover scores up to 500 candidates per request in Node.
- The 9am daily push runs in-process, so run a single API instance.
- Without `GEMINI_API_KEY`, AI text falls back to templates.
