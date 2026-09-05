# Firebase Authentication with Supabase Data Store - Product Requirements Document

## Overview
- **Summary**: Replace and augment the current email/password (bcrypt) authentication with Firebase Auth, supporting Google Sign-In and Firebase-managed Email/Password. All business data (tenants, admins, customers, invoices, etc.) continues to live in Supabase with the existing multi-tenant SaaS architecture. Firebase UIDs are linked to Supabase `tenants.firebase_uid` and `admins.firebase_uid` columns.
- **Purpose**: Enable secure, production-grade authentication (password reset flows, email verification, brute-force protection, Google OAuth SSO) managed by Firebase, while retaining Supabase as the single source of truth for all CRM business data.
- **Target Users**: Salon/SPA/clinic owners and staff who log into the CRM Pro web application.

## Goals
- G1: Users can sign in via Firebase Email/Password on the Login page.
- G2: Users can sign in via Firebase Google Sign-In (OAuth) with a single click.
- G3: New Firebase-authenticated users without an existing tenant record are guided through signup (business name, business type, etc.) with a 3-day free trial.
- G4: Existing legacy users (bcrypt passwords) can continue logging in during a transition period, and their accounts are auto-linked to Firebase UIDs on first Firebase login.
- G5: Every authenticated request continues to work via the existing middleware — both Firebase ID tokens and legacy JWTs are accepted.
- G6: All data (tenants, admins, customers, invoices, templates, WhatsApp sessions, etc.) is stored in Supabase only — Firebase Auth stores only the identity (email, UID, display name), no business records.

## Non-Goals
- NG1: Migrating business data from Supabase into Firebase Firestore or Realtime Database.
- NG2: Firebase Phone OTP authentication (not in scope per user preference).
- NG3: Removing the legacy JWT/bcrypt path immediately (kept for 30-day transition).
- NG4: Adding SAML, Apple, Facebook, or other OAuth providers.
- NG5: Changing the database schema for any CRM tables other than adding `firebase_uid` columns and indexes.

## Background & Context
- The current stack: Node.js (Express) backend + Vite (React) frontend + Supabase (PostgreSQL, 11 tables, multi-tenant with `tenant_id` FK + RLS).
- Backend already has stubs for Firebase Admin SDK (`backend/src/config/firebase.js`), backend middleware (`tenant.js`) that knows how to verify an ID token, and `tenantController` signup/login that accept an `idToken` body field.
- Frontend already has the `firebase@12.18.0` npm package installed but no client-side initialization or usage.
- Backend `.env` and frontend `.env` do not currently include Firebase credential variables.
- The Supabase migrations (001-005) do not add `firebase_uid` columns on `tenants` or `admins`, even though the backend models already attempt to write them.
- Active Supabase project ID: `ilznpjxdmppeyqicsbap` (per project_memory).

## Functional Requirements
- **FR-1 (Frontend Firebase Init)**: The frontend must initialize the Firebase Web SDK at startup using `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` env vars.
- **FR-2 (Email/Password Sign-In via Firebase)**: The Login page must authenticate the user with `firebase/auth` `signInWithEmailAndPassword`, obtain an ID token, and POST that token (as `idToken`) to `/api/tenant/login`.
- **FR-3 (Google Sign-In via Firebase)**: The Login page must render a Google Sign-In button that calls `signInWithPopup(GoogleAuthProvider)`, obtains the ID token, and POSTs the `idToken` to `/api/tenant/login`.
- **FR-4 (Firebase Sign-Up Flow)**: When in "Sign Up" mode, the Login page must create a Firebase user via `createUserWithEmailAndPassword`, then POST the resulting `idToken` along with business info (businessName, businessType, phone) to `/api/tenant/signup`.
- **FR-5 (Signup-Required UX)**: If the backend returns `{ signupRequired: true }` (Firebase user exists but no Supabase tenant), the frontend must transition into signup mode pre-filled with the Firebase user's email and name and allow them to finish creating the tenant.
- **FR-6 (Token Refresh & Logout)**: The frontend must use the Firebase ID token as the bearer token sent to the backend (via the existing axios interceptor's `Authorization: Bearer <token>` header), and must call `signOut()` on the Firebase auth object during logout in addition to clearing localStorage.
- **FR-7 (Env Documentation)**: Both `backend/.env.example` and `frontend/.env.example` must document all required Firebase variables with comments.
- **FR-8 (DB Schema — firebase_uid Columns)**: A new migration (006) must add `firebase_uid VARCHAR(255)` nullable columns (with unique indexes) to `tenants` and `admins` tables, and enable RLS policies consistent with existing ones.
- **FR-9 (Backend — Idempotent Linking)**: When a Firebase user signs in and either `tenants.firebase_uid` or `admins.firebase_uid` is null for a matching email, the backend must write the `firebase_uid` to those rows so subsequent logins work by UID lookup directly.
- **FR-10 (Legacy Fallback Preserved)**: The legacy email/password path (`AuthService.login`, bcrypt compare) must remain functional for the transition period and return the same legacy JWT the frontend already knows how to store and use.

## Non-Functional Requirements
- **NFR-1 (Security)**: Firebase ID tokens must always be verified server-side via `firebase-admin` `verifyIdToken(token, true)` (checkRevoked=true) — never trust a client-asserted email/UID.
- **NFR-2 (Graceful Degradation)**: If Firebase is not configured (env vars missing), the Login page must fall back to the current legacy email+password submission path with a console warning rather than crashing.
- **NFR-3 (Idempotency)**: Clicking Google sign-in or the login button multiple times rapidly must not create duplicate tenants or duplicate admin rows.
- **NFR-4 (Time Budget)**: Login end-to-end (button click → dashboard rendered) must complete within 3 seconds on a typical broadband connection.
- **NFR-5 (Backward Compat)**: No existing API route, middleware, or model should break — existing authenticated cron jobs, WhatsApp flows, invoice PDF generation, etc. must continue to work without code changes.

## Constraints
- **Technical**:
  - All child tables must reference `tenants(id)` via `tenant_id` for SaaS isolation (existing constraint — must not break).
  - RLS must remain enabled on all DB tables (existing constraint — must not break).
  - Backend uses `firebase-admin@^14.3.0`; frontend uses `firebase@^12.18.0` (already installed, version upgrade not permitted without explicit approval).
  - Node engine: `>=22.0.0`; frontend runs on Vite; env vars must be `VITE_` prefixed on the frontend.
  - Backend Supabase service role key must continue to be the only DB writer (no client writes).
- **Business**:
  - 30-day legacy login transition period (after which legacy path can be removed in a separate change).
  - No credit card required for trial; trial duration stays 3 days (existing behavior).
- **Dependencies**:
  - User must provide (or have provided) a Firebase project with:
    - Email/Password provider ENABLED in Firebase Console → Authentication → Sign-in method.
    - Google provider ENABLED in Firebase Console → Authentication → Sign-in method.
    - Authorized domain for the frontend (localhost + any production domain).
    - Admin SDK service account JSON downloaded (projectId, clientEmail, privateKey).

## Assumptions
- A1: The user has a Firebase project and can paste the Web config and Admin SDK values into `.env` files after we add the placeholders.
- A2: Google Sign-in requires only the default GoogleAuthProvider scopes (email + profile); no additional Google Workspace APIs are needed.
- A3: When both a legacy bcrypt password and a Firebase user exist for the same email, logging in via Firebase is authoritative and auto-links the UID.
- A4: The backend's existing `verifyIdToken(idToken, true)` (with `checkRevoked=true`) is acceptable even though it adds an extra HTTP round-trip to Firebase.

## Acceptance Criteria

### AC-1: User can sign up with Email/Password via Firebase and tenant + subscription + defaults are created in Supabase
- **Type**: `rule`
- **Given**: A new user (no existing tenant, no existing Firebase user) opens the Login page, clicks Sign Up, fills name, email, password (>=8 chars), business name, business type, and phone, and clicks Create Account.
- **When**: Frontend calls Firebase `createUserWithEmailAndPassword`, then POSTs `{ idToken, businessName, businessType, phone }` to `/api/tenant/signup`.
- **Then**:
  - Backend verifies the idToken with Firebase Admin, extracts email/UID.
  - A new row is inserted into `tenants` with `owner_email`, `owner_name`, `business_type`, `name`, `phone`, and the new `firebase_uid`.
  - An `admins` row is inserted with the same `email`, `name`, `tenant_id`, and `firebase_uid`, and `password_hash = NULL` (Firebase auth only).
  - A `subscriptions` trial row is created for the tenant with a 3-day trial.
  - Default services and templates are seeded for the tenant.
  - Frontend stores the returned bearer token and redirects to `/onboarding`.
- **Pass Condition**: All the above are observable via Supabase table queries + network tab.
- **Evidence**: Supabase SQL query results + network logs showing 201 response with `authMode: 'firebase'`.

### AC-2: User can log in via Firebase Email/Password when tenant already exists
- **Type**: `rule`
- **Given**: A tenant+admin exist in Supabase with a known email, and either (a) a Firebase user with that same email already exists (linked via `firebase_uid`) OR (b) only a legacy bcrypt admin exists.
- **When**: User enters email/password on the Login page and clicks Login (frontend calls `signInWithEmailAndPassword`, then POSTs `idToken` to `/api/tenant/login`).
- **Then**:
  - Backend verifies the token, resolves tenant by `firebase_uid` falling back to email match.
  - If `firebase_uid` was previously NULL on tenant/admin, they are now populated with the Firebase UID.
  - Backend returns `{ success: true, data: { token, admin, tenant, subscription } }`.
  - Frontend navigates to `/` (dashboard).
- **Pass Condition**: Login succeeds, token bearer auth works on subsequent `/tenant/me` call, and `firebase_uid` columns are populated for previously-unlinked rows.
- **Evidence**: Network log of `/tenant/login` and `/tenant/me` success + Supabase SQL showing populated `firebase_uid`.

### AC-3: User can log in via Google Sign-In button on Login page
- **Type**: `rule`
- **Given**: Login page renders a Google Sign-In button; browser has a live Google session.
- **When**: User clicks the Google Sign-In button, selects a Google account in the popup, and grants permission.
- **Then**:
  - Frontend obtains a Firebase ID token via GoogleAuthProvider popup.
  - If the tenant already exists (by UID or email), login completes per AC-2.
  - If no tenant exists, backend returns `{ signupRequired: true, firebaseUid, ...}` and frontend transitions to Sign Up mode pre-filled with Google-provided email + display name.
- **Pass Condition**: Google popup opens, account is picked, either dashboard loads (existing tenant) or signup form appears pre-filled (new tenant).
- **Evidence**: Browser screenshot/network logs of Firebase popup auth + `/tenant/login` response.

### AC-4: Existing legacy (email+bcrypt) login still works during the transition
- **Type**: `rule`
- **Given**: An admin row in Supabase has a non-null `password_hash` (bcrypt) and Firebase env vars may or may not be set.
- **When**: User submits legacy `{ email, password }` to `/api/tenant/login` (either via fallback when Firebase is unconfigured, or via a legacy endpoint fallback).
- **Then**: Backend validates password with bcrypt, issues legacy JWT, and the frontend can still call protected routes.
- **Pass Condition**: Existing test `backend/src/services/authService.test.js` passes and manual login using the pre-existing fallback credentials succeeds.
- **Evidence**: `npm test` (or `node run-test.mjs`) passes for `authService.test.js`; manual login flow screenshot.

### AC-5: All protected API routes continue to accept both Firebase ID tokens and legacy JWTs
- **Type**: `rule`
- **Given**: An HTTP client sends either (a) a valid Firebase ID token as `Authorization: Bearer <idToken>` or (b) a valid legacy JWT bearer token.
- **When**: The client calls any existing protected route (e.g., `GET /api/tenant/me`, `GET /api/customers`, `GET /api/invoices`).
- **Then**:
  - Middleware `authenticateTenant` in `tenant.js` resolves `req.admin`, `req.tenant`, `req.subscription` correctly for both token types.
  - Multi-tenant isolation still in effect (can only see rows for own tenant_id).
  - HTTP 200 with tenant-scoped data.
- **Pass Condition**: Two manual curl/Postman calls (one with each token type) return 200 with correct data.
- **Evidence**: HTTP request/response transcript or screenshot for both variants.

### AC-6: Supabase migration adds firebase_uid columns with unique indexes
- **Type**: `rule`
- **Given**: The Supabase migration `006_add_firebase_uid.sql` is applied via `supabase_apply_migration` to project `ilznpjxdmppeyqicsbap`.
- **When**: Querying `information_schema.columns` for `tenants.firebase_uid` and `admins.firebase_uid`, and querying `pg_indexes` for unique indexes on those columns.
- **Then**: Both columns exist (VARCHAR(255) nullable), both have UNIQUE indexes named consistently, and no existing data is modified or deleted.
- **Pass Condition**: SQL queries return the expected rows. RLS on tenants/admins remains enabled with the same service-role policies.
- **Evidence**: SQL output plus successful migration apply return.

### AC-7: Logout clears both Firebase client auth state and localStorage
- **Type**: `rule`
- **Given**: A user is signed in via Firebase and the app has a token in localStorage.
- **When**: User clicks the Logout button in the Layout header.
- **Then**:
  - `firebase/auth` `signOut()` is called (no Firebase user remains in-memory or persisted).
  - `localStorage.clear()` removes `token`, `admin`, `tenant`, `subscription`.
  - User is redirected to `/login`.
- **Pass Condition**: Refresh of the page after logout lands user back on Login page, not dashboard.
- **Evidence**: DevTools Application tab showing empty localStorage + route at `/login`.

### AC-8: Graceful fallback when Firebase env vars are not configured
- **Type**: `rule`
- **Given**: Frontend `VITE_FIREBASE_API_KEY` and backend `FIREBASE_PROJECT_ID` are empty strings / unset.
- **When**: Login page is opened and user attempts login with email/password.
- **Then**: No runtime error; the Login page behaves exactly as the pre-Firebase implementation (POSTs `{ email, password }` directly to `/api/tenant/login` via legacy path) and shows no Google sign-in button.
- **Pass Condition**: App doesn't throw, login succeeds via legacy path, Google button is absent.
- **Evidence**: DevTools console with no errors; successful legacy login flow network log.

### AC-9: Login UI quality and user experience
- **Type**: `rubric`
- **Dimension**: Sign-in page UI polish and informational clarity.
- **Scale**: 1-5
- **Anchors**: 1 = Google button missing / unstyled, no divider between Firebase and legacy sections, no loading states; 3 = Buttons exist with basic styling, loading spinner on submit, divider text "or continue with email"; 5 = Brand-styled Google sign-in button (with Google icon G), divider with horizontal lines and text, consistent loading/success/error toast states, password visibility toggle preserved, responsive on mobile.
- **Pass Threshold**: >= 4
- **Evidence**: Screenshot of the Login page in both login and signup modes, plus a short mobile-sized screenshot (≤420px width).

### AC-10: Documentation and configuration discoverability
- **Type**: `rubric`
- **Dimension**: How easy it is for a new operator to find and fill Firebase credentials after this change.
- **Scale**: 1-5
- **Anchors**: 1 = No example env vars for Firebase exist; 3 = Firebase env vars present in `.env.example` files without any guidance comments; 5 = Both `backend/.env.example` and `frontend/.env.example` contain all Firebase keys grouped under a clearly-titled `# Firebase` section with line-by-line instructions (where in Firebase Console to get each value).
- **Pass Threshold**: >= 4
- **Evidence**: Read of both example env files.

## Open Questions
- [x] OQ-1: Sign-in providers → Google + Email/Password via Firebase. (Answered 2026-09-05).
- [x] OQ-2: Keep legacy login during transition? → Yes, 30-day fallback. (Answered 2026-09-05).
- [x] OQ-3: Firebase credentials ready? → User already has project + both Web config & Admin SDK JSON. (Answered 2026-09-05).
