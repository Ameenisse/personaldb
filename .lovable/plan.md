

## Plan: Improve Generate Sheet Page

### Changes

#### 1. Dynamic Building Dropdown (`src/pages/GenerateSheetPage.tsx`)
- Replace the Building text input with a `<Select>` dropdown
- Populate it with unique building names filtered from the loaded persons data, matching the currently selected atoll and island
- Reset building selection when atoll or island changes

#### 2. Alternating Row Styling for PDF (`src/index.css`)
- Add print styles for alternating table rows: white background on odd rows, light gray (`#f9f9f9`) on even rows
- Ensure `print-color-adjust: exact` is set so browsers render the background colors in PDF output

### Files to modify
- `src/pages/GenerateSheetPage.tsx` — building filter becomes a dynamic select
- `src/index.css` — add alternating row print styles

