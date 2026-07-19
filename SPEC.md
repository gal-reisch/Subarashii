# Subarashii — Build Specification & Handoff

> **App name:** **Subarashii** (素晴らしい — Japanese for "wonderful / splendid," the delighted exclamation over something amazing, including great food). Built as a personal recipe app for **Ella**.

> **This document is written for the executor (Claude Opus / Sonnet) who will build this app.**
> Read this whole file before writing any code. It is the source of truth for scope, sequence, and guardrails.
> Owner: building a private, personal recipe app as a gift/tool for **Ella**. It is NOT a mass-market product — optimize for her joy of use, not scale.

---

## 0. READ ME FIRST — Non-negotiables

1. **Keep it simple to use.** The #1 failure mode is "feels complicated → she stops using it." Every screen should be obvious without instruction. When in doubt, remove.
2. **Free only — permanently, for this build.** Use $0 services with no credit card and no usage-based billing. Paid features are **NOT to be built at all** — not even as stubbed, hidden, or disabled code. They exist only as a **read-only reference list** (§11) so the owner can plan possible future updates. Do not add feature flags, disabled buttons, or dead code paths for them.
3. **Keys never touch the client.** Any secret lives only in server environment variables. The phone/browser never sees a key.
4. **Ella is on iPhone.** Primary device is iPhone; the app is an installed PWA on her home screen. Design mobile-first, kitchen-friendly (big taps, high contrast, screen-awake).
5. **English UI, bilingual content.** All app chrome (buttons/menus) is **English, left-to-right**. But recipe *content* she saves is a **mix of Hebrew and English** — detect text direction per block and render Hebrew right-to-left inside cards.
6. **Personal, not generic.** The app is named **Subarashii** and is personalized to Ella throughout (see §2). It should feel like *hers*.
7. **Ship in usable phases.** Each phase in §13 must leave a working app she can already use. Do not build horizontally across half-features.

---

## 1. Product Overview

**What it is:** A private "digital recipe box" — a warm, playful, installable web app (PWA) where Ella saves recipes from anywhere in ~2 taps, browses them beautifully, sees calories & protein at a glance, cooks hands-free with a multi-timer "sidekick" mode, and gets inspiration from what she already has.

**Aesthetic direction:** Warm, editorial, tactile — think *physical recipe-card box* meets a premium cookbook. Big cover photos, generous whitespace, lovely typography. **Playful interactions** inspired by codapress.co.uk (draggable cards, flick-to-shelf, flip-a-card-to-see-its-back) — but the *look* is warm and homey, **not** technical/developer-y. The playfulness is in the *motion and feel*, not in a "tech" visual style.

**Core loops:**
- **Capture:** save from any app on iPhone → auto-cleaned recipe appears in her box.
- **Browse:** flip through cards, organize into "shelves" (collections), search/filter by protein, time, cuisine.
- **Cook:** full-screen hands-free Cook Mode with screen-awake + multiple labeled timers.
- **Nourish:** calories & protein front-and-center, per-serving, using the Israeli nutrition database.
- **Inspire:** "what can I make with what I have" + "more like what I love."

---

## 2. Personalization (make it feel like Ella's)

- **App name:** **Subarashii** (素晴らしい — Japanese for "wonderful / splendid," the delighted exclamation over something amazing, including great food). Confirmed by owner. Keep the warmth; the name is playful and global.
- **Ella's presence:** the app is named Subarashii, but it's *hers* — her name appears in the welcome/dedication, and it's built around how she cooks.
- **Home screen:** on first open, a small warm welcome / dedication line. Her name appears in the app.
- **Install:** PWA with a custom app icon + splash screen so it looks like a native app on her home screen.
- **Warm palette & type:** soft, inviting colors; a characterful display font for headings, highly legible body font. Avoid cold grays/blues and monospace "code" vibes.
- **"Made it" journal (see §9):** over time the app becomes a record of *her* cooking, with her notes and tweaks — that's what makes it personal, not just a clipping pile.

---

## 3. Tech Stack (chosen for cheap + simple + one codebase)

| Concern | Choice | Why |
|---|---|---|
| App + backend | **Next.js (App Router), TypeScript** | One codebase, server routes keep secrets server-side, great PWA support. |
| Styling | **Tailwind CSS** | Fast, consistent. |
| Motion/drag | **Framer Motion** (+ a light physics feel) | The playful drag/flip/flick interactions. |
| PWA | **next-pwa** or manual service worker + manifest | Installable, offline caching of saved recipes. |
| DB + Auth + Image storage | **Supabase (free tier)** | Postgres + passwordless magic-link auth + file storage + row-level security, all free at 2-user scale. |
| Hosting | **Vercel (free/Hobby tier)** | Pairs with Next.js; free at this scale. |
| Nutrition data | **Israeli "Tzameret" DB (bundled) + USDA FoodData Central (free API, fallback)** | See §7. |
| Recipe parsing | **Local JSON-LD + Readability fallback (free)** | See §6. No AI in the free path. |

**Deployment note:** Vercel gives an HTTPS URL (e.g. `https://subarashii.vercel.app`). The iOS Shortcut posts to this URL. A custom domain is optional and not required.

**Auth model:** one shared **household**. Ella and the owner each sign in via **magic link** (passwordless) and see the **same** recipe collection. No passwords to remember. Ella is the priority user; owner access must add zero complexity to her experience.

---

## 4. Data Model (Supabase / Postgres)

Design tables (adjust names as idiomatic, keep intent):

- **household** — `id`. The single shared workspace. (All data scoped to one household for now; keep the column so multi-household is possible later.)
- **user** — Supabase auth user, linked to `household_id`.
- **recipe** — `id, household_id, title, source_url, source_type (blog|instagram|tiktok|screenshot|manual), cover_image_url, servings, total_time_min, cuisine, primary_language (he|en), created_at, created_by, status (to_try|made), notes`.
- **ingredient** — `id, recipe_id, raw_text, quantity, unit, name_normalized, language, grams_resolved (nullable), fdc_source (tzameret|usda|none), calories, protein_g, carbs_g, fat_g, fiber_g`. (Per-ingredient nutrition enables scaling & partial matches.)
- **step** — `id, recipe_id, position, text, detected_timer_seconds (nullable)`.
- **collection** ("shelf") — `id, household_id, name, is_auto (bool), sort_order, cover_style`.
- **recipe_collection** — join table `recipe_id, collection_id, sort_order` (sort_order enables draggable ordering).
- **cook_log** — `id, recipe_id, cooked_at, rating (1–5), note` (the journal; multiple entries per recipe over time).
- **timer_preset** — `id, household_id, label (e.g. "Oven"), default_seconds, icon`. (For the multi-timer picker.)
- **pantry_item** — `id, household_id, name, language` (optional ingredients-on-hand list for inspiration).
- **shopping_item** — `id, household_id, name, recipe_id (nullable), checked (bool)`.

Enable **Supabase Row Level Security** so only the household's users can read/write their rows.

---

## 5. Capture System (the make-or-break feature)

Four capture paths. Build in the order listed. **All must be low-friction.**

### 5.1 iOS Share Sheet → Apple Shortcut (PRIMARY)
This is the killer path — it works from *any* app on iPhone (Safari, Instagram, TikTok, Photos, Notes).

**Deliverable:** an Apple **Shortcut** the owner installs on Ella's phone (provide clear setup instructions + the shortcut definition/steps). The Shortcut:
1. Accepts Share Sheet input of type: **URL, image(s), or text**.
2. If input is an **image** (screenshot/photo): run the built-in **"Get Text from Image"** action first — this uses Apple's **on-device OCR (Live Text), which supports Hebrew and English and is free** — so the *server receives text, not an image*. This makes Hebrew screenshots work at $0 and avoids server OCR cost.
3. Sends a **POST** (multipart or JSON) to `POST https://<app-url>/api/ingest` with:
   - header `Authorization: Bearer <INGEST_TOKEN>` (a long random secret stored in the Shortcut + server env).
   - body: `{ type, url?, text?, sharedFrom? }`.
4. Shows a quick success banner ("Saved to Subarashii ✅").

**Server `/api/ingest`:**
- Verify the bearer token (reject otherwise). **Rate-limit** this endpoint (e.g. ≤ 60 requests/hour) to prevent abuse even if the token leaks.
- Route by `type` to the parser (§6), create the recipe as `status = to_try`, kick off nutrition resolution (§7), return fast.
- On parse failure, still save a stub recipe with the raw text/url so nothing is ever lost; flag it "needs review."

### 5.2 Paste-a-link (in-app)
A prominent "＋ Add" box where she can paste a URL (good on laptop). Same parsing pipeline as ingest.

### 5.3 Screenshot / photo (in-app)
Upload an image → run OCR. Prefer the Shortcut's on-device OCR path (free). For in-app uploads without the Shortcut, use a **free** OCR option (e.g. Tesseract.js in-browser with Hebrew+English language data) so there's no server cost. Then feed extracted text to the parser.

### 5.4 Manual / voice entry
A clean "Add your own" form (title, ingredients, steps, servings, photo). Note: iPhone's built-in keyboard **dictation** already gives free voice entry — no custom voice code needed. Support pasting a block of text and letting the parser split it into ingredients/steps.

---

## 6. Parsing (FREE tiers only — no AI in default path)

Turn messy input into `{ title, servings, ingredients[], steps[], cover_image, cuisine? }`.

- **Tier 1 — Structured data (free, best):** Fetch the page, extract **`schema.org/Recipe` JSON-LD** (most recipe blogs embed it). Gives title, ingredients, steps, image, sometimes nutrition directly. Handles a large share of blog saves near-perfectly.
- **Tier 2 — Readability heuristic (free):** For pages without JSON-LD, use a Readability-style extraction + simple heuristics (lines with quantities → ingredients; numbered/imperative lines → steps).
- **Tier 3 — Raw text splitter (free):** For OCR'd screenshots / Instagram-caption text / TikTok text: heuristic splitter that separates an ingredient list from steps. Detect Hebrew vs English per line to set direction and choose the nutrition DB (§7).
- **AI cleanup (PAID — DO NOT build):** For messy reels/screenshots, an LLM would raise accuracy from ~80% to ~95%. This is a **future-reference idea only (§11)** — do not build it, stub it, or add any code path for it now.

**Never lose data:** if all tiers fail, save the raw text/url as a reviewable stub. She can fix it in the manual editor.

**Editing:** every parsed recipe is fully editable in a simple form — parsing is a head start, not a cage.

---

## 7. Nutrition System (calories & protein first, Israel-accurate)

Ella cares most about **calories and protein**, and wants numbers that reflect **what she actually buys in Israel**.

**Data sources:**
1. **Primary — Israeli "Tzameret" National Nutrition Database** (Israeli Ministry of Health, open data on data.gov.il): ~4,500 foods, 74 nutrients per 100g, **includes Hebrew food names and Israeli products**. It's a **downloadable dataset (CSV)** — **bundle it into the app's own database** at build time. This means nutrition lookups are **local, free, and make zero external calls** (great for the no-surprises requirement) and Hebrew ingredient names match directly.
2. **Fallback — USDA FoodData Central** (free API) for foreign/imported items not in Tzameret, mostly English-named ingredients.

**Pipeline (all local/free):**
1. For each ingredient `raw_text` → parse `quantity + unit + name` (handle Hebrew & English units: cup/כוס, tbsp/כף, g/גרם, etc.).
2. Normalize the name; **detect language**; match Hebrew names → Tzameret, English → Tzameret-English-or-USDA, via local fuzzy matching.
3. Convert quantity to grams (maintain a small unit/density table for common cases; if unknown, best-effort + flag as approximate).
4. Compute per-ingredient calories/protein/carbs/fat/fiber; sum for the recipe; divide by `servings` for per-serving.
5. Store results on the `ingredient` and `recipe` rows so scaling is instant.

**Display:**
- Every recipe card shows a **nutrition badge**: large **Calories** and **Protein** (her two priorities); carbs/fat/fiber secondary/collapsed.
- **Serving scaler:** change servings → nutrition recalculates live.
- **Confidence:** if some ingredients couldn't be matched, show an honest "approximate" marker rather than a falsely precise number. Let her tap to fix a match.
- **Nutrition tags & filters:** auto-tags like "High protein," "Light (<500 cal)," so she can browse by how she wants to eat.

---

## 8. Cook Mode — the hands-free "sidekick" (owner loves this — make it excellent)

Full-screen cooking companion, optimized for messy hands and glancing from across the kitchen.

**Core:**
- **Screen stays awake** via the **Screen Wake Lock API** while Cook Mode is active (re-acquire on visibility change). This is the "sidekick that doesn't sleep" behavior the owner specifically loved.
- **Big, high-contrast** step-by-step view; huge tap targets; one step prominent at a time with easy next/prev.
- **Ingredient checklist** + **step check-off**.
- Optional: keep the phone readable at arm's length (large type, dimmable but awake).

**Multi-timer (explicitly requested — several simultaneous, clearly labeled, easy hands-free):**
- Support **multiple concurrent timers**, each with a **label** so she knows which is which (e.g. "Oven", "Stove", "Oven #2", "Rice").
- **Preset chips** for one-tap starts, backed by `timer_preset` (default presets: Oven, Stove, Boil, Rest — editable). Tapping a preset starts a labeled timer; long-press or a quick sheet lets her set/adjust minutes with **big +/- buttons** (no tiny keyboards).
- **Running timers rail:** all active timers shown as large cards with their label + countdown, always visible in Cook Mode, each with a big **Stop/＋1min** button. Easy to tell apart at a glance and tap without precision.
- **Auto-suggest timers from steps:** when a step contains a duration ("simmer 10 min", "bake 25 minutes", Hebrew equivalents), show a one-tap **"Start 10:00 timer"** chip on that step, pre-labeled from context.
- **Alerts:** timers run reliably in-foreground (screen is awake). When one finishes: audible chime + on-screen flash + vibration. Also fire a **local notification** as backup (iOS 16.4+ supports notifications for installed PWAs) in case she navigated away.
- **Honesty note for executor:** background timers in a PWA when the app is fully closed are unreliable on iOS. The design sidesteps this by keeping the screen awake in Cook Mode (foreground). Do not over-engineer background execution; the wake-lock + in-foreground timers + notification backup is the intended approach.

---

## 9. Inspiration & Journal

**Inspiration (two modes she asked for) — free-first:**
1. **"What can I make right now?"** — she selects/enters ingredients on hand (from `pantry_item` or ad-hoc). **First pass is free:** rank *her own saved recipes* by how many required ingredients she already has ("You can make 4 of your recipes; 3 more need just 1–2 items"). This is more personal and costs nothing.
2. **"More like what I love"** — derive a lightweight taste profile from saved recipes (common cuisines, high-protein lean, quick meals) and surface matching saved recipes / gentle suggestions.
- **AI-generated brand-new ideas** (net-new recipes, not from her box) = **PAID**, future-reference only (§11). Do not build it or add a button for it now.

**Cooking journal (personalization):**
- Mark **"Want to try"** vs **"Made it"**.
- After cooking, optional **rating + note** ("used less sugar, added chili") stored in `cook_log` (many over time).
- A recipe's card back / detail shows her history and tweaks → the app becomes *her* cookbook.

---

## 10. UI / UX Spec (screen by screen)

Mobile-first. Warm, tactile, playful-in-motion. Keep every screen uncluttered.

1. **Home / "The Box":** her recipe cards with big cover photos. **Draggable cards** (Framer Motion) with a satisfying flick/spring; **tap a card to open**, or **flip** to see nutrition + notes on the back. Prominent **＋ Add** and **Search**. Auto-shelves surfaced (Recently added, Favorites, High-protein, Quick).
2. **Shelves (Collections):** her "cookbooks" — drag cards between shelves; reorder by drag. Auto-collections + custom ones. This is where the codapress-style playful organization lives.
3. **Recipe detail:** hero image, title, nutrition badge (Cal + Protein big), servings scaler, ingredients (with per-line direction for Hebrew/English), steps, "Start Cooking" button (→ Cook Mode), journal/notes, source link. Edit button everywhere.
4. **Cook Mode:** §8. Full-screen, screen-awake, step-by-step, multi-timer rail, ingredient checklist.
5. **Add flow:** paste-link / upload photo / type. Shows parsing progress, then an editable draft to confirm. Never dead-ends on failure.
6. **Inspiration:** the two modes (§9), pantry input, results as tappable cards.
7. **Shopping list:** add from any recipe's ingredients; combined, check-off-in-store view.
8. **Settings:** household members (magic-link invite for owner), timer presets, nutrition preferences, and the **"Future upgrades"** surface (§11) — clearly labeled, disabled, informational.

**Interaction feel:** springy drag, card flip, haptic feedback on iPhone, smooth transitions. Fast and app-like (installed PWA, no browser chrome). **Offline:** saved recipes + Cook Mode work with no signal (service worker caches them).

**Accessibility/kitchen:** high-contrast option, large default type, big tap targets, wake-lock in Cook Mode.

---

## 11. Free-vs-Paid Tiering (READ-ONLY reference — do not build)

Build the app **100% on the free tier.** The paid column below is a **reference list only** — a wishlist for the owner to consider in future updates. **Do not build, stub, flag, or add UI for any of it now.** It may optionally appear in Settings as a purely informational, non-interactive "Someday" note, but nothing is wired to anything. Estimates are for the owner's future planning:

| Feature | Free version (build now) | Paid upgrade (deferred) | Est. cost |
|---|---|---|---|
| Recipe parsing | JSON-LD + heuristics + OCR text (~80% on messy reels) | LLM cleanup for reels/screenshots (~95%) | ~$0.001–0.01 per recipe; realistically **<$1–3/mo** at her volume |
| New-idea inspiration | Ranks *her own* recipes by on-hand ingredients | LLM generates brand-new recipe ideas | **<$1–5/mo** with a hard daily cap |
| OCR | On-device (Shortcut) + Tesseract.js in-browser | Cloud OCR (higher accuracy on hard images) | Free tiers exist; paid ~**$1–5/mo** |
| Nutrition | Tzameret (bundled) + USDA (free) | Commercial DB (e.g. barcode/branded products) | ~**$0–free tiers**; commercial APIs vary |
| Hosting/DB | Vercel + Supabase free tiers (ample for 2 users) | Paid tiers only if she outgrows limits (unlikely) | $0 now; ~$25/mo *only* if scaled |

**Note:** these paid options are intentionally left unbuilt. If the owner ever revisits them, that's a future, separate decision — this build ships with none of them present in code.

---

## 12. Cost & Security Guardrails (apply throughout)

- **No usage-billed API in the default build.** Free/static data only.
- **Secrets only in server env** (`INGEST_TOKEN`, Supabase service key, USDA key). Never shipped to client.
- **Rate-limit** public endpoints (`/api/ingest`), even token-protected ones.
- **Auth-gate** all data; Supabase RLS scoped to household.
- **Bundle Tzameret locally** to avoid any external nutrition calls.
- **Fail safe:** never lose a saved item on parse failure; store a reviewable stub.

---

## 13. Build Phases (each leaves a usable app; ship in order)

**Phase 1 — Core capture loop (MVP).**
Scaffold Next.js PWA + Tailwind; Supabase auth (magic link) + schema + RLS; `/api/ingest` with token + rate limit; the **iOS Shortcut** (+ setup instructions); paste-link add; JSON-LD/Readability parser; manual add form; image storage; basic list of saved recipes; installable to home screen.
*Acceptance:* Ella can save a blog link (from Share Sheet **and** paste) and a typed recipe, and see them in her box. Nothing is ever lost on failure.

**Phase 2 — Browse & Cook.**
The card/shelf UI with draggable cards + flip; collections (manual + auto); search + filters (protein, time, cuisine); **Cook Mode** with screen wake-lock, step-by-step, ingredient checklist, and the **multi-labeled-timer** system (§8); offline caching of saved recipes.
*Acceptance:* She can organize recipes by dragging, and cook a recipe hands-free with 2–3 labeled timers running at once, screen staying awake.

**Phase 3 — Nutrition.**
Bundle **Tzameret**; ingredient parsing + bilingual matching + grams conversion; USDA fallback; per-recipe & per-serving calories/protein badges; serving scaler; nutrition auto-tags & filters; "approximate" honesty markers + manual match fix.
*Acceptance:* Every recipe shows believable Calories & Protein per serving using Israeli data; changing servings updates them live.

**Phase 3b — Grocery cost estimate (Israeli market) [owner-requested].**
Show an estimated shopping cost per recipe: read the parsed ingredients, match them
to Israeli retail prices, and total "roughly what it costs to buy everything." Reuse
the Phase-3 ingredient parsing/quantity work. **Free data source:** Israel's price-
transparency open data (חוק שקיפות מחירים) — the major chains (Shufersal, Rami Levy,
Victory, etc.) publish full price files the state aggregates; ingest a snapshot,
fuzzy-match Hebrew ingredient names, and cache locally so there's no per-request cost.
Display as an honest range/estimate with an "approximate" marker (prices vary by chain
and quantity). No paid API.
*Acceptance:* Each recipe shows an approximate ₪ cost-to-buy based on real Israeli
prices, clearly labeled as an estimate; unmatched items are flagged rather than guessed.

**Phase 4 — Inspiration & Journal.**
"What can I make right now?" over her own recipes (free); "more like what I love"; pantry input; "Made it"/"Want to try" + ratings/notes journal.
*Acceptance:* She can pick on-hand ingredients and get "you can make X of your recipes," and log/rate what she cooks.

**Phase 5 — Extras & polish.**
Shopping list (combine from recipes, check off); personalization polish (naming, dedication, palette, icon/splash); micro-interactions & haptics; the §11 "Future upgrades" settings surface; owner magic-link access.
*Acceptance:* Feels finished, warm, and personal; owner can also log in without complicating Ella's experience.

**Phase 6 — Hard sources (still free).**
Improve Instagram/TikTok/screenshot capture using the on-device OCR + heuristic splitter; per-line Hebrew/English direction handling. (No paid AI path — reference only, §11.)
*Acceptance:* Saving a Hebrew screenshot or an Instagram caption produces an editable recipe at ~80% quality with zero API cost.

---

## 14. Open items / deferred decisions (surface to owner, don't block)

- **App icon / splash art** — owner to confirm the visual. App name is **confirmed: Subarashii**.
- **Exact Tzameret dataset field mapping** — executor to inspect the downloaded CSVs (data.gov.il "מאגר התזונה הלאומי הישראלי") and map columns during Phase 3; keep USDA fallback.
- **Paid features are permanently out of scope for this build** — §11 is a read-only future-reference list; the owner has decided *not* to build any of it. Do not implement, stub, or flag it.
- **Meal planner (drag recipes onto a week + weekly protein totals)** — nice-to-have, deferred beyond Phase 5 unless requested.

---

*End of spec. Build in phase order. Keep it simple, keep it warm, keep it free. When a choice is ambiguous, choose the option that makes Ella's daily use easier.*
