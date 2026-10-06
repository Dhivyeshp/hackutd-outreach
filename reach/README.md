# SPARK

**S**ponsor & **P**rofessor **A**utomated **R**each **K**it

HackUTD organizers send personalized outreach emails to their assigned contacts from their **own** @acmutd.co Gmail, in one or two clicks.

Next.js (App Router) · TypeScript · Tailwind · Prisma + Supabase Postgres · Auth.js (Google) · Gmail API · Vercel

## How it works

- **Admins** import a contacts CSV, invite organizers, auto-assign contacts, and edit the email template.
- **Organizers** sign in, click **Connect Gmail** once, then **Start sending**. That is it.
- A cron hits `/api/cron/send` every 5 minutes. Each organizer inside their 8am-6pm window sends a small batch (about 165/hour for a 1,000/day cap, 12-25s random gaps, so about 14 per run).
- A cron hits `/api/cron/track` every 30 minutes to detect replies, bounces and opt-outs.
- No open or click tracking. Every email gets a footer with a "reply STOP" line and the mailing address set in the template.

## Local setup

```bash
cd reach
npm install --legacy-peer-deps
cp .env.example .env       # fill in values (see below)
npx prisma migrate deploy  # or: npx prisma migrate dev
npm run seed               # optional: 2 fake organizers + 200 fake contacts
npm run dev                # http://localhost:3000
npm test                   # unit tests
```

Generate secrets:

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY (must decode to exactly 32 bytes)
openssl rand -hex 24      # CRON_SECRET
```

### Environment variables

| Name | Purpose |
|------|---------|
| `DATABASE_URL` | Supabase **pooled** connection (port 6543), add `?pgbouncer=true&connection_limit=5` |
| `DIRECT_URL` | Supabase **direct** connection (port 5432), used by migrations |
| `NEXTAUTH_URL` | `http://localhost:3000` locally, your Vercel URL in prod |
| `NEXTAUTH_SECRET` | Session signing secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth web client |
| `ALLOWED_DOMAIN` | Defaults to `acmutd.co` |
| `ADMIN_EMAIL` | The first sign-in with this email becomes admin |
| `ENCRYPTION_KEY` | AES-256-GCM key for refresh tokens at rest |
| `CRON_SECRET` | Bearer token the cron routes require |

## Google Cloud setup

1. In the Google Cloud console, create a project under the **acmutd.co** organization.
2. **APIs & Services > Library**: enable **Gmail API**.
3. **OAuth consent screen**: user type **Internal** (no Google verification needed). Add scopes `.../auth/gmail.send` and `.../auth/gmail.readonly`.
4. **Credentials > Create credentials > OAuth client ID > Web application**. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/gmail`
   - `https://YOUR-APP.vercel.app/api/auth/callback/google`
   - `https://YOUR-APP.vercel.app/api/auth/callback/gmail`
5. Copy the client ID and secret into `.env`.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel link
# add every variable from .env.example (use the Vercel URL for NEXTAUTH_URL):
vercel env add DATABASE_URL production      # repeat for each variable
vercel --prod
```

`postinstall` runs `prisma generate`. Run `npx prisma migrate deploy` once against Supabase (with `DIRECT_URL` set).

### Crons

Vercel **Hobby** only allows daily crons, so use a free external scheduler such as [cron-job.org](https://cron-job.org). Create two jobs with the header `Authorization: Bearer <CRON_SECRET>`:

| URL | Schedule |
|-----|----------|
| `https://YOUR-APP.vercel.app/api/cron/send` | every 5 minutes |
| `https://YOUR-APP.vercel.app/api/cron/track` | every 30 minutes |

On **Vercel Pro** you can instead add `crons` to `vercel.json` (Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set):

```json
{ "crons": [
  { "path": "/api/cron/send",  "schedule": "*/5 * * * *" },
  { "path": "/api/cron/track", "schedule": "*/30 * * * *" }
] }
```

The send route can run up to ~4 minutes per call (`maxDuration = 300`), which needs Vercel's default Fluid compute.

## Day-to-day

**Add organizers:** Admin > Organizers > invite their @acmutd.co email. They can then sign in. Only invited accounts (and `ADMIN_EMAIL`) get in.

**Import contacts:** Admin > Contacts > choose the CSV, match columns, import. Duplicates (by lowercased email) are skipped and bad syntax is rejected. If you include a NeverBounce/ZeroBounce result column, map it to **Verification**. Only `valid` contacts are sent to unless "Also send to risky/unknown" is enabled on the Template tab. `invalid` contacts are never sent.

**Assign:** Contacts > Auto-assign splits unassigned valid contacts round-robin (max per organizer set on the Template tab, default 1,300).

**Template:** placeholders `{{name}} {{first_name}} {{last_name}} {{title}} {{department}} {{uni}} {{sender_name}}`. Names lose Dr./Prof./suffixes, handle "Last, First", and fall back to "Professor". The linter warns about extra links, shorteners, ALL CAPS subjects and spammy words.

## Limits and auto-pauses

| Rule | Value |
|------|-------|
| Daily cap per organizer | 1,000 default, hard max 1,500, rolling 24h window |
| Ramp (admin toggle) | First 24h after first send: 300, then full cap |
| Window | 8am-6pm in the organizer's timezone |
| Pace | The daily cap is spread over about 6 hours of the 10-hour window (cap/6 per hour, 165/hr at 1,000), 12-25s random gaps, never above 30/min. Each 5-minute run fits about 14 sends per organizer |
| Recipients | One per message, never BCC or CC |

What each auto-pause means (all show on the admin dashboard as alerts):

- **User bounce rate**: more than 3% of that organizer's last 100 sends bounced (needs at least 50 sends). Admin Unpause restarts the count from that moment. That organizer is paused. Clean the list, then Unpause on the Organizers tab.
- **Global bounce rate**: more than 3% of all sends in 7 days bounced (needs 100+ sends). **Everyone** is paused. "Resume everyone" on the dashboard restarts the count from that moment.
- **Gmail suspicious activity / sending limit error**: Google flagged an account. **Everyone** is paused. Do not resume until you know why.
- **Rate limit (429)**: retried with backoff, then that organizer is paused for 1 hour automatically.
- **Daily limit**: that organizer is paused until their rolling 24h window clears.
- **Quota guard**: estimated project quota reaches 40M units in a day (Google's cap is 80M). Everyone is paused until an admin resumes.
- **gmail auth expired**: the refresh token was revoked. The organizer clicks Connect Gmail again, which unpauses them.
- **manual**: the organizer pressed Pause (they can resume themselves). An admin pause can only be lifted by an admin, and a safety pause (bounce rate, Gmail limits) can never be cleared by the organizer.
- **disabled**: an admin offboarded the user. Their stored Gmail token is deleted and they cannot sign in.

Contacts stuck mid-send (a crash between Gmail accepting a message and the database update) are never retried automatically, because they may have been delivered. After 30 minutes they are flagged `ERROR` for a human to check the Sent folder.

## Reply, bounce and opt-out tracking

The tracker lists the recent inbox once per organizer and matches messages to sent threads by thread id, fetching full messages only for matches. A reply marks the contact `replied`. A reply containing "unsubscribe", "remove", "stop" or "not interested" (outside quoted text) marks `opted_out` and the contact is never emailed again. Out-of-office auto-replies are ignored. Bounces from mailer-daemon/postmaster mark the failed recipient `bounced`.

## Tests

`npm test` runs unit tests for the name parser, template rendering, linter, CSV import/dedupe, assignment, rolling cap, pacing scheduler, bounce parser, reply/opt-out detection, MIME building, token encryption and safety rules.
