# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Thai (THB) salary calculator web app. The **entire application** — HTML, CSS, and JavaScript — lives in `index.html`. There is no build step, no package manager, no test suite, and no dependencies beyond the Firebase CDN scripts loaded in `<head>`.

## Running / developing

Open `index.html` directly in a browser, or serve the directory statically (e.g. `python -m http.server`). Edits to `index.html` take effect on reload. Firebase Auth + Firestore are live against the project hardcoded in `firebaseConfig` (near the top of the `<script>` block), so signing in and saving hits the real backend.

## Architecture

**Auth + data flow.** `auth.onAuthStateChanged` is the single entry point (bottom of the script). On sign-in it calls `showApp()` → `loadSettings()` → `loadMonth()`. There is no router; visibility is toggled between `#loading-screen`, `#auth-screen`, and `#app`.

**Firestore layout (per user):**
- `users/{uid}` — document with a `settings` field (`base`, `travel`, `ssf`, `otherIncomes[]`, `otherDeductions[]`).
- `users/{uid}/months/{YYYY_MM}` — one document per month (key from `monthKey()`), holding `days` (a map keyed by `YYYY-MM-DD`) plus a top-level `otherDeduction` number. Each day object is shaped by `defDay()`: `{ worked, isHoliday, satAbsent, sunAbsent, leave, ot: {"1","1.5","2","3"}, note }`.

**Global mutable state:** `Y`/`M` (current view), `mdata` (the loaded month doc), `editDate` (day being edited in the modal), and the salary constants `BASE`/`TRAVEL`/`SSF`/`HOURLY`/`OTHER_INCOMES`/`OTHER_DEDUCTIONS` (overwritten by `applySettings`).

**Render pipeline:** almost every mutation ends with `renderAll()` → `renderGrid()` (×2 calendars) + `renderSummary()`. `save()` writes the whole `mdata` doc back to Firestore and shows a toast. Writes are fire-and-forget (not awaited).

## Domain logic (the non-obvious parts)

This is the core of the app — read `calc()` and the date helpers (`otDates`, `attDates`) before changing money math.

- **Two different date ranges per month.** The **OT period** runs the **25th of the previous month through the 24th of the current month** (`otDates`), and drives OT pay and travel allowance. **Attendance** uses the plain calendar month 1st–last (`attDates`), and drives absence deductions. The two calendars (`#pane-ot`, `#pane-att`) render these respective ranges. `allDates()` is their union, used to seed `defDay` entries.
- **Auto-advance:** on load, if today is the 25th or later, the view jumps to the *next* month (so you're editing the OT period you're currently in).
- **OT rates** are multipliers on `HOURLY = BASE / 30 / 9`: `1.5×` for weekday OT, `1×`/`2×`/`3×` for holiday work. Weekday OT only allows 1.5×; holidays unlock 1×/2×/3×. The Quick-preset buttons in the modal map clock-out times to hour amounts.
- **Travel allowance** (`TRAVEL`/day) is paid only for OT-period days that are worked, non-Sunday, and non-holiday.
- **Absence deduction** uses daily rate `BASE / 30`. Weekdays are absent if not worked, not holiday, and not on leave. Saturdays/Sundays only deduct when explicitly flagged absent (`satAbsent`/`sunAbsent`) — they are off by default.
- **Leave** keeps full salary but pays no travel and is not counted absent; `worked` and `leave` are mutually exclusive (enforced in both the modal handlers and `saveDay`). The Leave Request modal bulk-applies leave across a date range, skipping weekends and holidays.

## Conventions

- Single file, no modules. Functions are global and wired up via inline `onclick=` attributes in the HTML.
- UI is rebuilt by assigning `innerHTML` from template strings, then re-attaching listeners where needed (see `openModal`).
- Dark mode is a `dark` class on `<html>`, persisted in `localStorage` (applied pre-paint by the inline script in `<head>` to avoid flash).
- Currency is formatted with `fmt()`; date strings are always `YYYY-MM-DD` (`fd()` builds them, `jsDate()` parses to a local `Date`).
