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

/*
 * Replays a CSS animation class on an element.
 * Reduced-motion is handled in CSS (components.css), where the heavy effects
 * (scale pop, sparkles, label pop) are removed but a gentle glow still plays.
 * The class is removed by a timer instead of "animationend", because
 * animationend also fires for child elements and pseudo-elements and could
 * end the animation too early.
 */
export function triggerAnim(el, cls, ms = 1300) {
  if (!el) return;
  clearTimeout(animTimers.get(el));
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add(cls);
  animTimers.set(el, setTimeout(() => el.classList.remove(cls), ms));
}