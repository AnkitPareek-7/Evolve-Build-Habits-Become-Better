/* Undo toast & congratulatory animation trigger */
import { $ } from './config.js';

let undoAction = null;
let toastTimer = null;
const animTimers = new WeakMap();

export function hideToast() {
  clearTimeout(toastTimer);
  undoAction = null;
  $('toast').hidden = true;
}

export function showUndo(message, undo) {
  undoAction = undo;
  $('toastText').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 8000);
}

$('toastUndo').addEventListener('click', () => {
  const undo = undoAction;
  hideToast();
  if (undo) undo();
});

export function triggerAnim(el, cls) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  clearTimeout(animTimers.get(el));
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const done = () => {
    clearTimeout(animTimers.get(el));
    el.classList.remove(cls);
  };
  el.addEventListener('animationend', (e) => { if (e.target === el) done(); }, { once: true });
  animTimers.set(el, setTimeout(done, 950));
}