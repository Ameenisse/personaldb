

# Person Registry — Implementation Plan

## Overview
A responsive internal-use web app for managing person records with photo storage, backed by Supabase. Protected by a PIN lock screen and Supabase Auth for database-level security.

---

## Phase 1: Core Setup & Authentication

### PIN Lock Screen
- Full-screen 4-digit PIN input page using the OTP input component
- Hardcoded PIN validation (1388)
- Session managed via `sessionStorage`
- All routes protected — redirect to PIN screen if not unlocked

### Supabase Auth (Admin Login)
- After PIN unlock, silently check for an existing Supabase auth session
- If no session, show a simple email/password login form
- Single admin account — user creates one account manually in Supabase dashboard
- Supabase client initialized with environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

### App Header
- App name "Person Registry"
- Logout button that clears both `sessionStorage` (PIN) and Supabase auth session

---

## Phase 2: Database & Storage

### `persons` Table
- Fields: `id` (uuid), `id_no` (unique text), `name`, `dob`, `sex`, `contact`, `building`, `atoll`, `island`, `address_full`, `photo_path`, `created_at`
- Unique constraint on `id_no` to prevent duplicates

### `person-photos` Storage Bucket
- Photos stored as `persons/{id_no}_{timestamp}.jpg`
- Public bucket for easy photo display (or signed URLs if private)

### RLS Policies
- `persons` table: only authenticated users can select, insert, update, delete
- `person-photos` bucket: only authenticated users can read/write

---

## Phase 3: Landing Page (Search)

### Search Card
- Filter form with 2-column layout: ID, Name, Building, Atoll (dropdown: R., B., K., L.), Island, Phone
- Search and Reset buttons
- Button to navigate to the "Add Person" (Completed) page

### Results
- Hidden until Search is clicked
- Table showing: ID, Name, Building/Atoll/Island, Phone
- All persons (up to 5,000) fetched into memory on app load for instant client-side filtering

### Person Detail
- Double-click a row to select a person
- "Selected Person Info" card appears below/beside with:
  - Photo preview (loaded from Supabase Storage)
  - Name, ID No, DOB, Sex, Full Address, Contact
  - Calculated age in years (today − DOB)

---

## Phase 4: Completed Page (Add Person)

### Text Parsing
- Large textarea for pasting raw text
- "Create Card" button parses the text using these rules:
  - **ID No**: regex `[A-Z]\d{5,8}`
  - **Sex**: "Male" or "Female"
  - **DOB**: supports `13 Jun 1993`, `1993-06-13`, `13/06/1993`, `13-06-1993`
  - **Contact**: last 7–10 digit number found
  - **Name**: first line minus age-related words and ID number
  - **Address**: line containing comma or atoll tokens (R./B./K./L.), normalized to `Building, Atoll Island`, split into building/atoll/island fields
  - Junk lines (Washed Out, blurred, low quality, etc.) are ignored

### Photo Upload
- Photo box that accepts **clipboard paste** (Ctrl+V / Cmd+V)
- Preview of pasted image before saving

### Editable Form
- Pre-filled fields from parsing: ID No, Name, DOB, Sex, Address (building, atoll, island), Contact
- All fields editable for manual correction

### Save Flow
1. Check for duplicate `id_no` (client-side check + DB unique constraint)
2. Insert record into `persons` table
3. Upload photo to `person-photos` bucket
4. Update `photo_path` on the person record
5. Show success toast, clear form and photo preview

---

## Phase 5: Styling & Responsiveness

- Clean modern card-based UI with rounded corners and subtle shadows
- Light gray background, dark blue primary buttons
- Mobile responsive: single column on small screens, two columns on larger
- Consistent header across all pages with app name and logout

