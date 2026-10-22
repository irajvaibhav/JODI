// homepage, privacy policy and terms (needed for Google OAuth / Play Store)

const contact = () => (process.env.SUPPORT_EMAIL ? `<a href="mailto:${process.env.SUPPORT_EMAIL}">${process.env.SUPPORT_EMAIL}</a>` : 'Help & Support inside the app');

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Jodi</title><style>
body{margin:0;background:#0B0A1F;color:#e8e6f5;font:16px/1.65 system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:32px 16px 64px}
h1{font-weight:300;letter-spacing:6px;color:#C9A7FF;margin:0 0 4px}h2{color:#fff;margin-top:32px}a{color:#F3B5E3}small{color:#A9A5C8}
.cta{display:inline-block;margin-top:20px;padding:14px 28px;border-radius:999px;background:linear-gradient(90deg,#C9A7FF,#F3B5E3);color:#1A1033;font-weight:700;text-decoration:none}
nav{margin-top:40px;font-size:14px}nav a{margin-right:16px}</style></head><body><main>${body}
<nav><a href="/">Home</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms</a></nav></main></body></html>`;

export const home = () => page('Dating, written in the stars', `
<h1>J✦DI</h1><p><small>Same Stars. Better Matches.</small></p>
<h2>Dating, written in the stars</h2>
<p>Jodi helps you discover people you might genuinely vibe with — combining astrology, interests, personality and lifestyle,
and explaining <em>why</em> two people might connect. Swipe, match, break the ice with AI-suggested openers, and get a Daily Cosmic Jodi.</p>
<p>Jodi is for adults 18+. Compatibility is a fun discovery signal, never a guarantee.</p>
${process.env.APP_DOWNLOAD_URL ? `<a class="cta" href="${process.env.APP_DOWNLOAD_URL}">Get the app</a>` : ''}`);

export const privacy = () => page('Privacy Policy', `
<h1>J✦DI</h1><h2>Privacy Policy</h2><p><small>Last updated: October 2026</small></p>
<h2>What we collect</h2>
<ul>
<li><b>Account:</b> your mobile number, or your Google account's email and ID if you sign in with Google.</li>
<li><b>Profile:</b> name, gender, photos, bio, city, profession, education, interests, personality answers, lifestyle choices and dating preferences.</li>
<li><b>Birth details:</b> date, time and place of birth, used to calculate your astrology profile.</li>
<li><b>Activity:</b> who you like or pass, matches, messages and photos you send, reports and blocks, and app usage events.</li>
<li><b>Device:</b> a push-notification token if you allow notifications.</li>
</ul>
<h2>How birth details are protected</h2>
<p>Your exact birth date, time and place are encrypted and are <b>never shown to other users</b> — not on your profile, not in compatibility
explanations, and not on share cards. Others see only your age and high-level signs (Sun, Moon, Rising). Your date of birth is kept to confirm you are 18+.</p>
<h2>How we use your data</h2>
<ul>
<li>To show you profiles and calculate compatibility, and to show your profile to others.</li>
<li>To generate explanations, icebreakers and daily content with AI (Google Gemini). Only public profile details and compatibility signals are sent — never your exact birth details or contact information.</li>
<li>To keep Jodi safe: automated and human review of photos, messages and reports to stop spam, scams and harassment.</li>
<li>To improve the product using aggregated usage statistics.</li>
</ul>
<h2>Who we share it with</h2>
<p>We don't sell your data. We use service providers to run Jodi: hosting (Render), database (Supabase), AI (Google Gemini), push notifications (Expo / Google Firebase)
and SMS delivery for login codes. They process data only to provide these services.</p>
<h2>Your choices</h2>
<ul>
<li>Edit your profile and preferences, hide yourself from Discover, or block and report people at any time.</li>
<li>Delete your astrology data, export your data, or delete your account from Settings → Privacy &amp; Safety. Account deletion removes your profile, photos, matches, messages and birth details.</li>
</ul>
<h2>Age</h2><p>Jodi is only for people aged 18 and over. We remove accounts we believe belong to minors.</p>
<h2>Contact</h2><p>Questions or requests: ${contact()}.</p>`);

export const terms = () => page('Terms of Use', `
<h1>J✦DI</h1><h2>Terms of Use</h2><p><small>Last updated: October 2026</small></p>
<ul>
<li>You must be 18 or older and provide accurate information, including your date of birth.</li>
<li>Be respectful. No harassment, hate, nudity, scams, spam, requests for money, or impersonation. We may remove content or suspend accounts that break these rules.</li>
<li>Astrology and compatibility scores are for entertainment and discovery. They do not predict or guarantee relationship outcomes.</li>
<li>Meet safely: use public places, tell a friend, and never send money to someone you met on Jodi.</li>
<li>You own the content you post and give Jodi permission to display it within the service.</li>
<li>Jodi is provided "as is". We may update these terms and will notify you of material changes in the app.</li>
</ul>
<h2>Contact</h2><p>${contact()}.</p>`);
