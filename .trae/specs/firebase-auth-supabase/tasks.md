# Firebase Authentication with Supabase Data Store - Implementation Plan

## Task 1: Add Supabase migration 006 — firebase_uid columns + unique indexes
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create `supabase/migrations/006_add_firebase_uid.sql`.
  - Add `firebase_uid VARCHAR(255)` nullable column to `tenants`.
  - Add `firebase_uid VARCHAR(255)` nullable column to `admins` (from 001_initial_schema.sql).
  - Create UNIQUE indexes `idx_tenants_firebase_uid` on `tenants(firebase_uid)` and `idx_admins_firebase_uid` on `admins(firebase_uid)` — both IF NOT EXISTS.
  - Verify idempotency: ALTER TABLE ... ADD COLUMN IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS.
  - Ensure RLS is already enabled on both tables (it is: admins via 001, tenants via 004) and existing policies are not touched.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-1.1: Applying the migration twice consecutively must succeed (no duplicate-column / duplicate-index errors).
  - `rule` TR-1.2: After applying migration, `information_schema.columns` returns one row for `tenants.firebase_uid` and one for `admins.firebase_uid` with type `character varying` / nullable YES.
  - `rule` TR-1.3: After applying migration, both unique indexes appear in `pg_indexes` for tables `public.tenants` and `public.admins` with names containing `firebase_uid`.

---

## Task 2: Add Firebase env vars to backend .env + .env.example
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - In `backend/src/config/index.js`, keep the existing firebase block (already there). No code changes unless needed; the block already reads:
    - `FIREBASE_PROJECT_ID`
    - `FIREBASE_CLIENT_EMAIL`
    - `FIREBASE_PRIVATE_KEY`
  - Update `backend/.env.example` to append a new `# Firebase Admin SDK` section with all 3 variables and copy-paste-friendly comments telling the user exactly where to download the JSON (Firebase Console → Project Settings → Service Accounts → Generate new private key) and which JSON keys map to each env var (`project_id`, `client_email`, `private_key`).
  - Update the active `backend/.env` file to include the same 3 variable placeholders (do NOT commit with real secrets — the user will paste them).
  - Update `backend/.env.production` similarly with a Firebase section and placeholder values + comments.
- **Acceptance Criteria Addressed**: FR-7, NFR-5, AC-10
- **Test Requirements**:
  - `rule` TR-2.1: `grep "FIREBASE" backend/.env.example` returns at least 3 distinct variables (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY).
  - `rule` TR-2.2: `backend/.env` when loaded by Node (`node -e "import('./src/config/index.js').then(c=>console.log(c.default.firebase))"`) prints an object with the 3 placeholder strings (no crashes).

---

## Task 3: Add Firebase env vars to frontend .env + .env.example + client init module
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create `frontend/src/config/firebase.js` which:
    - Imports `initializeApp` from `firebase/app` and `getAuth`, `GoogleAuthProvider` from `firebase/auth`.
    - Reads `import.meta.env.VITE_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId optional).
    - If the required `apiKey` is falsy, it returns `{ app: null, auth: null, googleProvider: null, isConfigured: false }` with a single `console.warn` (NFR-2).
    - Otherwise, calls `initializeApp(firebaseConfig)`, creates a `GoogleAuthProvider`, exports `{ app, auth, googleProvider, isConfigured: true }`.
  - Update `frontend/.env.example` to include all VITE_FIREBASE_* keys in a `# Firebase Web SDK` section with comments pointing to Firebase Console → Project Settings → Add App → Web App → then copy SDK snippet values.
  - Update active `frontend/.env` with the same placeholders.
  - Update `frontend/.env.production` similarly.
- **Acceptance Criteria Addressed**: FR-1, FR-7, AC-8, AC-10
- **Test Requirements**:
  - `rule` TR-3.1: When no VITE_FIREBASE env vars set, `import('./src/config/firebase.js')` resolves with `{ isConfigured: false }` and no throw.
  - `rule` TR-3.2: When VITE_FIREBASE_API_KEY (and friends) are set, `import('./src/config/firebase.js')` resolves with `isConfigured: true` and a non-null `auth` object.
  - `rule` TR-3.3: `grep "VITE_FIREBASE" frontend/.env.example` returns at least 6 lines (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

---

## Task 4: Rewire AuthContext (frontend) to use Firebase auth token as bearer
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - In `frontend/src/context/AuthContext.jsx`:
    - Import `{ auth, isConfigured as fbConfigured }` from `../config/firebase`.
    - Import `{ signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, getIdToken }` from `firebase/auth` as needed (guard behind fbConfigured check — never call them when unconfigured).
    - Add a new effect that subscribes `onAuthStateChanged(auth, ...)` ONLY when `fbConfigured === true`; this is what keeps the ID token fresh. Whenever Firebase user changes, get the ID token via `user.getIdToken(true)` and update `localStorage.setItem('token', token)` so the axios interceptor picks it up.
    - Rewrite `login(email, password)` so that IF `fbConfigured` it calls Firebase `signInWithEmailAndPassword`, waits for the ID token, and then POSTs `{ idToken }` (NOT email+password) to `/api/tenant/login`. If Firebase not configured → falls back to current legacy `{ email, password }` POST.
    - Rewrite `signup(payload)` so that IF `fbConfigured` it calls Firebase `createUserWithEmailAndPassword`, waits for ID token, then POSTs `{ idToken, name, businessName, businessType, phone }` to `/api/tenant/signup`.
    - Add a new exported method `loginWithGoogle()` that signs in with Google popup, gets ID token, POSTs `{ idToken }` to `/tenant/login`, handles `signupRequired: true` case by storing the pending Firebase info into a transient state (`pendingSignupInfo` in context + localStorage key `pendingSignup`), then transitions the Login page into signup mode pre-filled.
    - Rewrite `logout()` to call `signOut(auth)` if configured, THEN clear localStorage.
    - Keep `verifyAuth()` working exactly as-is (it still calls `/api/tenant/me` with the bearer token from localStorage).
- **Acceptance Criteria Addressed**: FR-2, FR-3, FR-4, FR-5, FR-6, AC-1, AC-2, AC-3, AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-4.1: When fbConfigured=false, login(email, pwd) call hits `/api/tenant/login` with a JSON body containing `email` and `password` keys (existing behavior).
  - `rule` TR-4.2: When fbConfigured=true, login(email, pwd) call hits `/api/tenant/login` with a JSON body containing ONLY `idToken` key (no password transmitted to backend).
  - `rule` TR-4.3: `loginWithGoogle()` function exists in the exported context value and invokes `signInWithPopup` when called.
  - `rule` TR-4.4: Calling logout after Firebase login produces `signOut` call and clears localStorage keys `token`, `admin`, `tenant`, `subscription`.

---

## Task 5: Update Login.jsx page — add Google Sign-In button, wire new AuthContext flows
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - Destructure `loginWithGoogle`, and add a transient state `pendingSignupInfo` if needed, from the AuthContext.
  - Import Firebase-related exports and wrap Google sign-in in an error handler.
  - Render a Google Sign-In button (stylized, with a Google icon) ONLY when Firebase is configured (`useFirebaseConfigured()` hook or reading context).
  - Add a visual divider "or continue with email" between the Google button and the email/password form.
  - On successful Google login:
    - If backend returned `signupRequired: true`, auto-switch `mode` to `signup`, pre-populate `form.email` and `form.name` from the returned `firebase` info, and show a toast "Almost done — finish creating your business account".
    - If backend returned success → go to `/` dashboard.
  - On form submit (email/password login), keep calling `login(form.email, form.password)` as before (it's now rewired in AuthContext per Task 4).
  - On form submit (signup mode), keep calling `signup(form)` as before (rewired in Task 4).
  - Maintain password visibility toggle (Eye/EyeOff), toast errors, loading spinner (Loader2), responsive layout.
- **Acceptance Criteria Addressed**: FR-2, FR-3, FR-4, FR-5, AC-1, AC-2, AC-3, AC-9
- **Test Requirements**:
  - `rule` TR-5.1: When Firebase is NOT configured → no Google button renders; login via email/password uses legacy path successfully.
  - `rule` TR-5.2: When Firebase IS configured → Google button is visible, clicking it triggers a popup flow (observed via browser, blocked popups reported via toast).
  - `rubric` TR-5.3: Sign-in page UI polish. Dimension per AC-9 (Google button styling, divider, loading states, mobile responsiveness); scale 1-5; anchors 1/3/5; threshold >= 4; evidence = screenshots of desktop + mobile widths.

---

## Task 6: Backend robustness fixes for existing Firebase stubs (no-op if already perfect)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - Re-read and lightly harden existing backend Firebase-related code:
    - `backend/src/config/firebase.js` — ensure privateKey newlines are handled (currently does `replace(/\\n/g,'\n')`), and that all 3 config values missing results in `null` app / "disabled" behavior rather than throwing during import.
    - `backend/src/controllers/tenantController.js` — ensure that the `login` function's existing `idToken` path returns `signupRequired: true` with the correct shape that the frontend expects from Task 4/5. Ensure any existing `data.firebase.uid` and `data.firebase.email` match.
    - `backend/src/middleware/tenant.js` — ensure `authenticateWithFirebase` correctly throws 403 with the exact message `"Account not registered. Please complete signup first."` for the `signup_required` branch so the frontend doesn't misclassify it as a generic 401.
    - Double-check `createTenantAndAdmin` sets `firebase_uid` on both `tenants` and `admins` (already does in code).
  - Ensure the `login` response for legacy success still returns `token` (legacy JWT) as the bearer token key name the frontend stores (no changes required).
- **Acceptance Criteria Addressed**: FR-9, FR-10, AC-4, AC-5
- **Test Requirements**:
  - `rule` TR-6.1: Starting the backend server (`node src/server.js`) without any FIREBASE_* env vars set must exit cleanly OR run without crashing — confirmed by "Firebase auth features disabled" console warning, not a throw.
  - `rule` TR-6.2: Sending a request with a valid legacy JWT to `GET /api/tenant/me` returns HTTP 200 with admin, tenant, subscription (existing behavior preserved).

---

## Task 7: Update protected route middleware to accept Firebase ID token as the Authorization bearer (verify end-to-end)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 6
- **Description**:
  - The existing logic in `backend/src/middleware/tenant.js` already handles Firebase tokens first, then falls back to legacy JWT. Verify by hand-testing (not unit tests):
    - Scenario A: valid Firebase idToken + user already linked → 200 with correct tenant/admin.
    - Scenario B: valid Firebase idToken + user NOT linked → 403 `Account not registered. Please complete signup first.`.
    - Scenario C: garbage token → 401 `Invalid token.`.
    - Scenario D: valid legacy JWT → 200 (fallback, FR-10).
  - No code changes anticipated here — just documenting expected behavior. If any scenario fails during verification, patch the middleware in this same task.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-7.1: All four scenarios (A/B/C/D) return the documented status codes and messages via curl/Postman (or a small node script).
  - `rule` TR-7.2: After scenario A succeeds, a subsequent `GET /api/customers` (tenant-scoped) returns only rows where `customers.tenant_id` matches the tenant of the bearer token.

---

## Task 8: Apply migration to live Supabase and verify schema
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Run `supabase_apply_migration` with the absolute path of `006_add_firebase_uid.sql` against project `ilznpjxdmppeyqicsbap`.
  - Then use `execute_sql` to run the three TR verification queries from Task 1 (columns + indexes + RLS status).
  - Record outputs as completion evidence.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-8.1: Migration apply returns success (no SQL error thrown by Supabase).
  - `rule` TR-8.2: SQL verification queries return expected rows matching TR-1.2/1.3.

---

## Task 9: Smoke-test end-to-end: run backend + frontend dev server and exercise login flows
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8
- **Description**:
  - Install any missing dependencies (none expected — firebase and firebase-admin are already in both package.jsons), then:
    - Run backend: `cd backend && node src/server.js` or `npm run dev`.
    - Run frontend: `cd frontend && npm run dev`.
  - Exercise the following flows manually (or via a headless script):
    a. Legacy login with admin@salon.com / Admin@123456 — still works; dashboard loads.
    b. If user has pasted real Firebase creds, test Firebase Email/Password signup and login; otherwise skip gracefully with a note.
    c. Verify logout clears token and redirects to /login.
    d. Protected customer API call returns 200 with data.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-4, AC-7, AC-8
- **Test Requirements**:
  - `rule` TR-9.1: Both servers start without exceptions (backend on port 5000, frontend on port 5173 — or whatever is available).
  - `rule` TR-9.2: Flow (a) legacy login succeeds end-to-end → customer list page shows data → logout succeeds.
  - `rubric` TR-9.3: Stability/error-freedom of the whole flow; dimension "no unhandled errors or console warnings beyond expected graceful-degradation notices"; scale 1-5; anchors 1=multiple console errors; 3=one minor warning; 5=zero red console output; threshold >= 4; evidence = browser console + server terminal screenshots.

---

## Task 10: Backend legacy authService regression test (preserve existing behavior)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 6
- **Description**:
  - Run `backend/src/services/authService.test.js` via whatever test runner the project uses. Currently project has `run-test.mjs` and `authService.test.js` using plain `node:test` style. Use `node --test backend/src/services/authService.test.js` or `node backend/run-test.mjs` as applicable.
  - If tests expose any regression (e.g., bcrypt login path broken), fix them within this task.
- **Acceptance Criteria Addressed**: AC-4, FR-10
- **Test Requirements**:
  - `rule` TR-10.1: Every test case in `authService.test.js` passes.
  - `rule` TR-10.2: Login with the fallback (env-admin-email + env-admin-password) in dev still works (explicitly covered by a test already).
