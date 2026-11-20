/* EVOLVE – habit tracker
   A habit is saved as: { id, name, color, goal (times a week, 1-7), start: "YYYY-MM-DD", done: { "YYYY-MM-DD": true } } */

const STORAGE_KEY = 'evolve.v1';
const TARGET_KEY = 'evolve.target';
const TODO_KEY = 'evolve.todos';
const THEME_KEY = 'evolve.theme';

// Themes in the switch. Key = value of :root[data-theme="…"] in style.css, dot = the colour of its small circle.
// To add a theme: add a line here, a [data-theme] block in style.css and (optionally) a palette below.
const THEMES = {
  default: { label: 'Default', dot: '#00ffc8' },
  light: { label: 'Light', dot: '#00B4D8' },
  purple: { label: 'Purple', dot: '#C77DFF' }
};

// A theme listed here colours habits and tasks by position from its own palette (it repeats after the last colour).
// A theme not listed (Default) keeps each habit's saved colour.
const THEME_PALETTES = {
  light: ['#CAF0F8', '#90E0EF', '#00B4D8', '#0077B6', '#03045E'],
  purple: ['#F3D9FF', '#E0AAFF', '#C77DFF', '#9D4EDD', '#FF9EDC']
};

// Every habit gets the next unused colour from this list (edit freely)
const COLORS = ['#00ffc8', '#03e7f7', '#b4ff00', '#62ff00', '#dcf905'];

const NAME_MAX = 30;       // same limit as the Add field
const TARGET_DEFAULT = 21;
const TARGET_MAX = 365;    // same as the target input's max
const TODO_MAX = 50;       // max characters per task (same as input maxlength)

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (n, total) => (n / total) * 100;
const fmt = (v) => +v.toFixed(1) + '%';                 // 71.4285 -> "71.4%"
const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Today at midnight (a Date)
const todayDate = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

/* ---------- Safe storage ---------- */
// Reading or writing localStorage can throw (blocked storage, full storage), so every access is wrapped.
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage blocked or full: keep running without saving */ }
}

// Read saved JSON. If it is missing, broken or the wrong shape, use fallback().
// Damaged text is copied to "<key>.backup" first, so it is not lost when the next save overwrites it.
function readJSON(key, isValid, fallback) {
  const raw = lsGet(key);
  if (raw === null) return fallback();
  try {
    const data = JSON.parse(raw);
    if (isValid(data)) return data;
  } catch (e) { /* broken JSON: handled below */ }
  lsSet(key + '.backup', raw);
  return fallback();
}

/* ---------- Theme ---------- */
function loadTheme() {
  const t = lsGet(THEME_KEY);
  return t && Object.prototype.hasOwnProperty.call(THEMES, t) ? t : 'default';
}

let theme = loadTheme();

// Colour to show for a habit or task: the theme's palette colour by position, or the saved colour
const colorFor = (saved, index) => {
  const palette = THEME_PALETTES[theme];
  return palette ? palette[index % palette.length] : saved;
};

// Put the theme on the page and move the switch to it
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  $('themeSwitch').style.setProperty('--i', Object.keys(THEMES).indexOf(theme));
  document.querySelectorAll('#themeSwitch .theme-opt').forEach((btn) => {
    const on = btn.dataset.themeId === theme;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-checked', on);
    btn.tabIndex = on ? 0 : -1;               // only the active button is a tab stop; arrow keys move between them
  });
}

// Which month is on screen: 0 = this month, -1 = last month, 1 = next month ...
let viewOffset = 0;

// Calendar info for the month on screen:
//   d = first day of that month (a Date), y = year, m = month (0-11), n = days in that month
//   t = last day of the month that can be ticked (today's date in the current month,
//       n in a past month, 0 in a future month)
//   today = today's day number if this is the current month, otherwise 0
//   end = the Date up to which "Consistency" is measured (today, or the month's last day if earlier)
function calendar() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + viewOffset, 1);
  const y = d.getFullYear(), m = d.getMonth();
  const n = new Date(y, m + 1, 0).getDate();
  const current = viewOffset === 0;
  const t = viewOffset < 0 ? n : current ? now.getDate() : 0;
  const today = current ? now.getDate() : 0;
  const monthEnd = new Date(y, m, n);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = monthEnd < todayStart ? monthEnd : todayStart;
  return { d, y, m, t, n, today, end };
}
const dayKey = (c, day) => `${c.y}-${pad(c.m + 1)}-${pad(day)}`;

/* ---------- Data ---------- */
function makeHabit(name, color, goal = 7) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, color, goal, start: keyOf(new Date()), done: {} };
}

// A saved habit list is only used if every habit has the expected fields
const isHabit = (h) => !!h && typeof h.id === 'string' && typeof h.name === 'string' && typeof h.color === 'string' &&
  typeof h.start === 'string' && !!h.done && typeof h.done === 'object' && !Array.isArray(h.done);
const isHabits = (d) => Array.isArray(d) && d.every(isHabit);

// Default habits renamed to Habit 1, Habit 2, Habit 3
const defaultHabits = () => ['Habit 1', 'Habit 2', 'Habit 3'].map((name, i) => makeHabit(name, COLORS[i]));
// Times per week a habit should be done: 1 to 7 (7 = every day). Habits saved before this option count as every day.
const normGoal = (g) => (Number.isInteger(g) && g >= 1 && g <= 7 ? g : 7);
const goalLabel = (g) => (g === 7 ? 'Every day (regular)' : `${g}\u00d7 a week`);
const loadHabits = () => readJSON(STORAGE_KEY, isHabits, defaultHabits).map((h) => ({ ...h, goal: normGoal(h.goal) }));

let habits = loadHabits();

// Frequency choices in the Add form and in the Edit dialog
['goalInput', 'dialogGoal'].forEach((id) => {
  $(id).innerHTML = [1, 2, 3, 4, 5, 6, 7].map((g) => `<option value="${g}">${goalLabel(g)}</option>`).join('');
});
$('goalInput').value = 7;

// The habits as drawn on screen (colour depends on the theme). Saved data is never changed by this.
const shownHabits = () => habits.map((h, i) => ({ ...h, color: colorFor(h.color, i) }));

const save = () => lsSet(STORAGE_KEY, JSON.stringify(habits));

/* ---------- Target (saved) ---------- */
const clampTarget = (v) => Math.min(TARGET_MAX, Math.max(1, v));

function loadTarget() {
  const v = parseInt(lsGet(TARGET_KEY), 10);
  return isNaN(v) ? TARGET_DEFAULT : clampTarget(v);
}

let targetDays = loadTarget();
$('targetInput').value = targetDays;

/* ---------- Month grid ---------- */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function renderGrid(c) {
  const days = Array.from({ length: c.n }, (_, i) => i + 1);
  const weeks = Math.ceil(c.n / 7);
  const wstart = (d) => (d % 7 === 1 ? 'wstart' : '');   // first day of each week

  // Heading row: only the "Habits" label
  let html = '<tr>';
  html += '<th class="sub-heading">Habits</th>';
  html += '</tr>';

  // Row 1: week names
  html += '<tr><th></th>';
  for (let w = 0; w < weeks; w++) html += `<th class="wk wstart" colspan="${Math.min(7, c.n - w * 7)}">Week ${w + 1}</th>`;
  html += '</tr>';

  // Row 2: day numbers (first cell left empty)
  html += '<tr><th></th>' + days.map((d) => {
    const name = DAY_NAMES[new Date(c.y, c.m, d).getDay()];     // real weekday of this date
    return `<th class="${wstart(d)} ${d === c.today ? 'today' : ''}" title="${name}" aria-label="${name} ${d}">` +
      `<span class="dn">${d}</span><span class="dw" aria-hidden="true">${name[0]}</span></th>`;
  }).join('') + '</tr>';

  // One row per habit
  html += shownHabits().map((h) =>
    `<tr style="--c:${h.color}">
       <td class="name"><span class="tag">${esc(h.name)}</span>${h.goal < 7 ? `<span class="goal">${h.goal}\u00d7 / week</span>` : ''}</td>` +
    days.map((d) => {
      const key = dayKey(c, d);
      return `<td class="${wstart(d)}"><input type="checkbox" class="check" data-id="${h.id}" data-key="${key}"
                ${h.done[key] ? 'checked' : ''} ${d > c.t ? 'disabled' : ''} aria-label="${esc(h.name)} ${key}"></td>`;
    }).join('') + '</tr>'
  ).join('');

  $('grid').innerHTML = html;
  $('monthLabel').textContent = c.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/* ---------- Bar graphs ---------- */
// groups = [{ label, bars: [{ v: percent, c: colour, t: tooltip }] }]
function drawChart(id, groups) {
  $(id).innerHTML = groups.map((g) =>
    `<div class="group"><div class="bars">` +
    g.bars.map((b) => `<div class="bar" style="height:${b.v}%;background:${b.c}" title="${esc(b.t)}"><span>${fmt(b.v)}</span></div>`).join('') +
    `</div><label>${esc(g.label)}</label></div>`
  ).join('');
}

function renderCharts(c) {
  const hs = shownHabits();
  const bar = (h, v, note) => ({ v, c: h.color, t: note ? `${h.name}: ${note} (${fmt(v)})` : `${h.name}: ${fmt(v)}` });
  const count = (h, from, to) => { let n = 0; for (let d = from; d <= to; d++) if (h.done[dayKey(c, d)]) n++; return n; };

  // A week's goal: the habit's times per week; the last week of a month can be shorter, so its goal is prorated (minimum 1)
  const weekGoal = (h, len) => (len >= 7 ? h.goal : Math.max(1, Math.round((h.goal * len) / 7)));
  const spans = Array.from({ length: Math.ceil(c.n / 7) }, (_, w) => ({ from: w * 7 + 1, to: Math.min(w * 7 + 7, c.n) }));
  const stat = (h, s) => ({ t: count(h, s.from, s.to), g: weekGoal(h, s.to - s.from + 1) });

  // Weekly: ticks in the week out of the habit's weekly goal (capped at 100%)
  const weekly = spans.map((s, w) => ({
    label: `Week ${w + 1}`,
    bars: hs.map((h) => { const k = stat(h, s); return bar(h, Math.min(100, pct(k.t, k.g)), `${k.t} of ${k.g}`); })
  }));

  // Monthly: the capped weekly ticks added up, out of the added-up weekly goals (so it agrees with the weekly graph)
  const monthly = hs.map((h) => {
    let got = 0, need = 0;
    spans.forEach((s) => { const k = stat(h, s); got += Math.min(k.t, k.g); need += k.g; });
    return { label: h.name, bars: [bar(h, pct(got, need), `${got} of ${need}`)] };
  });

  // Consistency: ticks out of the ticks expected since the habit was started (goal x days / 7), up to today
  // (or up to the end of the month on screen when that month is in the past)
  const endKey = keyOf(c.end);
  const consistency = hs.map((h) => {
    const daysUsed = Math.round((c.end - new Date(h.start + 'T00:00')) / 864e5) + 1;
    const ticks = Object.keys(h.done).filter((k) => k <= endKey).length;
    const expected = (h.goal * daysUsed) / 7;
    const v = daysUsed > 0 ? Math.min(100, pct(ticks, expected)) : 0;
    return { label: h.name, bars: [bar(h, v, daysUsed > 0 ? `${ticks} of ${+expected.toFixed(1)}` : '')] };
  });

  $('legend').innerHTML = hs.map((h) => `<span><i style="background:${h.color}"></i>${esc(h.name)}</span>`).join('');
  drawChart('weekly', weekly);
  drawChart('monthly', monthly);
  drawChart('consistency', consistency);
}

/* ---------- Target Streak graph ---------- */
// Current streak: consecutive ticked days counting back from today, across months.
// If today is not ticked yet, counting starts from yesterday, so the streak is not lost before the day ends.
function streakOf(h) {
  const d = todayDate();
  if (!h.done[keyOf(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (h.done[keyOf(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Bar = streak out of the target (capped at 100%). It always shows the streak as of today, whatever month is on screen.
function renderTargetStreak() {
  const targetData = shownHabits().map((h) => {
    const streak = streakOf(h);
    const progress = pct(streak, targetDays);
    return {
      label: h.name,
      bars: [{ v: Math.min(progress, 100), c: h.color, t: `${h.name}: ${streak} of ${targetDays} days (${fmt(progress)})` }]
    };
  });

  drawChart('targetStreak', targetData);
}

function render() {
  const c = calendar();
  renderGrid(c);
  renderCharts(c);
  renderTargetStreak();
}

/* ---------- Actions ---------- */
// Previous / next month
$('prevBtn').addEventListener('click', () => { viewOffset--; render(); });
$('nextBtn').addEventListener('click', () => { viewOffset++; render(); });

// Tick / untick a day
$('grid').addEventListener('change', (e) => {
  const { id, key } = e.target.dataset;
  const h = habits.find((x) => x.id === id);
  if (!h) return;
  if (e.target.checked) {
    h.done[key] = true;
    if (key < h.start) h.start = key;       // ticking an earlier day moves the start date back
  } else {
    delete h.done[key];
  }
  save();
  render();
});

// Add a habit
$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('habitInput').value.trim();
  if (!name) return;
  const color = COLORS.find((c) => !habits.some((h) => h.color === c)) || COLORS[habits.length % COLORS.length];
  habits.push(makeHabit(name, color, normGoal(parseInt($('goalInput').value, 10))));
  $('habitInput').value = '';
  save();
  render();
});

/* ---------- Undo toast ---------- */
let undoAction = null;
let toastTimer = null;

function hideToast() {
  clearTimeout(toastTimer);
  undoAction = null;
  $('toast').hidden = true;
}

// Show "<message> Undo" for 8 seconds. Only the latest action can be undone.
function showUndo(message, undo) {
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

/* ---------- Rename / Delete dialog ---------- */
const dialog = $('habitDialog');
let dialogMode = 'rename';   // 'rename' or 'delete'
let dialogPick = 0;          // index of the habit selected in the dialog

function renderDialogList() {
  $('dialogList').innerHTML = '<legend class="sr-only">Choose a habit</legend>' + shownHabits().map((h, i) =>
    `<label class="dialog-row">
       <input type="radio" name="dialogHabit" value="${i}" ${i === dialogPick ? 'checked' : ''}>
       <span class="dialog-swatch" style="--c:${h.color}"></span>
       <span class="dialog-habit">${esc(h.name)}</span>
     </label>`
  ).join('');
  $('dialogName').value = habits[dialogPick] ? habits[dialogPick].name : '';
  $('dialogGoal').value = habits[dialogPick] ? habits[dialogPick].goal : 7;
}

function openDialog(mode) {
  dialogMode = mode;
  dialogPick = 0;
  const rename = mode === 'rename';
  const empty = habits.length === 0;
  $('dialogTitle').textContent = rename ? 'Edit a habit' : 'Delete a habit';
  $('dialogEmpty').textContent = `No habits to ${rename ? 'edit' : 'delete'}.`;
  $('dialogEmpty').hidden = !empty;
  $('dialogList').hidden = empty;
  $('dialogNameWrap').hidden = empty || !rename;
  $('dialogGoalWrap').hidden = empty || !rename;
  $('dialogName').required = rename;
  $('dialogOk').hidden = empty;
  $('dialogOk').textContent = rename ? 'Save' : 'Delete';
  $('dialogOk').classList.toggle('danger', !rename);
  renderDialogList();
  dialog.showModal();
  if (!empty && rename) { $('dialogName').focus(); $('dialogName').select(); }
}

$('renameBtn').addEventListener('click', () => openDialog('rename'));
$('deleteBtn').addEventListener('click', () => openDialog('delete'));
$('dialogCancel').addEventListener('click', () => dialog.close());

// Click on the dimmed area outside the box closes the dialog
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

// Choosing a habit: the name box follows the choice
$('dialogList').addEventListener('change', (e) => {
  dialogPick = parseInt(e.target.value, 10);
  $('dialogName').value = habits[dialogPick] ? habits[dialogPick].name : '';
  $('dialogGoal').value = habits[dialogPick] ? habits[dialogPick].goal : 7;
});

// Enter on a radio button must not submit (it would delete straight away in Delete mode)
$('dialogList').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

$('dialogForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const index = dialogPick;
  const habit = habits[index];
  if (!habit) { dialog.close(); return; }

  if (dialogMode === 'rename') {
    const name = $('dialogName').value.trim().slice(0, NAME_MAX).trim();
    if (!name) { $('dialogName').focus(); return; }
    habit.name = name;
    habit.goal = normGoal(parseInt($('dialogGoal').value, 10));
    save();
    render();
    dialog.close();
    return;
  }

  // Delete: remove now, and offer Undo (the habit comes back in the same place with all its ticks)
  habits.splice(index, 1);
  save();
  render();
  dialog.close();
  showUndo(`Deleted "${habit.name}"`, () => {
    habits.splice(Math.min(index, habits.length), 0, habit);
    save();
    render();
  });
});

// Target Streak: Go button
$('targetGoBtn').addEventListener('click', () => {
  const val = parseInt($('targetInput').value, 10);
  if (isNaN(val) || val < 1) {
    alert('Please enter a valid target (1 or more days).');
    return;
  }
  targetDays = clampTarget(val);          // anything above 365 becomes 365
  $('targetInput').value = targetDays;
  lsSet(TARGET_KEY, targetDays);
  renderTargetStreak();
});

/* ---------- Daily To-Do List (one list per date) ---------- */
// Saved as: { "YYYY-MM-DD": [ { id, text, color, done: boolean } ] }
// An older version saved one single list; it is moved to today's date the first time it is loaded.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isTask = (t) => !!t && typeof t.id === 'string' && typeof t.text === 'string' &&
  typeof t.color === 'string' && typeof t.done === 'boolean';
const isTaskList = (a) => Array.isArray(a) && a.every(isTask);
const isTodoStore = (d) => isTaskList(d) ||
  (!!d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).every((k) => DATE_RE.test(k) && isTaskList(d[k])));

function loadTodos() {
  const data = readJSON(TODO_KEY, isTodoStore, () => ({}));
  if (Array.isArray(data)) {                       // old format: a single list
    const store = data.length ? { [keyOf(new Date())]: data } : {};
    lsSet(TODO_KEY, JSON.stringify(store));        // save right away so it keeps the date it was moved to
    return store;
  }
  return data;
}

let todos = loadTodos();

// Which day's list is on screen: 0 = today, -1 = yesterday ...
let todoOffset = 0;

const viewedDate = () => { const t = todayDate(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() + todoOffset); };

const dayTasks = () => todos[keyOf(viewedDate())] || [];

function saveTodos() {
  lsSet(TODO_KEY, JSON.stringify(todos));
}

// Replace the list of the day on screen (an empty list removes that day from storage)
function setDayTasks(list) {
  const key = keyOf(viewedDate());
  if (list.length) todos[key] = list; else delete todos[key];
  saveTodos();
}

function renderTodos() {
  const list = $('todoList');
  const progress = $('todoProgress');
  const tasks = dayTasks();
  const isToday = todoOffset === 0;

  // Date label and Next button (cannot go past today)
  $('todoDateLabel').textContent = viewedDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
    (isToday ? ' (Today)' : '');
  $('todoNextBtn').disabled = isToday;

  if (tasks.length === 0) {
    list.innerHTML = '';
    progress.innerHTML = `<p class="todo-progress-info">${isToday ? 'No tasks yet. Add one above.' : 'No tasks on this day.'}</p>`;
    return;
  }

  // Render each task
  list.innerHTML = tasks.map((t, i) =>
    `<li class="todo-item" style="--tc:${colorFor(t.color, i)}">
       <input type="checkbox" class="todo-check" data-todo="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark ${esc(t.text)}">
       <span class="todo-text ${t.done ? 'done' : ''}">${esc(t.text)}</span>
       <button class="todo-delete" data-remove-todo="${t.id}" aria-label="Remove task: ${esc(t.text)}">Remove</button>
     </li>`
  ).join('');

  // Progress bar
  const doneCount = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const percent = Math.round((doneCount / total) * 100);

  progress.innerHTML =
    `<p class="todo-progress-info">${doneCount} of ${total} completed (${percent}%)</p>
     <div class="todo-bar-track">
       <div class="todo-bar-fill" style="width:${percent}%"></div>
     </div>`;
}

// Previous / next day
$('todoPrevBtn').addEventListener('click', () => { todoOffset--; renderTodos(); });
$('todoNextBtn').addEventListener('click', () => { if (todoOffset < 0) { todoOffset++; renderTodos(); } });

// Add a task
$('todoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('todoInput').value.trim();
  if (!text) return;

  const tasks = dayTasks().slice();

  // Pick the next color from COLORS, cycling through
  const color = COLORS[tasks.length % COLORS.length];

  tasks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    text: text.slice(0, TODO_MAX),
    color,
    done: false
  });

  $('todoInput').value = '';
  setDayTasks(tasks);
  renderTodos();
});

// Toggle a task done/undone
$('todoList').addEventListener('change', (e) => {
  if (!e.target.dataset.todo) return;
  const todo = dayTasks().find((t) => t.id === e.target.dataset.todo);
  if (!todo) return;
  todo.done = e.target.checked;
  saveTodos();
  renderTodos();
});

// Remove a task
$('todoList').addEventListener('click', (e) => {
  const id = e.target.dataset.removeTodo;
  if (!id) return;
  const key = keyOf(viewedDate());
  const tasks = dayTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return;
  const removed = tasks[index];
  setDayTasks(tasks.filter((t) => t.id !== id));
  renderTodos();
  showUndo(`Removed task "${removed.text}"`, () => {
    const list = (todos[key] || []).slice();
    list.splice(Math.min(index, list.length), 0, removed);
    todos[key] = list;
    saveTodos();
    renderTodos();
  });
});

/* ---------- Midnight rollover (one timer for the habit grid and the to-do list) ---------- */
let lastToday = todayDate();

function checkNewDay() {
  const today = todayDate();
  if (today.getTime() === lastToday.getTime()) return;

  // Keep a past day or month on screen, so only the offsets change, not what is shown
  const dayDelta = Math.round((today - lastToday) / 864e5);
  const monthDelta = (today.getFullYear() - lastToday.getFullYear()) * 12 + today.getMonth() - lastToday.getMonth();
  lastToday = today;
  if (todoOffset !== 0) todoOffset -= dayDelta;
  if (viewOffset !== 0) viewOffset -= monthDelta;

  render();        // habit grid: moves the "today" highlight and unlocks the new day's boxes
  renderTodos();   // to-do list: the new day starts with its own list
}

setInterval(checkNewDay, 30 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
window.addEventListener('focus', checkNewDay);

/* ---------- Theme switch (segmented buttons) ---------- */
const themeKeys = Object.keys(THEMES);
$('themeSwitch').style.setProperty('--n', themeKeys.length);
$('themeSwitch').innerHTML = '<span class="theme-pill" aria-hidden="true"></span>' + themeKeys.map((k) =>
  `<button type="button" class="theme-opt" role="radio" aria-checked="false" tabindex="-1" data-theme-id="${k}">` +
  `<i class="theme-dot" style="--dot:${THEMES[k].dot}"></i>${esc(THEMES[k].label)}</button>`
).join('');

function setTheme(name) {
  if (!Object.prototype.hasOwnProperty.call(THEMES, name) || name === theme) return;
  theme = name;
  lsSet(THEME_KEY, theme);
  applyTheme();
  render();          // habit colours depend on the theme
  renderTodos();
}

$('themeSwitch').addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-opt');
  if (btn) setTheme(btn.dataset.themeId);
});

// Arrow keys move to the previous / next theme (like a radio group), Home / End jump to the first / last
$('themeSwitch').addEventListener('keydown', (e) => {
  const i = themeKeys.indexOf(theme);
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % themeKeys.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + themeKeys.length) % themeKeys.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = themeKeys.length - 1;
  if (next < 0) return;
  e.preventDefault();
  setTheme(themeKeys[next]);
  $('themeSwitch').querySelector(`[data-theme-id="${themeKeys[next]}"]`).focus();
});

// Keep two open tabs in sync
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== STORAGE_KEY && e.key !== TARGET_KEY && e.key !== TODO_KEY && e.key !== THEME_KEY) return;
  habits = loadHabits();
  targetDays = loadTarget();
  todos = loadTodos();
  theme = loadTheme();
  $('targetInput').value = targetDays;
  hideToast();
  if (dialog.open) dialog.close();
  applyTheme();
  render();
  renderTodos();
});

applyTheme();
render();
renderTodos();
// Turn the slide animation on only after the first position is set, so the pill does not slide on page load
requestAnimationFrame(() => $('themeSwitch').classList.add('ready'));