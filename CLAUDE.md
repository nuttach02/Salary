# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Thai (THB) salary calculator web app. It was historically a single `index.html`; it is now split into `index.html` (structure only) + `css/style.css` + `js/*.js`. There is still **no build step, no package manager, no test runner, and no dependencies** beyond the Firebase CDN scripts loaded in `<head>`. The split was a pure move-only refactor — the JS files concatenated in load order equal the original inline `<script>` byte-for-byte.

## Running / developing

Open `index.html` directly in a browser **or** serve the directory statically (`python -m http.server`). Edits take effect on reload. Firebase Auth + Firestore are live against the project hardcoded in `firebaseConfig` (`js/config.js`), so signing in and saving hits the real backend — automated testing can't reach the running app (it's auth-gated).

- **`file://` works** for everything except Google sign-in — the external CSS/JS are classic resources, not ES modules, so no server is needed for them.
- **Google sign-in requires http(s) on an authorized domain** (e.g. `http://localhost:5500`), not `file://`. Username/password works either way.

**How features are verified** (no test runner): `node --check js/*.js` for syntax (each file is syntactically self-contained), plus Node unit tests of the *pure* functions (`calc`, `classifyImportRow`, `diffPatch`, date/month helpers from `js/calc.js` / `js/import.js`) by copying them into a scratch script with mock inputs. Anything touching the DOM, Firestore, or render must be confirmed by a human browser pass.

## File layout & the load-order contract (read before touching the JS)

`index.html` loads the JS as **plain classic `<script>` tags in a fixed order** — never `type="module"`. All files therefore share one global scope, exactly like the original single `<script>`. Two hard rules:

- **Keep functions global / don't convert to modules.** The UI wires events via inline `onclick=`/`oninput=` attributes, which only resolve against global functions. ES modules would silently break every handler.
- **Don't reorder the `<script>` tags.** Top-level code runs in tag order: `config.js` must run first (it calls `firebase.initializeApp` and declares `auth`/`db`/`Y`/`M`/the salary constants that every later file uses); `main.js` runs last (it registers the `onAuthStateChanged` entry point + global listeners). Files in between only need `config.js`'s globals to exist, which they do.

`js/theme-init.js` is the one exception: it's loaded in `<head>` **before** the stylesheet for pre-paint dark mode (FOUC prevention).

Load order and responsibilities:

| File | Responsibility |
|---|---|
| `config.js` | Firebase init, salary constants, global mutable state, dark-mode toggle |
| `auth.js` | username/password + Google sign-in, auth-screen UI, `showApp`/`logout` |
| `settings.js` | settings modal (base/travel/SSF/other incomes & deductions) |
| `storage.js` | Firestore month load/save (`monthKey`, `userMonths`, `loadMonth`, `save`) |
| `yearly.js` | yearly summary + the `defDay`/`gd`/`leaveHrsOf`/`absentHrsOf` day helpers |
| `calc.js` | date helpers (`otDates`/`attDates`/`allDates`/`fd`/`jsDate`), `calc()`, `fmt` |
| `render.js` | `renderAll` → `renderGrid` (×2) + `renderSummary` |
| `modal.js` | per-day edit modal (OT / leave / absent / lateness) |
| `leave.js` | bulk leave-request modal |
| `import.js` | HR attendance HTML import pipeline + the external-page `postMessage` bridge |
| `main.js` | tabs, month nav, keyboard/touch/swipe, animations, month picker, `onAuthStateChanged` |

## Architecture

**Auth + data flow.** `auth.onAuthStateChanged` (`main.js`) is the single entry point. On sign-in: `showApp()` → `loadSettings()` → `loadMonth()`. No router; visibility toggles between `#loading-screen`, `#auth-screen`, `#app`, and `#year-screen` (`display`/`hidden`).

**Two sign-in methods** (`auth.js`):
- **Username/password** is backed by Firebase email/password via a *synthetic email*: `usernameToEmail()` maps `name` → `name@salaryot.app`; an input containing `@` is passed through verbatim (back-compat for existing real-email accounts). All data is keyed by Firebase `uid`, so the synthetic email never touches storage, and `showApp()` shows `email.split('@')[0]` (= the username / Google account name).
- **Google** via `signInWithPopup(googleProvider)`.
- `firebaseConfig.authDomain` is deliberately set to **`salary-32127.web.app`**, not the default `…firebaseapp.com`, because some corporate firewalls reset `firebaseapp.com` (the OAuth handler's first hop). `.web.app` serves the same handler; its redirect URI `https://salary-32127.web.app/__/auth/handler` must be registered on the OAuth web client in Google Cloud Console.

**Firestore layout (per user):**
- `users/{uid}` — a `settings` field (`base`, `travel`, `ssf`, `otherIncomes[]`, `otherDeductions[]`).
- `users/{uid}/months/{YYYY_MM}` — one doc per month (key from `monthKey()`), holding `days` (map keyed by `YYYY-MM-DD`). Each day is shaped by `defDay()`:
  `{ worked, isHoliday, satAbsent, sunAbsent, leave, leaveHours, leaveStart, leaveEnd, absentHours, ot:{"1","1.5","2","3"}, lateMin, note }`.
  Fields are read defensively (`Number(x)||0`), so older docs missing newer fields still work.

**Global mutable state** (`config.js`): `Y`/`M` (current view), `mdata` (loaded month doc), `editDate` (day open in modal), and salary constants `BASE`/`TRAVEL`/`SSF`/`HOURLY`/`OTHER_INCOMES`/`OTHER_DEDUCTIONS` (overwritten by `applySettings`).

**Render pipeline:** almost every mutation ends with `renderAll()` → `renderGrid()` (×2 calendars) + `renderSummary()`. `save()` writes the whole `mdata` doc back to Firestore (fire-and-forget, not awaited) and shows a toast.

## Domain logic (read `calc()` + the date helpers before changing money math)

- **Two date ranges per month.** The **OT period** = **25th of prev month → 24th of current** (`otDates`); drives OT pay and travel. **Attendance** = plain calendar month 1st–last (`attDates`); drives absence, lateness, leave, absent-hours totals. The two calendars (`#pane-ot`, `#pane-att`) render these ranges; `allDates()` is their union (seeds `defDay`). `calc()` sums attendance-scoped figures over `attDates` filtered by month prefix, and OT/travel over `otDates`.
- **OT rates** are multipliers on `HOURLY = BASE/30/9`: `1.5×` weekday OT; `1×/2×/3×` holiday/rest-day work (the modal only exposes 1.5× on weekdays, 1×/2×/3× on holidays/Saturdays).
- **Travel** (`TRAVEL`/day): OT-period days that are worked, non-Sunday, non-holiday.
- **Absence**: daily rate `BASE/30`. A weekday is absent if not worked, not holiday, not on leave. Sat/Sun only deduct when explicitly flagged (`satAbsent`/`sunAbsent`).
- **Lateness**: `lateMin` per day deducts `lateMin × (BASE/30/9/60)` (per-minute). Summed over the attendance month.
- **Leave is hour-based** (`leaveHours`, 0–9; `leaveHrsOf()` treats legacy `leave:true` as 9h). Leave keeps full salary and is never absent. A **full day (9h) ⇒ `worked:false`** (no travel); a **partial leave (<9h) stays `worked:true`** (travel paid) — i.e. leave and worked are *not* mutually exclusive anymore. The Leave Request modal bulk-applies full-day leave across a range.
- **Absent hours** (`absentHours`) is a **record-only** figure (badge + summary), mirroring leave hours — it does **not** itself deduct; the deduction comes from `lateMin` / the full-day `worked:false` path.

## The dual-doc storage gotcha (most common source of bugs)

A day on the **25th–end** of month M is stored in **two independent docs**: M's own doc (its calendar/attendance month) *and* M+1's doc (M+1's OT period renders it). `calc()` filters by month-prefix (attendance) and `otDates` range (OT), so the duplicate **never double-counts** — but the two copies can **diverge**: editing such a day while viewing M+1 only changes M+1's copy. Any code that reads/writes one copy must consider the other. Note OT is OT-period-scoped, so a day≥25's OT *belongs to* M+1's doc, not M's.

## HR import pipeline (`OvertimeApplication.html`-style exports, in `js/import.js`)

Upload a payroll HTML export via the OT pane button → parse client-side → review a diff → write. Key functions, in order:
- `parseAttendanceHtml(text)` — `DOMParser` over the `<table id="gvAttn">`; one row per `[id$='gvlblWrkdat']`. Reads spans by `[id$='gvlbl…']` and hidden inputs by `[id$='gvhd…'].value` (use the **hidden** `gvhdMin0..3` / `gvhdHolcod` — visible spans are blank on recent/pending days).
- `classifyImportRow(r)` → a **patch** (only the keys it sets are applied). Mapping: `Latmin`→late deduction; `Absenthrs>0`→absent record; `Leacod='Y'` no-swipe→full-day leave, with-swipe→partial leave `L≤30?0:ceil(L/30)×0.5` (same HR rounding as the late→absent estimate); OT `gvhdMin0/1/2/3 ÷60`→`ot["1"/"1.5"/"2"/"3"]`; `Holcod=3`→`isHoliday` (additive — only ever sets true). OT/holiday ride along with any classification.
- `prepareImportDiff()` / `diffPatch()` — compares each patch field against the day's **current value in every doc it lives in** (`importTargetKeys`: primary + next month for day≥25), so a change is detected even if one copy diverged. `openImportPreview()` shows per-day `old→new`; only changed days are written.
- `applyImport()` → `buildImportWrites()` (primary + secondary routing) → `writeDayPatch()`. Secondary (display-mirror) writes use `onlyIfExists` to avoid creating phantom months — except a day≥25 carrying real OT *does* create the next month (its OT-period home).
- An external-page bridge (`window.addEventListener('message', …)`, origins in `IMPORT_MSG_ORIGINS`) lets the HR site push an export in via `postMessage`; if it arrives before auth finishes it's queued in `pendingExternalImport` and replayed once `appReady`.

## Yearly Summary (`js/yearly.js`)

`openYearView()` → `computeYear(year)` fetches all 12 month docs, then runs `calc()` per month by **temporarily swapping the `Y`/`M`/`mdata` globals** (all `await`s happen before the swap; the loop is synchronous; `try/finally` restores). Months with no Firestore doc are excluded from totals (so untouched months don't inject default-worked pay). `sumYear()` aggregates.

## Conventions

- Multiple classic scripts, no modules. Functions are global, wired via inline `onclick=`/`oninput=`. UI is rebuilt by assigning `innerHTML` from template strings, then re-attaching listeners (see `openModal`). HTML inside those template literals is whitespace-sensitive — don't blanket-reindent the JS.
- Dark mode = `dark` class on `<html>`, persisted in `localStorage`, applied pre-paint by `js/theme-init.js` in `<head>`.
- Currency via `fmt()`; dates are always `YYYY-MM-DD` (`fd()` builds, `jsDate()` parses to a local `Date`).
- Thai is used in the import/leave/late UI strings; keep that bilingual style when editing those areas.
