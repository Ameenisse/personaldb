

## Plan: Camera Scan Search Feature

### Overview
Add a "Camera Scan Search" button to the search page that opens the device camera, captures a photo, sends it to a backend function that uses Lovable AI (Gemini vision) to compare the captured face against stored person photos, and displays matching results.

### How it works
1. User clicks "Camera Scan Search" button on the search page
2. A dialog opens showing a live camera feed (using browser `getUserMedia` API)
3. User captures a photo
4. The captured image is sent to a backend function along with URLs of all person photos that have `photo_path` set
5. The backend function uses Gemini 2.5 Flash (vision-capable) to compare faces and return matching person IDs
6. Matching persons are displayed in the results table

### Implementation

#### 1. Create edge function `supabase/functions/face-match/index.ts`
- Receives: base64 captured photo + array of `{id, photoUrl}` objects (persons with photos)
- Batches photos (e.g. 10 at a time) and sends to Gemini vision with a prompt like: "Compare the reference face photo against these person photos. Return the IDs of any persons whose face matches the reference."
- Uses tool calling to extract structured output (array of matching person IDs)
- Returns matching person IDs
- Handles 429/402 rate limit errors

#### 2. Update `supabase/config.toml`
- Add `[functions.face-match]` with `verify_jwt = false`

#### 3. Update `src/pages/LandingPage.tsx`
- Add "Camera Scan Search" button (Camera icon) next to existing buttons
- Add camera dialog state (`cameraOpen`, `scanning`)
- Camera dialog: shows `<video>` element with live camera feed via `getUserMedia`
- "Capture" button takes a snapshot to canvas, converts to base64
- On capture: collect all persons with `photo_path`, build public URLs, call the edge function
- Display matches in the same results table format
- Show loading/scanning state with a progress indicator

### Technical details
- Camera access uses `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` with fallback to front camera
- Photos are resized on canvas before sending (max 400px) to reduce payload
- Edge function processes in batches to stay within token limits
- Gemini model: `google/gemini-2.5-flash` (vision-capable, cost-effective)

### Files to create/modify
- **Create**: `supabase/functions/face-match/index.ts`
- **Modify**: `supabase/config.toml` (add function config)
- **Modify**: `src/pages/LandingPage.tsx` (add camera button, dialog, scan logic)

