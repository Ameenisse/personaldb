

## Plan: Add Generate Sheet Page with PDF Export

### Overview
Create a new page at `/generate-sheet` where users can filter persons by atoll, island, and building, preview results in a table, and save the filtered sheet as a PDF.

### Changes

#### 1. New Page: `src/pages/GenerateSheetPage.tsx`
- Filter controls: Atoll (select), Island (dynamic select based on atoll), Building (text input)
- "Generate" button to apply filters against the in-memory persons list
- Results displayed in a clean table (ID, Name, DOB, Sex, Building, Atoll, Island, Contact)
- "Save as PDF" button using `window.print()` with a print-specific CSS approach (no extra dependency needed) — the table area gets printed cleanly

#### 2. Update `src/App.tsx`
- Add route `/generate-sheet` pointing to `GenerateSheetPage` inside the protected layout

#### 3. Update `src/pages/LandingPage.tsx`
- Add a "Generate Sheet" navigation button alongside existing buttons

#### 4. Print CSS in `src/index.css`
- Add `@media print` rules to hide header, nav, filter controls, and only show the sheet table for clean PDF output

### Technical Notes
- Reuse the same client-side data fetching pattern (fetch up to 5000 persons)
- Use `window.print()` for PDF — browser's native "Save as PDF" option in print dialog, zero dependencies
- Dynamic island filtering mirrors the existing pattern from LandingPage

