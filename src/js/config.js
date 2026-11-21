/* Shared constants, formatting and safe localStorage helpers */
export const STORAGE_KEY = 'evolve.v1';
export const TARGET_KEY = 'evolve.target';
export const TODO_KEY = 'evolve.todos';
export const THEME_KEY = 'evolve.theme';

export const THEMES = {
  zestia: { label: 'Zestia', dot: '#00ffc8' },
  azura: { label: 'Azura', dot: '#00B4D8' },
  galaxia: { label: 'Galaxia', dot: 'linear-gradient(135deg, #ffe2c6, #c471ed, #6366f1)' }
};

/*Theme Palettes */

export const THEME_PALETTES = {
  azura: [
    { color: '#CAF0F8', grad: '#CAF0F8' },
    { color: '#90E0EF', grad: '#90E0EF' },
    { color: '#00B4D8', grad: '#00B4D8' },
    { color: '#0077B6', grad: '#0077B6' },
    { color: '#03045E', grad: '#03045E' }
  ],
  galaxia: [
    { color: '#f7b9c4', grad: 'linear-gradient(135deg, #ffe2c6, #f3a6b8)' },
    { color: '#de8dd2', grad: 'linear-gradient(135deg, #f3a6b8, #c471ed)' },
    { color: '#a45ee2', grad: 'linear-gradient(135deg, #c471ed, #7b4ad2)' },
    { color: '#7c6df0', grad: 'linear-gradient(135deg, #8b5cf6, #4338ca)' },
    { color: '#c99eff', grad: 'linear-gradient(135deg, #ffd6e0, #9d6bff)' }
  ]
};

export const COLORS = ['#00ffc8', '#03e7f7', '#b4ff00', '#62ff00', '#dcf905'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

export function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
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