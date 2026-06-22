// ── PRE-PAINT THEME (dark mode + accent colour) ──────────────────────────────
// Loaded in <head> BEFORE the stylesheet so the dark class and the chosen accent
// are applied before first paint (no flash). Everything here is global and reused
// by config.js / settings.js (classic scripts share one scope).

// Accent presets shown as swatches in Settings. `color` is the light-mode --blue.
// The default "teal" needs no CSS block (it's the base :root palette).
const ACCENT_PRESETS = [
  { id: 'teal',   label: 'Teal',   color: '#007985' },
  { id: 'ocean',  label: 'Ocean',  color: '#1f6feb' },
  { id: 'indigo', label: 'Indigo', color: '#5b51d8' },
  { id: 'forest', label: 'Forest', color: '#1f8a4c' },
  { id: 'plum',   label: 'Plum',   color: '#b03a8e' },
  { id: 'sunset', label: 'Sunset', color: '#d05a1e' },
];

// The brand/accent CSS variables a preset/custom colour controls.
// (Note: --sat-worked-bg is deliberately NOT here — Saturday keeps its blue regardless of accent.)
const ACCENT_VARS = ['--blue', '--blue-lt', '--on-accent', '--grad-1', '--grad-2'];

// ── colour maths (pure) ──
function hexToRgb(h) {
  h = String(h).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  const f = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
// mix `hex` toward `target` by ratio (0 = hex, 1 = target)
function mix(hex, target, ratio) {
  const a = hexToRgb(hex), b = hexToRgb(target);
  return rgbToHex(a.r + (b.r - a.r) * ratio, a.g + (b.g - a.g) * ratio, a.b + (b.b - a.b) * ratio);
}
// WCAG relative luminance, used to pick black-or-white text over a colour
function relLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function onColor(hex) { return relLuminance(hex) > 0.45 ? '#04191f' : '#ffffff'; }

// Derive the full accent group from a single chosen hex, separately per mode.
// (Presets are hand-authored in CSS; this is only for the free custom colour.)
function deriveAccent(hex, dark) {
  if (dark) {
    const blue = mix(hex, '#ffffff', 0.30); // brighten the accent for the dark background
    return {
      '--blue': blue,
      '--blue-lt': mix(hex, '#0b1115', 0.80),
      '--on-accent': onColor(blue),
      '--grad-1': mix(hex, '#000000', 0.40),
      '--grad-2': mix(hex, '#000000', 0.58),
    };
  }
  return {
    '--blue': hex,
    '--blue-lt': mix(hex, '#ffffff', 0.88),
    '--on-accent': onColor(hex),
    '--grad-1': hex,
    '--grad-2': mix(hex, '#000000', 0.28),
  };
}

// Apply an accent setting: a preset id, '' / 'teal' for the default, or '#rrggbb'.
// Presets use the data-accent attribute (CSS cascade handles light/dark on its own);
// a custom hex must set inline vars derived for the *current* mode, so toggleDark()
// re-calls this (inline vars otherwise freeze across the dark toggle).
function applyAccent(setting, dark) {
  const root = document.documentElement;
  setting = String(setting || '').trim();
  if (setting.charAt(0) === '#') {
    const vars = deriveAccent(setting, !!dark);
    ACCENT_VARS.forEach(v => root.style.setProperty(v, vars[v]));
    root.setAttribute('data-accent', 'custom');
  } else {
    ACCENT_VARS.forEach(v => root.style.removeProperty(v));
    if (setting && setting !== 'teal') root.setAttribute('data-accent', setting);
    else root.removeAttribute('data-accent');
  }
}

// Pre-paint application from localStorage (synchronous, before the stylesheet).
(function () {
  const dark = localStorage.getItem('theme') === 'dark';
  if (dark) document.documentElement.classList.add('dark');
  applyAccent(localStorage.getItem('accent') || '', dark);
})();
