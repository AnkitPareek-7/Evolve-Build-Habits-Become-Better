/* EVOLVE – habit tracker
   A habit is saved as: { id, name, color, start: "YYYY-MM-DD", done: { "YYYY-MM-DD": true } } */

const STORAGE_KEY = 'evolve.v1';
const TARGET_KEY = 'evolve.target';

// Every habit gets the next unused colour from this list (edit freely)
const COLORS = ['#00ffc8', '#03e7f7', '#b4ff00', '#62ff00', '#dcf905'];

const NAME_MAX = 30;       // same limit as the Add field
const TARGET_DEFAULT = 21;
const TARGET_MAX = 365;    // same as the target input's max

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (n, total) => (n / total) * 100;
const fmt = (v) => +v.toFixed(1) + '%';                 // 71.4285 -> "71.4%"
const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

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
function makeHabit(name, color) {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, color, start: keyOf(new Date()), done: {} };
}

// Default habits renamed to Habit 1, Habit 2, Habit 3
const loadHabits = () => JSON.parse(localStorage.getItem(STORAGE_KEY)) ||
  ['Habit 1', 'Habit 2', 'Habit 3'].map((name, i) => makeHabit(name, COLORS[i]));

let habits = loadHabits();

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));

/* ---------- Target (saved) ---------- */
const clampTarget = (v) => Math.min(TARGET_MAX, Math.max(1, v));

function loadTarget() {
  const v = parseInt(localStorage.getItem(TARGET_KEY), 10);
  return isNaN(v) ? TARGET_DEFAULT : clampTarget(v);
}

let targetDays = loadTarget();
$('targetInput').value = targetDays;

/* ---------- Month grid ---------- */
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
  html += '<tr><th></th>' + days.map((d) => `<th class="${wstart(d)} ${d === c.today ? 'today' : ''}">${d}</th>`).join('') + '</tr>';

  // One row per habit
  html += habits.map((h) =>
    `<tr style="--c:${h.color}">
       <td class="name"><span class="tag">${esc(h.name)}</span></td>` +
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
  const bar = (h, v) => ({ v, c: h.color, t: `${h.name}: ${fmt(v)}` });
  const count = (h, from, to) => { let n = 0; for (let d = from; d <= to; d++) if (h.done[dayKey(c, d)]) n++; return n; };

  // Weekly: ticks in the week out of 7 days (days 1-7, 8-14, ...; the last week may be shorter)
  const weekly = Array.from({ length: Math.ceil(c.n / 7) }, (_, w) => {
    const from = w * 7 + 1, to = Math.min(from + 6, c.n);
    return { label: `Week ${w + 1}`, bars: habits.map((h) => bar(h, pct(count(h, from, to), to - from + 1))) };
  });

  // Monthly: ticks in the month on screen out of all days in that month (28 to 31)
  const monthly = habits.map((h) => ({ label: h.name, bars: [bar(h, pct(count(h, 1, c.n), c.n))] }));

  // Consistency: ticks out of the days since the habit was started, up to today
  // (or up to the end of the month on screen when that month is in the past)
  const endKey = keyOf(c.end);
  const consistency = habits.map((h) => {
    const daysUsed = Math.round((c.end - new Date(h.start + 'T00:00')) / 864e5) + 1;
    const ticks = Object.keys(h.done).filter((k) => k <= endKey).length;
    return { label: h.name, bars: [bar(h, daysUsed > 0 ? Math.min(100, pct(ticks, daysUsed)) : 0)] };
  });

  $('legend').innerHTML = habits.map((h) => `<span><i style="background:${h.color}"></i>${esc(h.name)}</span>`).join('');
  drawChart('weekly', weekly);
  drawChart('monthly', monthly);
  drawChart('consistency', consistency);
}

/* ---------- Target Streak graph ---------- */
function renderTargetStreak(c) {
  const count = (h, from, to) => { let n = 0; for (let d = from; d <= to; d++) if (h.done[dayKey(c, d)]) n++; return n; };

  // Count checked days in the month on screen (only up to today), progress out of targetDays
  const targetData = habits.map((h) => {
    const totalChecked = count(h, 1, c.t);
    const progress = pct(totalChecked, targetDays);
    const cappedProgress = Math.min(progress, 100); // cap at 100%
    return {
      label: h.name,
      bars: [{ v: cappedProgress, c: h.color, t: `${h.name}: ${totalChecked}/${targetDays} days (${fmt(progress)})` }]
    };
  });

  drawChart('targetStreak', targetData);
}

function render() {
  const c = calendar();
  renderGrid(c);
  renderCharts(c);
  renderTargetStreak(c);
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
  habits.push(makeHabit(name, color));
  $('habitInput').value = '';
  save();
  render();
});

// Rename a habit
$('renameBtn').addEventListener('click', () => {
  if (habits.length === 0) {
    alert('No habits to rename.');
    return;
  }

  // Build a numbered list for the user to pick from
  const list = habits.map((h, i) => `${i + 1}. ${h.name}`).join('\n');
  const choice = prompt(`Which habit do you want to rename?\n\n${list}\n\nEnter the number:`);
  if (!choice) return;

  const index = parseInt(choice, 10) - 1;
  if (isNaN(index) || index < 0 || index >= habits.length) {
    alert('Invalid selection.');
    return;
  }

  const newName = prompt(`Rename "${habits[index].name}" to (max ${NAME_MAX} characters):`, habits[index].name);
  if (!newName || !newName.trim()) return;

  habits[index].name = newName.trim().slice(0, NAME_MAX).trim();
  save();
  render();
});

// Delete a habit
$('deleteBtn').addEventListener('click', () => {
  if (habits.length === 0) {
    alert('No habits to delete.');
    return;
  }

  // Build a numbered list for the user to pick from
  const list = habits.map((h, i) => `${i + 1}. ${h.name}`).join('\n');
  const choice = prompt(`Which habit do you want to delete?\n\n${list}\n\nEnter the number:`);
  if (!choice) return;

  const index = parseInt(choice, 10) - 1;
  if (isNaN(index) || index < 0 || index >= habits.length) {
    alert('Invalid selection.');
    return;
  }

  if (!confirm(`Delete "${habits[index].name}"? This cannot be undone.`)) return;

  habits.splice(index, 1);
  save();
  render();
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
  localStorage.setItem(TARGET_KEY, targetDays);
  renderTargetStreak(calendar());
});

// Keep two open tabs in sync
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== STORAGE_KEY && e.key !== TARGET_KEY && e.key !== TODO_KEY) return;
  habits = loadHabits();
  targetDays = loadTarget();
  todos = loadTodos();
  $('targetInput').value = targetDays;
  render();
  renderTodos();
});

/* ---------- Daily To-Do List ---------- */
const TODO_KEY = 'evolve.todos';
const TODO_MAX = 50;    // max characters per task (same as input maxlength)

// Each todo: { id, text, color, done: boolean }
function loadTodos() {
  return JSON.parse(localStorage.getItem(TODO_KEY)) || [];
}

let todos = loadTodos();

function saveTodos() {
  localStorage.setItem(TODO_KEY, JSON.stringify(todos));
}

function renderTodos() {
  const list = $('todoList');
  const progress = $('todoProgress');

  if (todos.length === 0) {
    list.innerHTML = '';
    progress.innerHTML = '<p class="todo-progress-info">No tasks yet — add one above!</p>';
    return;
  }

  // Render each task
  list.innerHTML = todos.map((t) =>
    `<li class="todo-item" style="--tc:${t.color}">
       <input type="checkbox" class="todo-check" data-todo="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark ${esc(t.text)}">
       <span class="todo-text ${t.done ? 'done' : ''}">${esc(t.text)}</span>
       <button class="todo-delete" data-remove-todo="${t.id}" title="Remove task">✕</button>
     </li>`
  ).join('');

  // Progress bar
  const doneCount = todos.filter((t) => t.done).length;
  const total = todos.length;
  const percent = Math.round((doneCount / total) * 100);

  progress.innerHTML =
    `<p class="todo-progress-info">${doneCount} of ${total} completed (${percent}%)</p>
     <div class="todo-bar-track">
       <div class="todo-bar-fill" style="width:${percent}%"></div>
     </div>`;
}

// Add a task
$('todoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('todoInput').value.trim();
  if (!text) return;

  // Pick the next color from COLORS, cycling through
  const color = COLORS[todos.length % COLORS.length];

  todos.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    text: text.slice(0, TODO_MAX),
    color,
    done: false
  });

  $('todoInput').value = '';
  saveTodos();
  renderTodos();
});

// Toggle a task done/undone
$('todoList').addEventListener('change', (e) => {
  if (!e.target.dataset.todo) return;
  const todo = todos.find((t) => t.id === e.target.dataset.todo);
  if (!todo) return;
  todo.done = e.target.checked;
  saveTodos();
  renderTodos();
});

// Remove a task
$('todoList').addEventListener('click', (e) => {
  const id = e.target.dataset.removeTodo;
  if (!id) return;
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  renderTodos();
});

render();
renderTodos();