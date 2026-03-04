

## Plan: Advanced Face-Match — Faster and More Accurate

### Problem
Currently, batches run sequentially (one after another), and the model processes all photos at the same confidence level. This is slow for large databases.

### Changes

#### 1. Edge Function — Parallel batch processing
**File: `supabase/functions/face-match/index.ts`**
- Run all batches in **parallel** using `Promise.allSettled()` instead of sequential `for` loop — dramatically faster for large photo sets
- Increase batch size to **20** (Gemini 3 Flash handles it well)
- Add confidence scoring: request the model return `matched_ids` with `confidence` (0-100) per match, filter only matches >= 90%
- Add a two-pass system: first pass with `gemini-2.5-flash-lite` (fastest/cheapest) for quick elimination, second pass with `gemini-3-flash-preview` only on candidates from first pass — much faster overall

#### 2. CameraScanDialog — Better UX during scan
**File: `src/components/CameraScanDialog.tsx`**
- Show real-time batch progress (e.g., "Scanning batch 2 of 5...")
- Increase captured image quality to 600px max dimension for better accuracy
- Add elapsed time display during scan

### Technical Details
- **Two-pass approach**: Pass 1 uses `gemini-2.5-flash-lite` with low threshold (70%) to get candidates fast. Pass 2 uses `gemini-3-flash-preview` with high threshold (90%) only on candidates — reduces total AI calls significantly
- **Parallel execution**: All batches in each pass fire simultaneously via `Promise.allSettled()`
- **Confidence scoring**: Tool schema updated to return `{id, confidence}` pairs instead of just IDs, enabling filtering by confidence level

### Files to modify
- `supabase/functions/face-match/index.ts` — parallel batches, two-pass matching, confidence scores
- `src/components/CameraScanDialog.tsx` — better progress feedback, higher image resolution

