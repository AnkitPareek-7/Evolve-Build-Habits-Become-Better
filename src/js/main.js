/* Application entry point: init modules, midnight rollover & multi-tab sync */
import { STORAGE_KEY, TARGET_KEY, THEME_KEY, TODO_KEY, todayDate } from './config.js';
import { initThemeSwitch, syncThemeFromStorage } from './theme.js';
import { hideToast } from './effects.js';
import { initHabits, onHabitsDayRollover, renderHabits, syncHabitsFromStorage } from './habits.js';
import { initTodos, onTodosDayRollover, renderTodos, syncTodosFromStorage } from './todos.js';

initThemeSwitch(() => {
  renderHabits();
  renderTodos();
});
initHabits();
initTodos();

let lastToday = todayDate();
function checkNewDay() {
  const today = todayDate();
  if (today.getTime() === lastToday.getTime()) return;
  const dayDelta = Math.round((today - lastToday) / 864e5);
  const monthDelta = (today.getFullYear() - lastToday.getFullYear()) * 12 + today.getMonth() - lastToday.getMonth();
  lastToday = today;
  onHabitsDayRollover(today, monthDelta);
  onTodosDayRollover(dayDelta);
}

setInterval(checkNewDay, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
window.addEventListener('focus', checkNewDay);

window.addEventListener('storage', (e) => {
  if (e.key !== null && ![STORAGE_KEY, TARGET_KEY, TODO_KEY, THEME_KEY].includes(e.key)) return;
  hideToast();
  syncThemeFromStorage();
  syncHabitsFromStorage();
  syncTodosFromStorage();
});