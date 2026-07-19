# Subarashii — Setup

This is the one-time setup to get Subarashii running. It takes about 15 minutes.
Everything here uses **free tiers only**. No credit card is required for Supabase's
free plan or Vercel's Hobby plan.

You'll do three things:

1. Create a free Supabase project (the database + login + file storage).
2. Put its keys into a local `.env.local` file.
3. Run one SQL migration to create the tables.

Then you can run the app locally, and later deploy it to the web.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com> and sign up (free — you can use GitHub or email).
2. Click **New project**.
   - **Name:** `subarashii` (anything is fine).
   - **Database password:** click *Generate a password* and save it in your
     password manager. You won't need it day-to-day, but don't lose it.
   - **Region:** pick the one closest to you (e.g. *Europe (Frankfurt)* for Israel).
3. Click **Create new project** and wait ~2 minutes for it to finish provisioning.

## 2. Get your keys

In the Supabase dashboard for your project:

1. Go to **Project Settings** (gear icon) → **API**.
2. You'll need three values:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **`anon` `public` key** → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` `secret` key** → this is `SUPABASE_SERVICE_ROLE_KEY`
     (Click *Reveal* to see it. **This one is secret** — it can read/write
     everything. Never share it or put it in the browser.)

## 3. Create `.env.local`

In the project folder, copy the template and fill it in:

```bash
cp .env.example .env.local
```

Then open `.env.local` and paste your values. It should look like:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...            (the anon public key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...                (the service_role secret key)
INGEST_TOKEN=                                          (see next step)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Generate the `INGEST_TOKEN` (a secret password the iPhone Shortcut uses to save
recipes) by running this and pasting the result after `INGEST_TOKEN=`:

```bash
openssl rand -hex 32
```

Save the file. `.env.local` is git-ignored, so it never gets committed.

## 4. Run the database migration

This creates all the tables (recipes, ingredients, steps, timers, etc.).

1. In the Supabase dashboard, open the **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open the file `supabase/migrations/0001_init.sql` in this project, copy the
   **entire** contents, and paste it into the SQL editor.
4. Click **Run**. You should see *Success. No rows returned*.

That's it — the database is ready.

## 5. Turn on email login (magic links)

By default Supabase already has email magic-links enabled. Two quick checks:

1. **Authentication** → **Providers** → make sure **Email** is enabled.
2. **Authentication** → **URL Configuration**:
   - **Site URL:** `http://localhost:3000` (change to your real site later).
   - **Redirect URLs:** add `http://localhost:3000/auth/callback`.

The first person to log in automatically becomes the household. When Ella logs in
with the same app, she joins the same household automatically — you'll both see the
same recipe box.

> On the free tier Supabase sends a limited number of emails per hour, which is
> plenty for two people. If a login email is slow, wait a minute and check spam.

---

## 6. Run it locally

Node is managed with `nvm`. In each new terminal, first make Node available:

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
```

Then:

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be asked to log in — enter your email, click
the magic link, and you're in. Try:

- **Add → Paste a link** with a recipe URL (e.g. any recipe blog).
- **Add → Type it in** to enter one by hand.

Both should show up in "The Box" on the home page.

---

## 7. Deploy to the web (optional, when you're ready)

1. Push this project to a private GitHub repo.
2. Go to <https://vercel.com>, sign up (free Hobby plan), and **Import** the repo.
3. In Vercel's project settings → **Environment Variables**, add the same five
   variables from your `.env.local` (use your real Vercel URL for
   `NEXT_PUBLIC_SITE_URL`, e.g. `https://subarashii.vercel.app`).
4. Deploy. Then go back to Supabase → **Authentication** → **URL Configuration**
   and update the **Site URL** and add `<your-vercel-url>/auth/callback` to the
   redirect URLs.

Once it's live, follow **SHORTCUT.md** to set up the iPhone "Save to Subarashii"
Share Sheet shortcut.

---

## Where each value comes from (quick reference)

| Variable | Where to find it | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | **yes** |
| `INGEST_TOKEN` | `openssl rand -hex 32` | **yes** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; Vercel URL in prod | no |
