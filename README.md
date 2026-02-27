# XPoster

X (Twitter) post automation tool — AI-generated content with one-click posting.

**Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, Clerk (auth), Supabase (database), Grok API (text + image), twitter-api-v2 (OAuth 2.0 PKCE)

---

## Production Setup Guide

Three external services need to be configured before the app can run: Clerk (auth), Supabase (database), and the X Developer App (OAuth callback URL).

Vercel is assumed below (optimal for Next.js — zero config). Any Node.js host (Railway, Render, Fly.io) works the same way; just substitute their env var UI for Vercel's.

---

### Step 1 — Clerk

#### 1a. Create a production application
1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → **Create application**
2. Name it "XPoster", enable **Email** (and optionally Google/GitHub social login)
3. Clerk creates a **Development** instance by default. For a real deployment you also need a **Production** instance:
   - In the Clerk dashboard, click your app → **Switch to production** (top banner or Settings)
   - Production keys start with `pk_live_` and `sk_live_`
   - Dev keys (`pk_test_`) work fine for testing on Vercel preview branches

#### 1b. Copy keys
From **API Keys** in the Clerk dashboard:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = pk_live_...   (or pk_test_ for dev)
CLERK_SECRET_KEY                  = sk_live_...
```

#### 1c. Configure allowed redirect URLs (Production instance only)
In **Clerk Dashboard → Production instance → Paths** (or "Domains"):
- Add your production domain: `https://yourdomain.com`
- Clerk uses this to validate where it redirects after sign-in

No extra configuration needed for `/sign-in` — Clerk's `<SignIn />` component handles itself.

---

### Step 2 — Supabase

#### 2a. Create a project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to your users
3. Set a strong database password (save it, even though you won't need it directly)
4. Wait ~2 min for provisioning

#### 2b. Run the SQL schema
In **Supabase Dashboard → SQL Editor → New query**, paste and run:

```sql
-- Encrypted credentials (one row per user)
CREATE TABLE user_credentials (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL UNIQUE,
  grok_api_key   TEXT,
  x_access_token TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON user_credentials (user_id);

-- Settings (one row per user)
CREATE TABLE user_settings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL UNIQUE,
  x_tier         TEXT NOT NULL DEFAULT 'free' CHECK (x_tier IN ('free', 'premium')),
  openai_api_key TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON user_settings (user_id);

-- Post history (one row per post)
CREATE TABLE posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  prompt         TEXT NOT NULL,
  image_prompt   TEXT,
  edited_text    TEXT NOT NULL,
  image_url      TEXT,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'scheduled')),
  tweet_url      TEXT,
  posted_at      TIMESTAMPTZ,
  scheduled_for  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON posts (user_id);
CREATE INDEX ON posts (user_id, created_at DESC);
```

#### 2c. Copy keys
From **Supabase Dashboard → Project Settings → API**:
```
NEXT_PUBLIC_SUPABASE_URL  = https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJ...   (the "service_role" key, NOT "anon")
```

> `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix — it stays server-side only. Never expose it to the browser.

---

### Step 3 — Encryption Key

Generate once and save it permanently (losing it makes all stored API keys unreadable):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
ENCRYPTION_KEY = <64-char hex string from above>
```

---

### Step 4 — X Developer App callback URL

Your X OAuth callback URL changes from `localhost` to your production domain.

1. Go to [developer.twitter.com](https://developer.twitter.com) → your app → **Edit**
2. Under **Callback URI / Redirect URL**, add:
   ```
   https://yourdomain.com/auth/callback
   ```
3. Keep `http://localhost:3004/auth/callback` if you still want local dev to work

---

### Step 5 — Set all env vars on Vercel

In **Vercel Dashboard → Project → Settings → Environment Variables**, add every variable below. Set **Environment** to "Production" (and "Preview" for test branches if desired).

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `CLERK_SECRET_KEY` | `sk_live_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/generate` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/generate` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `ENCRYPTION_KEY` | 64-char hex |
| `NEXT_PUBLIC_X_CLIENT_ID` | existing value |
| `X_CLIENT_SECRET` | existing value |

> `SESSION_SECRET` can be removed — iron-session is no longer used.

---

### Step 6 — Deploy

```bash
git push origin master   # Vercel auto-deploys on push
```

After deploy: visit `https://yourdomain.com/generate` → should redirect to `/sign-in`.

---

### Step 7 — First-run checklist

After logging in with your Clerk account:
- [ ] Settings → re-enter Grok API key
- [ ] Settings → reconnect X account (fresh OAuth, uses production callback URL)
- [ ] Settings → re-enter OpenAI key if used
- [ ] History is empty — that's expected, old posts are already on X

---

## Local Development

Your `.env.local` needs all the same variables (dev/test keys are fine):

```bash
# Clerk (dev keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/generate
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/generate

# Supabase (same project as prod is fine for local testing)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Encryption (must match production — rotating this breaks stored rows)
ENCRYPTION_KEY=<64-char hex>

# X Developer App
NEXT_PUBLIC_X_CLIENT_ID=...
X_CLIENT_SECRET=...
```

Generate ENCRYPTION_KEY:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the dev server:
```bash
npm run dev
```

Open [http://localhost:3004](http://localhost:3004).
