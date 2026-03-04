

## Plan: Support Multiple Contact Numbers

### Problem
When raw text contains two phone numbers separated by `/` (e.g., `9588332/7566376`), only one is captured. Both should be stored.

### Changes

#### 1. Parser (`src/lib/parsePersonText.ts`)
- Update contact extraction to detect slash-separated numbers (e.g., `9588332/7566376`)
- Join multiple numbers with ` / ` delimiter into the single `contact` string field
- Also handle the existing single-number case as before

#### 2. No DB changes needed
- The `contact` column is already `text`, so storing `"9588332 / 7566376"` works directly

### Files to modify
- `src/lib/parsePersonText.ts` — update contact extraction logic

