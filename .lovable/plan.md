

## Plan: High-Speed Face Match

### Problem
The current implementation already uses parallel batches with `gemini-3-flash-preview`, but can be further accelerated by reducing payload size and using a faster model.

### Changes

#### 1. Edge Function (`supabase/functions/face-match/index.ts`)
- Switch model to **`google/gemini-2.5-flash-lite`** — the fastest available model, ideal for visual classification tasks like face matching
- Increase batch size to **30** — flash-lite handles lightweight requests faster with larger batches
- Shorten the system prompt to reduce token processing time
- Add `max_tokens: 200` to cap response generation time (we only need short structured output)

#### 2. Client Dialog (`src/components/CameraScanDialog.tsx`)
- Reduce image quality from `0.85` to `0.7` JPEG quality — smaller payload, faster upload
- Auto-trigger scan immediately after capture/upload (skip the "Scan & Match" button step) for instant workflow
- Fix stats toast to use correct field names from current response format

### Files to modify
- `supabase/functions/face-match/index.ts`
- `src/components/CameraScanDialog.tsx`

