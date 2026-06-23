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

`telegram_chat_id` is UNIQUE in the database — it cannot be claimed by a second account once linked. A user can only be linked from their own session.

---

## Local Development

Telegram bots require a public HTTPS URL for webhooks. In development, use the included polling script instead:

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

### 1. Register the webhook

After deploying, run this once (browser or `curl`):

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Replace `<TOKEN>`, `your-app.vercel.app`, and `<TELEGRAM_WEBHOOK_SECRET>` with real values. The `secret_token` parameter enables webhook request verification — Telegram will include it as `X-Telegram-Bot-Api-Secret-Token` on every update, and the app verifies it using `crypto.timingSafeEqual`.

### 2. Verify the webhook is active

```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### 3. Set the command list (optional, shows in Telegram's `/` menu)

Send `/setcommands` to [@BotFather](https://t.me/BotFather), then paste:
```
start - Get your Chat ID for account linking
trip - List your upcoming trips
next - Show your next activity
status - Show today's remaining activities
```

---

## Security

- **Webhook secret:** `TELEGRAM_WEBHOOK_SECRET` is compared using `crypto.timingSafeEqual` to prevent timing attacks. Set `TELEGRAM_WEBHOOK_SECRET` in your environment and pass the same value as `secret_token` when registering the webhook. Without this, forged webhook calls are not rejected.
- **Service role client:** The webhook handler uses `createServiceClient()` (bypasses RLS) because it runs outside any user session. This is intentional and safe — the handler only reads profiles by `telegram_chat_id`, never writes arbitrary data.
- **Middleware bypass:** `/api/telegram/webhook` and `/api/cron/*` are excluded from the session middleware (`isServiceRoute`) so they receive unauthenticated requests as expected.

---

## Implementation Details

**File:** `src/app/api/telegram/webhook/route.ts`

- Uses **grammy** v1 for bot logic
- Uses `createServiceClient()` (service role) to bypass RLS
- Bot profile lookup: `profiles.telegram_chat_id = ctx.chat.id.toString()`
- Webhook secret verified with `crypto.timingSafeEqual` before grammy processes the update

**File:** `src/app/api/telegram/link/route.ts`

- Uses `createClient()` (session-based) — user is authenticated when they paste the Chat ID
- Validates Chat ID is numeric before saving
- `PATCH profiles SET telegram_chat_id = $1 WHERE id = auth.uid()`

---

## Creating the Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow the prompts — choose a name and username (e.g. `TrailGuideAI_bot`)
4. Copy the bot token → add to `.env.local` as `TELEGRAM_BOT_TOKEN`
5. Also add `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=TrailGuideAI_bot` for the in-app link
