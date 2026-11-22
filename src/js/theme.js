/* Theme management (Zestia & Azura) */
import { $, THEMES, THEME_PALETTES, THEME_KEY, esc, hasOwn, lsGet, lsSet } from './config.js';

const loadTheme = () => {
  const t = lsGet(THEME_KEY);
  return t === 'light' ? 'azura' : t && hasOwn(THEMES, t) ? t : 'zestia';
};

let theme = loadTheme();

export const paletteFor = (saved, index) => {
  const palette = THEME_PALETTES[theme];
  return palette ? palette[index % palette.length] : { color: saved, grad: saved };
};

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  $('themeSwitch').style.setProperty('--i', Object.keys(THEMES).indexOf(theme));
  document.querySelectorAll('#themeSwitch .theme-opt').forEach((btn) => {
    const on = btn.dataset.themeId === theme;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-checked', on);
    btn.tabIndex = on ? 0 : -1;
  });
}

export function syncThemeFromStorage() {
  theme = loadTheme();
  applyTheme();
}

export function initThemeSwitch(onChange) {
  const keys = Object.keys(THEMES);
  const sw = $('themeSwitch');
  sw.style.setProperty('--n', keys.length);
  sw.innerHTML = '<span class="theme-pill" aria-hidden="true"></span>' + keys.map((k) =>
    `<button type="button" class="theme-opt" role="radio" aria-checked="false" tabindex="-1" data-theme-id="${k}"><i class="theme-dot" style="--dot:${THEMES[k].dot}"></i>${esc(THEMES[k].label)}</button>`
  ).join('');

  const setTheme = (name) => {
    if (!hasOwn(THEMES, name) || name === theme) return;
    theme = name;
    lsSet(THEME_KEY, theme);
    applyTheme();
    onChange();
  };

  sw.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-opt');
    if (btn) setTheme(btn.dataset.themeId);
  });

  sw.addEventListener('keydown', (e) => {
    const i = keys.indexOf(theme);
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const next = delta ? (i + delta + keys.length) % keys.length : e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTheme(keys[next]);
    sw.querySelector(`[data-theme-id="${keys[next]}"]`).focus();
  });

  applyTheme();
  requestAnimationFrame(() => sw.classList.add('ready'));
}