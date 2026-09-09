# Person Hub Secure

Build a responsive web app called **“Person Registry”** using **React + TypeScript + Tailwind** with **Supabase (Postgres + Storage)** as the backend (no Google Sheets/Drive). Add a **PIN lock screen** at startup with PIN **1388**.

### 0) PIN Login (required)

* On first load, show a full-screen **PIN login** page.
* Input: **4-digit PIN**.
* Valid PIN is **1388** (hardcoded).
* On success: set `sessionStorage.isUnlocked = "true"` and route to Landing page.
* On failure: show “Wrong PIN”.
* Add a **Logout** button in the app header that clears `sessionStorage` and returns to PIN screen.
* All routes/pages must be protected: if not unlocked, redirect to PIN screen.

> Note: This PIN is client-side security only (good for personal/internal use). Still apply Supabase RLS below.

---

## 1) Supabase Setup (must be created by the app)

Create:

### Table: `persons`

* `id` uuid primary key default gen_random_uuid()
* `id_no` text unique not null
* `name` text not null
* `dob` date null
* `sex` text null (Male/Female)
* `contact` text null
* `building` text null
* `atoll` text null (R., B., K., L.)
* `island` text null
* `address_full` text null
* `photo_path` text null
* `created_at` timestamptz default now()

### Storage bucket: `person-photos`

* Store images as: `persons/{id_no}_{timestamp}.jpg`

---

## 2) Security / RLS (required)

Use **Supabase Auth** with a simple email/password **admin user** OR use a single “internal user” (recommended):

### Option A (recommended): Supabase Auth + one admin account

* Add a simple **Admin Login page** (email+password) after PIN screen OR create the session silently if you already have credentials.
* RLS policies:

  * Only authenticated users can `select/insert/update/delete` in `persons`
  * Only authenticated users can read/write `person-photos` bucket

If Lovable cannot implement auth screens, then:

### Option B (fallback): Keep DB public but still protect app UI by PIN

* RLS allows public read/insert (not ideal). Mention this limitation.

**Prefer Option A.**

---

## 3) Landing Page (Search Person)

UI:

* Card “🔎 Search”
* Filters (2 columns):

  * ID, Name
  * Building, Atoll
  * Island, Phone
* Buttons: **Search**, **Reset**, **➕ Go to Completed Page**
* Results table hidden by default; show only after Search.
* Results table columns: **ID**, **Name**, **Building/Atoll/Island**, **Phone**
* Performance:

  * On app load, fetch all persons (up to 5,000) into memory
  * Filter instantly client-side for speed
* Selection:

  * **Double-click** row to select
  * Immediately show “Selected Person Info” card:

    * Photo preview (load from Supabase Storage using public or signed URL)
    * Name, ID, DOB, Sex, Address, Contact, Age Years
* Age = **today - DOB** (years)

---

## 4) Completed Page (Add Person)

Workflow:

* Paste text into textarea, click **Create Card**, auto-parse fields.
* Paste photo into a photo box (clipboard paste).
* Editable fields show parsed info:

  * ID No, Name, DOB, Sex, Address, Contact
* Save button: **Save to Database**
* Save logic:

  * Block duplicates by `id_no` (check first; also DB unique constraint)
  * Insert record into `persons`
  * Upload photo to Supabase Storage (`person-photos`)
  * Update `photo_path` on the person record
  * After save: show success, clear form, clear photo preview, optionally navigate to Landing.

### Parsing rules (must implement)

From pasted text:

* `id_no`: `[A-Z]\d{5,8}`
* `sex`: “Male” or “Female”
* `dob` formats:

  * `13 Jun 1993`
  * `1993-06-13`
  * `13/06/1993` or `13-06-1993`
* `contact`: last 7–10 digit number
* `name`: first line minus age words (years/months) and minus id_no
* `address`: choose best line containing comma or atoll tokens (R./B./K./L.)
* Ignore junk lines like: **Washed Out**, blurred, low quality, cropped, not clear, etc.
* Normalize address as: `Building , R. Island`
* Split:

  * building = before comma
  * atoll = R./B./K./L.
  * island = remainder
* Store `address_full`

---

## 5) Layout & Styling

* Clean modern cards like your screenshots
* Rounded corners, shadows, light gray background
* Dark blue primary buttons
* Mobile responsive: 1 column on small screens, 2 columns on larger screens
* Top header includes:

  * App name
  * “Logout” (clears PIN session)

---

## 6) Deliverables

* Full working project code
* Setup instructions:

  * Create Supabase project
  * Run SQL for table
  * Create bucket
  * Set RLS + policies
  * Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
* Deployment instructions (Vercel/Netlify)

---

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://personaldb.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/51faed31-578a-4aac-9d41-45ac487795f2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
