# Person Registry

React + TypeScript + Tailwind frontend, with **Google Apps Script as the only active backend**. Persons live in Google Sheets; private photos live in Google Drive. No database, Google connector, or Cloud functions are used by the app. Platform-managed legacy integration files may remain unused; the application never imports them.

## Setup (owner action required)

1. Download `google-apps-script/Code.gs` from this repo (or **Backend file** on Setup Required). Open https://script.google.com/home and create a standalone project with the Google account that can edit both resources below.
2. Replace the editor's Code.gs with the complete supplied file. Save, select **setupApp**, and click **Run**. Approve Google Sheets/Drive permissions. This creates/formats only the `Persons` tab, verifies folder access, and sets the default PIN **1388** in Script Properties without overwriting an existing PIN. Unrelated tabs are untouched; incompatible Persons headers cause an error instead of overwriting data.
3. In Apps Script **Project Settings → Script Properties**, change `APP_PIN` before real use. It can contain 4–12 digits; changing it invalidates existing sessions. Do not put the PIN in frontend configuration.
4. Select **Deploy → New deployment → Web app**. Execute as **Me** (the owner), Who has access: **Anyone**. Deploy and copy the URL ending `/exec`, not `/dev`. Google may require reviewing the unverified script authorization. If your Workspace blocks public Web Apps, this direct bridge cannot be used without an administrator permitting this deployment type.
5. Configure Lovable's frontend environment variable `VITE_GOOGLE_APPS_SCRIPT_URL` with that actual deployment URL, then refresh/rebuild the preview and republish when ready. This is a public URL, not a secret. If frontend environment editing is unavailable, set the single `GOOGLE_APPS_SCRIPT_URL` constant in `src/lib/appsScriptApi.ts` to the real URL. Never add private Google keys. No fake URL is supplied.
6. Open the registry and enter your PIN. Verify a test record, paste a photo, save, search, and export before entering real data. Until a valid URL is configured, every page shows **Setup Required** without sending backend requests.

Backend updates: **Deploy → Manage deployments → Edit → New version → Deploy**; keep the same /exec URL. Running code in the editor does not update an existing deployment.

## Already embedded resources

- Spreadsheet ID: `1Gu8HZp0V9cfr3q9DpZiocxVmduYw0YRu8VMprUyv9xg`
- Spreadsheet: https://docs.google.com/spreadsheets/d/1Gu8HZp0V9cfr3q9DpZiocxVmduYw0YRu8VMprUyv9xg/edit?usp=drivesdk
- Photo folder ID: `1F1CHrETiRi8HyvQPV9FMXxZspmZM-CfW`
- Folder: https://drive.google.com/drive/folders/1F1CHrETiRi8HyvQPV9FMXxZspmZM-CfW

Exact Persons columns, in order:

```text
RecordID, IDNo, Name, DOB, Sex, Contact, Building, Atoll, Island, AddressFull, PhotoFileID, PhotoURL, CreatedAt, UpdatedAt
```

Existing records in the previous backend are **not automatically migrated**. Back them up and map them into these columns, preserving IDs and ISO DOB (`yyyy-MM-dd`). Move any old photos to the configured Drive folder and set their PhotoFileID. Do not paste old storage URLs as Drive IDs. Do not decommission old storage until migration is verified. setupApp does not import, delete, or repair old records.

## API and security

`doGet` returns health JSON only. `doPost` accepts a JSON body using `Content-Type: text/plain;charset=utf-8` (no Authorization header), avoiding an unsupported CORS OPTIONS preflight. ContentService redirects are followed. Never use `no-cors`: its response cannot be read. Every response is `{ok:true,data:...}` or `{ok:false,error:{code,message}}`; Apps Script typically returns HTTP 200 even for application errors. Do not put tokens or PINs in query strings.

| action | Payload beyond action/token | Returns |
| --- | --- | --- |
| login | pin; no token | token, expiresAt |
| session | none | expiresAt |
| logout | none | loggedOut |
| listPersons | none | all persons |
| getPerson | idNo | person or null |
| savePerson | person, optional recordId, optional photo (JPEG data URL) | person, created, optional warning |
| getPhoto | recordId | dataUrl |

Person API fields: `id`, `id_no`, `name`, `dob`, `sex`, `contact`, `building`, `atoll`, `island`, `address_full`, `photo_file_id`, `photo_url`, `created_at`, `updated_at`. Upload is part of savePerson, avoiding unattached public upload endpoints. Files stay private; PhotoURL is an owner Drive link, not a public image link. getPhoto verifies authentication, the record, file type, size, and configured parent folder before returning image bytes.

PIN validation is server-side. Opaque tokens are kept in sessionStorage; their hashes and expiration are stored in CacheService. Sessions last at most six hours; Google cache eviction may require earlier login. Logout clears local state and requests server revocation. If offline, the server token remains valid until expiration. Ten incorrect PIN attempts trigger a shared 15-minute lockout using Script Properties. This shared PIN grants all authenticated users access to all records: it is not individual user authentication, MFA, or a high-assurance medical/identity data solution. A four-digit default PIN has low entropy. Use a longer PIN and limit who knows it; do not share this deployment publicly with the PIN. Google account/Drive sharing permissions still matter.

## Data integrity and performance

List persons once per login; page navigation uses the shared in-memory list. Reload only after saves or explicit retry. No polling. Photos load on demand and have a bounded memory-only cache. API reads use bulk ranges; writes use LockService and case-normalized unique ID checks. Repeated saves with the same ID update, never append duplicates. ID changes cannot silently overwrite another record. Concurrent updates to the same record are last-write-wins.

Photos are paste-only (no picker, camera, drop, or tap upload), original JPEG/PNG/WebP up to 5 MB. Browser compression outputs JPEG up to 1600px at quality 0.86; server validates JPEG signature and limits output to 3 MB. Old photos are retained unless replaced. Replacement is saved first; old files are trashed only when inside the configured folder. Failed writes attempt cleanup of newly created files. Sheets and Drive do not support cross-service transactions; severe interruptions may require owner cleanup of orphan files. Take regular backups.

Google Apps Script/Sheets/Drive have execution, concurrency, and daily quotas. Several thousand rows are read in bulk; no unlimited-scale guarantee. Network timeouts do not prove a save failed: retry with the same ID. PDF and Excel export current filters, sort, and visible columns. Built-in PDF fonts best support Latin text; additional fonts would be needed for full non-Latin export coverage.

## Troubleshooting

- Setup Required: supply the real `/exec` URL in the one configuration point.
- Non-JSON/login HTML/CORS failure: confirm Execute as Me, access Anyone, `/exec`, deployed latest version, and organizational access policy. No browser proxy or alternate backend is required.
- Wrong PIN: check Script Properties, not frontend code. Reset LOGIN_FAILURES in Script Properties only as owner if locked out.
- Permission/quotas: inspect Apps Script **Executions** and verify owner access to both resources.
- Photo unavailable: verify PhotoFileID exists in the configured folder. Existing data is retained if no new photo is pasted.

## Local development

```sh
bun install
bun run dev
bun run test
```

A live deployment URL and owner authorization are required for real end-to-end Google verification; automated tests use local mocks and do not claim live deployment.
