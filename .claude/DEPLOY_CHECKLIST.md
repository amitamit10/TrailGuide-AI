# Things To Do Before Deploy

## 1. Supabase — Run Migrations
Run both migration files in the Supabase SQL editor (Dashboard → SQL Editor):
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_phase4_columns.sql`

## 2. Environment Variables
Add all of these to your hosting platform (Vercel → Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
TAVILY_API_KEY=
UNSPLASH_ACCESS_KEY=
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=TrailGuideAI_bot
```

## 3. Supabase Auth — Add Production URL
In Supabase Dashboard → Authentication → URL Configuration:
- Set **Site URL** to your production domain (e.g. `https://yourapp.vercel.app`)
- Add to **Redirect URLs**: `https://yourapp.vercel.app/**`

## 4. Register the Telegram Webhook
After deploying, run this once in a browser or curl to point Telegram at your server:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://yourapp.vercel.app/api/telegram/webhook
```

Replace `<TELEGRAM_BOT_TOKEN>` and `yourapp.vercel.app` with real values.
After this the `scripts/telegram-poll.mjs` script is no longer needed.

## 5. Google OAuth (if using Sign in with Google)
In Google Cloud Console → OAuth 2.0 → Authorized redirect URIs, add:
```
https://yourapp.vercel.app/auth/callback
```

## 6. Test Before Announcing
- [ ] Sign up / log in works
- [ ] Create a trip end-to-end (wizard → review → save)
- [ ] Timeline shows activities with photos
- [ ] Discover tab loads AI recommendations
- [ ] Companion tab shows weather + nudges
- [ ] Telegram bot responds to /start, /trip, /next, /status
- [ ] Activity location links open Google Maps
