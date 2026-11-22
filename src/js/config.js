/* Shared constants, formatting and safe localStorage helpers */
export const STORAGE_KEY = 'evolve.v1';
export const TARGET_KEY = 'evolve.target';
export const TODO_KEY = 'evolve.todos';
export const THEME_KEY = 'evolve.theme';
export const TRACK_KEY = 'evolve.trackStart';

export const THEMES = {
  zestia: { label: 'Zestia', dot: '#00ffc8' },
  azura: { label: 'Azura', dot: '#00B4D8' }
};

/*Theme Palettes */

export const THEME_PALETTES = {
  azura: [
    { color: '#CAF0F8', grad: '#CAF0F8' },
    { color: '#90E0EF', grad: '#90E0EF' },
    { color: '#00B4D8', grad: '#00B4D8' },
    { color: '#0077B6', grad: '#0077B6' },
    { color: '#03045E', grad: '#03045E' }
  ]
};

export const COLORS = ['#00ffc8', '#03e7f7', '#b4ff00', '#62ff00', '#dcf905'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Week as shown in the day picker: Monday first. "d" is the JavaScript weekday number (Sunday = 0). */
export const WEEK = [
  { d: 1, l: 'M', n: 'Monday' }, { d: 2, l: 'T', n: 'Tuesday' }, { d: 3, l: 'W', n: 'Wednesday' },
  { d: 4, l: 'T', n: 'Thursday' }, { d: 5, l: 'F', n: 'Friday' }, { d: 6, l: 'S', n: 'Saturday' },
  { d: 0, l: 'S', n: 'Sunday' }
];
export const WEEK_ORDER = WEEK.map((w) => w.d);
/* Suggested weekdays when the user picks "N days a week" */
export const DEFAULT_DAYS = {
  1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 0]
};

export const NAME_MAX = 30;
export const TARGET_DEFAULT = 21;
export const TARGET_MAX = 365;
export const TODO_MAX = 50;

/* Shapes that stored data must match. Colours and ids end up inside HTML attributes, so they are kept strict. */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const HEX_RE = /^#[0-9a-f]{3,8}$/i;
export const ID_RE = /^[\w-]{1,64}$/;

export const $ = (id) => document.getElementById(id);
export const pad = (n) => String(n).padStart(2, '0');
export const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const pct = (n, total) => (n / total) * 100;
export const fmt = (v) => +v.toFixed(1) + '%';
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
export const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const todayDate = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
/* "2026-11-22" -> local Date at midnight (never UTC, so the day can't shift) */
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
/* True for a well-formed, real calendar date such as "2026-11-22" (rejects "2026-02-31") */
export const isRealDate = (k) => typeof k === 'string' && DATE_RE.test(k) && keyOf(parseKey(k)) === k;

export function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

export function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

export function lsRemove(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

/* Keeps the last two unreadable copies (key.backup and key.backup.prev) so a second problem can't erase the first */
function backup(key, raw) {
  const prev = lsGet(key + '.backup');
  if (prev !== null && prev !== raw) lsSet(key + '.backup.prev', prev);
  lsSet(key + '.backup', raw);
}

/*
 * Reads and validates JSON from localStorage.
 *  - valid data is returned as is.
 *  - invalid data is backed up first. If a repair(data) function is given and returns something,
 *    that cleaned copy is saved and returned, so one bad entry no longer wipes everything.
 *  - otherwise (or if the JSON can't be parsed at all) fallback() is returned.
 */
export function readJSON(key, isValid, fallback, repair) {
  const raw = lsGet(key);
  if (raw === null) return fallback();
  let data, parsed = false;
  try {
    data = JSON.parse(raw);
    parsed = true;
    if (isValid(data)) return data;
  } catch (e) {}
  backup(key, raw);
  if (parsed && repair) {
    try {
      const fixed = repair(data);
      if (fixed !== null && fixed !== undefined) {
        lsSet(key, JSON.stringify(fixed));
        return fixed;
      }
    } catch (e) {}
  }
  return fallback();
}