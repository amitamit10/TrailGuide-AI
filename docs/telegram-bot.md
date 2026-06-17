# Telegram Bot

TrailGuide AI includes an optional Telegram bot (`@TrailGuideAI_bot`) that lets users check their trip status from Telegram without opening the app.

---

## Commands

| Command | What it does |
|---|---|
| `/start` | Shows the user's Telegram Chat ID (used for account linking) |
| `/trip` | Lists the user's upcoming trips |
| `/next` | Shows the next scheduled activity for their active trip |
| `/status` | Shows today's remaining activities |

---

## Account Linking

The bot needs to know which Supabase user corresponds to a Telegram chat. The linking flow:

1. User opens the bot and sends `/start`
2. Bot replies with their numeric **Chat ID** (e.g. `123456789`)
3. User opens the app → Settings → "Connect Telegram"
4. User pastes their Chat ID and clicks Save
5. App calls `POST /api/telegram/link` → saves `telegram_chat_id` to their profile
6. Bot commands now work

This is a paste-based flow — no deep-link or token exchange. It's simpler and works even if the Telegram app doesn't pass parameters correctly.

---

## Local Development

Telegram bots require a public HTTPS URL for webhooks. In development:

1. Start the Next.js dev server:
   ```bash
   npm run dev
   ```

2. In a separate terminal, run the local polling script:
   ```bash
   node scripts/telegram-poll.mjs
   ```

This script long-polls the Telegram Bot API and forwards each update to `http://localhost:3000/api/telegram/webhook`. No `ngrok` or tunnel needed.

> The polling script requires `TELEGRAM_BOT_TOKEN` in `.env.local`.

---

## Production Setup

In production (Vercel), register the webhook once after deploying:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook
```

Replace `<TOKEN>` with your bot token. Open this URL in a browser or `curl` it — Telegram will confirm webhook registration.

To verify the webhook is active:
```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

---

## Implementation Details

**File:** `src/app/api/telegram/webhook/route.ts`

- Uses **grammy** v1 for bot logic
- Uses `createServiceClient()` (service role) to bypass RLS when reading profiles — the webhook runs outside any user session, so `createClient()` would always see an anon user and RLS would block all reads
- Bot profile lookup: `profiles.telegram_chat_id = ctx.chat.id.toString()`

**File:** `src/app/api/telegram/link/route.ts`

- Uses `createClient()` (session-based) — the user is authenticated when they paste the Chat ID
- Validates Chat ID is numeric before saving
- `PATCH profiles SET telegram_chat_id = $1 WHERE id = auth.uid()`

---

## Creating the Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow the prompts — choose a name and username (e.g. `TrailGuideAI_bot`)
4. Copy the bot token and add it to `.env.local` as `TELEGRAM_BOT_TOKEN`

To set the command list (shows in Telegram's `/` menu):
```
/setcommands
```
Then paste:
```
start - Get your Chat ID for account linking
trip - List your upcoming trips
next - Show your next activity
status - Show today's remaining activities
```
