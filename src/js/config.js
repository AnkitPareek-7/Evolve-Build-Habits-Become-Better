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

export const $ = (id) => document.getElementById(id);
export const pad = (n) => String(n).padStart(2, '0');
export const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const pct = (n, total) => (n / total) * 100;
export const fmt = (v) => +v.toFixed(1) + '%';
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
export const todayDate = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

export function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

export function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

export function readJSON(key, isValid, fallback) {
  const raw = lsGet(key);
  if (raw === null) return fallback();
  try {
    const data = JSON.parse(raw);
    if (isValid(data)) return data;
  } catch (e) {}
  lsSet(key + '.backup', raw);
  return fallback();
}