# Product

## Register

product

## Users

A single user: the owner, tracking their own monthly Thai (THB) salary. Used personally — often on a phone, in varied lighting, a few times a month rather than daily. No second audience to design for, so every decision optimizes for one person who already understands their own pay structure (base, travel allowance, OT periods, attendance, leave). The context is quick, confident bookkeeping: open it, log a day or check the running total, trust the number, close it.

## Product Purpose

A single-file web app that turns day-by-day attendance and overtime entries into an accurate monthly salary figure. It models the real pay rules — the OT period (25th→24th) distinct from the calendar attendance month, weekday vs. holiday OT multipliers, travel allowance eligibility, absence and late-minute deductions, leave that preserves pay. Success is a number the owner trusts without re-checking by hand, captured with the fewest taps, and durably saved to their account.

## Brand Personality

Calm, trustworthy, precise. Three words: **dependable, quiet, exact.** The numbers are the hero; the chrome stays out of the way. Tone is matter-of-fact and reassuring — no celebration, no alarm, just clear state and totals you can rely on at a glance. Money math should feel settled, never surprising.

## Anti-references

- **Corporate enterprise HR (SAP / Workday payroll).** No heavy, dense, permission-laden enterprise dashboard feel. This is one person's tool, not an org's system.
- **Generic Material clone.** Currently leans on default Google Material colors (#1a73e8 blue, stock green/red/yellow). It should not read as an unstyled Material demo — the palette and details need an intentional point of view.

## Design Principles

1. **The number is the hero.** Totals and per-day money are the most legible thing on screen. Chrome, labels, and navigation recede so the figures lead.
2. **Trust through clarity.** Every deduction, allowance, and OT line is traceable to a visible cause. No magic numbers; the breakdown is always reachable.
3. **Fewest taps to log a day.** This is touch-first, used briefly. Common entries (worked, OT presets, leave) are one or two large taps away.
4. **Quiet by default, precise on demand.** Calm surface for scanning; detail and edit affordances appear when the user reaches for them.
5. **Settled, not loud.** No celebratory or alarming states for routine money. Motion and color are restrained and purposeful.

## Accessibility & Inclusion

- **WCAG AA baseline** for all text and interactive contrast, in both light and dark themes.
- **Strong contrast prioritized** — the app is read on a phone in varied ambient light; body text and especially the muted/gray labels and the badge colors must stay comfortably legible (avoid washed-out gray-on-tint).
- **Large tap targets** — touch-first; calendar day cells, modal controls, and presets sized for comfortable thumb use on mobile.
- **Reduced motion** — honor `prefers-reduced-motion` for any transitions added going forward.
