# Subarashii — the "Save to Subarashii" iPhone Shortcut

This lets Ella save a recipe from **anywhere on her iPhone** — a blog, Instagram,
TikTok, a screenshot, or highlighted text — straight into the recipe box, using the
normal iOS **Share** button.

You only build this once. It uses Apple's built-in **Shortcuts** app (free, no
coding). On-device text recognition (OCR) reads recipes out of screenshots without
sending anything to a paid service.

> **Prerequisite:** the app must be deployed and reachable at a URL (see
> `SETUP.md` → *Deploy to the web*). You also need your `INGEST_TOKEN` (the secret
> string from `.env.local`).

---

## What it does

When Ella taps **Share → Save to Subarashii** on a link, image, or text, the
shortcut sends it to the app's `/api/ingest` endpoint. The app parses it and adds
it to the box. If it's a screenshot, the shortcut first runs OCR on-device and
sends the extracted text.

---

## Build it (step by step)

Open the **Shortcuts** app → **+** (new shortcut) → name it **Save to Subarashii**.

### 1. Let it receive shares

- Tap the shortcut's settings (ⓘ or the name at top) → **Details**.
- Turn on **Show in Share Sheet**.
- For **Accepted types**, turn ON: **URLs**, **Images**, **Text**. Turn the rest off.

### 2. Add a variable for the shared item

- Add action **Get variable** → set to **Shortcut Input**. (This is whatever was
  shared.)

### 3. Branch: is it an image?

- Add action **If** → *Shortcut Input* → **has any value** *and* is an image.
  (Simplest reliable approach: add an **If** with condition
  *Shortcut Input* → **is** → **Image**.)

**If it IS an image:**
- Add **Extract Text from Image** → input: *Shortcut Input*.
  (This is the on-device OCR — nothing leaves the phone here.)
- Add **Text** action, and set its value to the **Extracted Text** variable.
- Add **Set variable** → name it `payloadText` → to that Text.

**Otherwise (link or text):**
- We'll send the URL/text directly (handled in the request below).

End the **If**.

### 4. Send it to the app

Add a **Get Contents of URL** action and configure:

- **URL:** `https://YOUR-APP-URL/api/ingest`
  (replace with your real Vercel URL, e.g. `https://subarashii.vercel.app/api/ingest`)
- **Method:** `POST`
- **Headers** (tap *Add new header* for each):
  - `Authorization` : `Bearer YOUR_INGEST_TOKEN`
    (paste the exact `INGEST_TOKEN` value; keep the word `Bearer ` and a space
    before it)
  - `Content-Type` : `application/json`
- **Request Body:** choose **JSON**, and add fields:
  - For a **link/URL** share: add a **Text** field named `url` with value
    *Shortcut Input*.
  - For an **image/OCR** share: add a **Text** field named `text` with value the
    `payloadText` variable.

  > Simplest robust setup: send **both** keys and leave the unused one empty — the
  > app reads whichever is present (`url` first, else `text`). If you prefer, you
  > can put the request inside the two If-branches so each branch sends only the
  > relevant field.

### 5. Confirm it worked

- Add a **Show Notification** action:
  `Saved to Subarashii ✓`
  (Optional: use the `Contents of URL` result — the app replies with the recipe
  title.)

Tap **Done**.

---

## Try it

1. Open Safari on a recipe page → **Share** → scroll to **Save to Subarashii**.
2. You should see the "Saved" notification, and the recipe appears in the box (open
   the app). Recipes the parser wasn't sure about get a **"Needs review"** badge so
   nothing is ever lost — you can fix them up in the app.
3. Try a **screenshot** of a recipe too: open it in Photos → **Share** → **Save to
   Subarashii**.

---

## Notes & troubleshooting

- **"Unauthorized" / nothing saves:** the `Authorization` header is wrong. It must
  be exactly `Bearer ` + your `INGEST_TOKEN`, and must match the value deployed to
  Vercel.
- **Instagram / TikTok links** save the link even if the parser can't read the
  recipe automatically — they'll show up as "Needs review" for you to fill in. This
  is expected; those sites block automatic reading.
- **Hebrew recipes** are fine — the app detects Hebrew and displays those lines
  right-to-left automatically.
- **Privacy:** OCR runs on the phone. The only thing sent to the app is the link or
  the extracted text, over HTTPS, authenticated by your secret token.
- You can add the shortcut to the **Home Screen** or **Back Tap** (Settings →
  Accessibility → Touch → Back Tap) for even faster capture.
