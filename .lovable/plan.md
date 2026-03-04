

## Plan: Enhance Search Page with Dynamic Islands, Limited Results, and Person Info Overlay

### 1. Dynamic Island Dropdown Based on Selected Atoll

- Create an `ATOLL_ISLANDS` mapping object (atoll code -> list of island names) derived from the loaded `allPersons` data using `useMemo`
- When an atoll is selected, compute unique islands from `allPersons` where `p.atoll === selectedAtoll`
- Replace the Island `Input` with a `Select` dropdown populated with those islands (plus an "All" option)
- Reset island filter when atoll changes

### 2. Limit Results Table to 5 Rows with Scroll

- Wrap the results `Table` in a `ScrollArea` with a fixed max height (roughly 5 rows worth, ~280px)
- Show only matched results inside the scrollable area so the table never pushes the page layout

### 3. Selected Person Info as Overlay Dialog with Photo Zoom

- Replace the inline `Card` for selected person with a `Dialog` component
- Open the dialog when a person is double-clicked (`setSelected` triggers dialog open)
- Add a close button (built into `DialogContent`)
- Keep the dialog compact/small sized
- Add a second `Dialog` for photo zoom: clicking the thumbnail opens a larger view of the photo
- Use state like `photoZoom` to toggle the enlarged photo dialog

### Files to modify
- `src/pages/LandingPage.tsx` — all three changes in this single file

### Technical details
- Import `Dialog, DialogContent, DialogHeader, DialogTitle` and `ScrollArea` components
- Use `useMemo` to derive `islandsForAtoll` from `allPersons` filtered by `filters.atoll`
- Add `photoZoom` boolean state for the enlarged photo dialog
- The person info dialog opens/closes via `selected` state (open when not null)

