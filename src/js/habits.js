/* Habit tracker: month grid, 2x2 progress charts, target streak & edit/delete dialog */
import {
  $, COLORS, DATE_RE, DAY_NAMES, HEX_RE, ID_RE, NAME_MAX, STORAGE_KEY, TARGET_DEFAULT, TARGET_KEY, TARGET_MAX,
  esc, fmt, keyOf, lsGet, lsSet, pad, pct, readJSON, todayDate, uid
} from './config.js';
import { paletteFor } from './theme.js';
import { showUndo, triggerAnim } from './effects.js';

const makeHabit = (name, color, goal = 7) => ({ id: uid(), name, color, goal, start: keyOf(new Date()), done: {} });
const isPlainObject = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const normGoal = (g) => (Number.isInteger(g) && g >= 1 && g <= 7 ? g : 7);
const isHabit = (h) => isPlainObject(h) && typeof h.id === 'string' && ID_RE.test(h.id) && typeof h.name === 'string' &&
  typeof h.color === 'string' && HEX_RE.test(h.color) && typeof h.start === 'string' && DATE_RE.test(h.start) &&
  isPlainObject(h.done) && Object.keys(h.done).every((k) => DATE_RE.test(k));
const isHabits = (d) => Array.isArray(d) && d.every(isHabit) && new Set(d.map((h) => h.id)).size === d.length;
const defaultHabits = () => ['Habit 1', 'Habit 2', 'Habit 3'].map((name, i) => makeHabit(name, COLORS[i]));
const goalLabel = (g) => (g === 7 ? 'Everyday' : `${g}× a week`);

/* Rebuilds one stored habit: keeps every ticked day and replaces only what is broken or unsafe */
function cleanHabit(h, i, ids) {
  if (!isPlainObject(h)) return null;
  const done = {};
  if (isPlainObject(h.done)) for (const k of Object.keys(h.done)) if (DATE_RE.test(k) && h.done[k]) done[k] = true;
  const first = Object.keys(done).sort()[0];
  let start = typeof h.start === 'string' && DATE_RE.test(h.start) ? h.start : (first || keyOf(new Date()));
  if (first && first < start) start = first;
  let id = typeof h.id === 'string' && ID_RE.test(h.id) ? h.id : uid();
  while (ids.has(id)) id = uid();
  ids.add(id);
  const name = typeof h.name === 'string' ? h.name.trim().slice(0, NAME_MAX).trim() : '';
  return {
    id,
    name: name || `Habit ${i + 1}`,
    color: typeof h.color === 'string' && HEX_RE.test(h.color) ? h.color : COLORS[i % COLORS.length],
    goal: normGoal(h.goal),
    start,
    done
  };
}
/* Returns the cleaned list, or null when nothing is recoverable (the caller then falls back to defaults) */
const repairHabits = (data) => {
  if (!Array.isArray(data)) return null;
  const ids = new Set();
  const cleaned = data.map((h, i) => cleanHabit(h, i, ids)).filter(Boolean);
  return cleaned.length ? cleaned : null;
};
const loadHabits = () => readJSON(STORAGE_KEY, isHabits, defaultHabits, repairHabits).map((h) => ({ ...h, goal: normGoal(h.goal) }));

const clampTarget = (v) => Math.min(TARGET_MAX, Math.max(1, v));
const loadTarget = () => { const v = parseInt(lsGet(TARGET_KEY), 10); return isNaN(v) ? TARGET_DEFAULT : clampTarget(v); };

let habits = loadHabits();
let targetDays = loadTarget();
let viewOffset = 0;
let weekIndex = Math.floor((new Date().getDate() - 1) / 7);

const shownHabits = () => habits.map((h, i) => {
  const p = paletteFor(h.color, i);
  return { ...h, color: p.color, grad: p.grad };
});
const save = () => lsSet(STORAGE_KEY, JSON.stringify(habits));

const goalOpts = [1, 2, 3, 4, 5, 6, 7].map((g) => `<option value="${g}">${goalLabel(g)}</option>`).join('');
$('goalInput').innerHTML = $('dialogGoal').innerHTML = goalOpts;
$('goalInput').value = 7;
$('targetInput').value = targetDays;

function calendar() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + viewOffset, 1);
  const y = d.getFullYear(), m = d.getMonth(), n = new Date(y, m + 1, 0).getDate();
  const t = viewOffset < 0 ? n : viewOffset === 0 ? now.getDate() : 0;
  const monthEnd = new Date(y, m, n), todayStart = todayDate();
  return { d, y, m, t, n, today: viewOffset === 0 ? now.getDate() : 0, end: monthEnd < todayStart ? monthEnd : todayStart };
}
const dayKey = (c, day) => `${c.y}-${pad(c.m + 1)}-${pad(day)}`;

function renderGrid(c) {
  const days = Array.from({ length: c.n }, (_, i) => i + 1);
  const weeks = Math.ceil(c.n / 7);
  const wstart = (d) => (d % 7 === 1 ? 'wstart' : '');

  let html = '<tr><th class="sub-heading">Habits</th>';
  for (let w = 0; w < weeks; w++) html += `<th class="wk wstart" colspan="${Math.min(7, c.n - w * 7)}">Week ${w + 1}</th>`;
  html += '</tr><tr><th></th>' + days.map((d) => {
    const name = DAY_NAMES[new Date(c.y, c.m, d).getDay()];
    return `<th class="${wstart(d)} ${d === c.today ? 'today' : ''}" title="${name}" aria-label="${name} ${d}">` +
      `<span class="dn">${d}</span><span class="dw" aria-hidden="true">${name[0]}</span></th>`;
  }).join('') + '</tr>';

  const hs = shownHabits();
  html += hs.length ? hs.map((h) =>
    `<tr style="--c:${h.color};--cg:${h.grad}"><td class="name"><span class="tag">${esc(h.name)}</span>${h.goal < 7 ? `<span class="goal">${h.goal}× / week</span>` : ''}</td>` +
    days.map((d) => {
      const key = dayKey(c, d);
      return `<td class="${wstart(d)}"><input type="checkbox" class="check" data-id="${h.id}" data-key="${key}" ${h.done[key] ? 'checked' : ''} ${d > c.t ? 'disabled' : ''} aria-label="${esc(h.name)} ${key}"></td>`;
    }).join('') + '</tr>'
  ).join('') : `<tr><td class="empty" colspan="${c.n + 1}">No habits yet. Type a name in “New habit…” above, choose how often, and press Add.</td></tr>`;

  $('grid').innerHTML = html;
  $('monthLabel').textContent = c.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function drawChart(id, groups, celebrate = false) {
  const el = $(id);
  const sig = JSON.stringify(groups.map((g, gi) => `${gi}:${g.label}:${g.bars.length}`));
  const flat = groups.flatMap((g) => g.bars);

  if (el.dataset.sig === sig) {
    el.querySelectorAll('.bar').forEach((bar, i) => {
      const b = flat[i];
      const was = parseFloat(bar.dataset.to) || 0;
      bar.dataset.to = b.v;
      bar.title = b.t;
      bar.style.background = b.g;
      bar.style.setProperty('--bc', b.c);
      if (b.v === 0) bar.dataset.zero = 'true'; else bar.removeAttribute('data-zero');
      bar.querySelector('span').textContent = fmt(b.v);
      bar.style.height = b.v + '%';
      if (celebrate && b.v > was + 0.01) triggerAnim(bar, 'bar-up');
    });
    return;
  }

  el.dataset.sig = sig;
  el.innerHTML = groups.length ? groups.map((g) =>
    `<div class="group"><div class="bars">` +
    g.bars.map((b) =>
      `<div class="bar" data-to="${b.v}"${b.v === 0 ? ' data-zero="true"' : ''} style="height:0%;background:${b.g};--bc:${b.c}" title="${esc(b.t)}"><span>${fmt(b.v)}</span></div>`
    ).join('') +
    `</div><label>${esc(g.label)}</label></div>`
  ).join('') : '<p class="chart-empty">Add a habit to see your progress here.</p>';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll('.bar').forEach((bar) => { bar.style.height = bar.dataset.to + '%'; });
  }));
}

function renderCharts(c, celebrate = false) {
  const hs = shownHabits();
  const bar = (h, v, note) => ({ v, c: h.color, g: h.grad, t: note ? `${h.name}: ${note} (${fmt(v)})` : `${h.name}: ${fmt(v)}` });
  const count = (h, from, to) => { let n = 0; for (let d = from; d <= to; d++) if (h.done[dayKey(c, d)]) n++; return n; };
  const weekGoal = (h, len) => (len >= 7 ? h.goal : Math.max(1, Math.round((h.goal * len) / 7)));
  const spans = Array.from({ length: Math.ceil(c.n / 7) }, (_, w) => ({ from: w * 7 + 1, to: Math.min(w * 7 + 7, c.n) }));
  const stat = (h, s) => ({ t: count(h, s.from, s.to), g: weekGoal(h, s.to - s.from + 1) });

  weekIndex = Math.max(0, Math.min(weekIndex, spans.length - 1));
  const span = spans[weekIndex];
  const range = span.from === span.to ? `Day ${span.from}` : `Days ${span.from}–${span.to}`;
  $('weekLabel').textContent = `Week ${weekIndex + 1} (${range})`;
  $('weekPrevBtn').disabled = weekIndex === 0;
  $('weekNextBtn').disabled = weekIndex === spans.length - 1;

  const weekly = hs.map((h) => {
    const k = stat(h, span);
    return { label: h.name, bars: [bar(h, Math.min(100, pct(k.t, k.g)), `${k.t} of ${k.g}`)] };
  });

  const monthly = hs.map((h) => {
    let got = 0, need = 0;
    spans.forEach((s) => { const k = stat(h, s); got += Math.min(k.t, k.g); need += k.g; });
    return { label: h.name, bars: [bar(h, pct(got, need), `${got} of ${need}`)] };
  });

  const endKey = keyOf(c.end);
  const consistency = hs.map((h) => {
    const daysUsed = Math.round((c.end - new Date(h.start + 'T00:00')) / 864e5) + 1;
    const ticks = Object.keys(h.done).filter((k) => k <= endKey).length;
    const expected = (h.goal * daysUsed) / 7;
    return { label: h.name, bars: [bar(h, daysUsed > 0 ? Math.min(100, pct(ticks, expected)) : 0, daysUsed > 0 ? `${ticks} of ${+expected.toFixed(1)}` : '')] };
  });

  drawChart('weekly', weekly, celebrate);
  drawChart('monthly', monthly, celebrate);
  drawChart('consistency', consistency, celebrate);
}

/*
 * Streak = number of days "on track", counted back from today (or from yesterday if today isn't ticked yet).
 * A habit may miss at most (7 - goal) days in any 7-day window, so:
 *   - an everyday habit needs an unbroken chain, exactly as before;
 *   - a "3x a week" habit may rest up to 4 days a week without losing its streak.
 * The streak always starts on a ticked day, never on a rest day.
 */
function streakOf(h) {
  const allowed = 7 - h.goal;
  const day = todayDate();
  if (!h.done[keyOf(day)]) day.setDate(day.getDate() - 1);
  const missed = []; // missed[i] is true when the day i days before the start point was not ticked
  let length = 0;
  for (let i = 0; i < 3660; i++) {
    missed.push(!h.done[keyOf(day)]);
    day.setDate(day.getDate() - 1);
    let misses = 0;
    for (let j = Math.max(0, i - 6); j <= i; j++) if (missed[j]) misses++;
    if (misses > allowed) break;
    length = i + 1;
  }
  while (length > 0 && missed[length - 1]) length--;
  return length;
}

function renderTargetStreak(celebrate = false) {
  drawChart('targetStreak', shownHabits().map((h) => {
    const streak = streakOf(h), progress = pct(streak, targetDays);
    return { label: h.name, bars: [{ v: Math.min(progress, 100), c: h.color, g: h.grad, t: `${h.name}: ${streak} of ${targetDays} days${h.goal < 7 ? ' on track' : ''} (${fmt(progress)})` }] };
  }), celebrate);
}

export function renderHabits(celebrate = false) {
  const c = calendar();
  renderGrid(c);
  renderCharts(c, celebrate);
  renderTargetStreak(celebrate);
}

export function onHabitsDayRollover(today, monthDelta) {
  if (viewOffset !== 0) viewOffset -= monthDelta;
  else weekIndex = Math.floor((today.getDate() - 1) / 7);
  renderHabits();
}

/* ---------- Edit / Delete dialog ---------- */
const dialog = $('habitDialog');
let dialogMode = 'rename', dialogPick = 0;

function syncDialogFields() {
  const h = habits[dialogPick];
  $('dialogName').value = h ? h.name : '';
  $('dialogGoal').value = h ? h.goal : 7;
}

function openDialog(mode) {
  dialogMode = mode;
  dialogPick = 0;
  const rename = mode === 'rename', empty = habits.length === 0;
  $('dialogTitle').textContent = rename ? 'Edit a habit' : 'Delete a habit';
  $('dialogEmpty').textContent = `No habits to ${rename ? 'edit' : 'delete'}.`;
  $('dialogEmpty').hidden = !empty;
  $('dialogList').hidden = empty;
  $('dialogNameWrap').hidden = $('dialogGoalWrap').hidden = empty || !rename;
  $('dialogName').required = rename;
  $('dialogOk').hidden = empty;
  $('dialogOk').textContent = rename ? 'Save' : 'Delete';
  $('dialogOk').classList.toggle('danger', !rename);
  $('dialogList').innerHTML = '<legend class="sr-only">Choose a habit</legend>' + shownHabits().map((h, i) =>
    `<label class="dialog-row"><input type="radio" name="dialogHabit" value="${i}" ${i === dialogPick ? 'checked' : ''}><span class="dialog-swatch" style="--c:${h.color};--cg:${h.grad}"></span><span class="dialog-habit">${esc(h.name)}</span></label>`
  ).join('');
  syncDialogFields();
  dialog.showModal();
  if (!empty && rename) { $('dialogName').focus(); $('dialogName').select(); }
}

export function syncHabitsFromStorage() {
  habits = loadHabits();
  targetDays = loadTarget();
  $('targetInput').value = targetDays;
  if (dialog.open) dialog.close();
  renderHabits();
}

export function initHabits() {
  const resetWeek = () => { weekIndex = viewOffset === 0 ? Math.floor((calendar().today - 1) / 7) : 0; };
  $('prevBtn').addEventListener('click', () => { viewOffset--; resetWeek(); renderHabits(); });
  $('nextBtn').addEventListener('click', () => { viewOffset++; resetWeek(); renderHabits(); });
  $('weekPrevBtn').addEventListener('click', () => { if (weekIndex > 0) { weekIndex--; renderCharts(calendar()); } });
  $('weekNextBtn').addEventListener('click', () => { weekIndex++; renderCharts(calendar()); });

  $('grid').addEventListener('change', (e) => {
    const el = e.target;
    if (!el.classList.contains('check')) return;
    const { id, key } = el.dataset;
    const h = habits.find((x) => x.id === id);
    if (!h) return;
    const checked = el.checked;
    if (checked) {
      h.done[key] = true;
      if (key < h.start) h.start = key;
      triggerAnim(el, 'celebrate');
      triggerAnim(el.parentElement, 'celebrate');
    } else {
      delete h.done[key];
    }
    save();
    const c = calendar();
    renderCharts(c, checked);
    renderTargetStreak(checked);
  });

  $('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('habitInput').value.trim();
    if (!name) return;
    const color = COLORS.find((c) => !habits.some((h) => h.color === c)) || COLORS[habits.length % COLORS.length];
    habits.push(makeHabit(name, color, normGoal(parseInt($('goalInput').value, 10))));
    $('habitInput').value = '';
    save();
    renderHabits();
  });

  $('targetGoBtn').addEventListener('click', () => {
    const val = parseInt($('targetInput').value, 10);
    if (isNaN(val) || val < 1) { alert('Please enter a valid target (1 or more days).'); return; }
    targetDays = clampTarget(val);
    $('targetInput').value = targetDays;
    lsSet(TARGET_KEY, targetDays);
    renderTargetStreak(true);
  });

  $('renameBtn').addEventListener('click', () => openDialog('rename'));
  $('deleteBtn').addEventListener('click', () => openDialog('delete'));
  $('dialogCancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  $('dialogList').addEventListener('change', (e) => { dialogPick = parseInt(e.target.value, 10); syncDialogFields(); });
  $('dialogList').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

  $('dialogForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const index = dialogPick, habit = habits[index];
    if (!habit) { dialog.close(); return; }

    if (dialogMode === 'rename') {
      const name = $('dialogName').value.trim().slice(0, NAME_MAX).trim();
      if (!name) { $('dialogName').focus(); return; }
      habit.name = name;
      habit.goal = normGoal(parseInt($('dialogGoal').value, 10));
      save(); renderHabits(); dialog.close();
      return;
    }

    habits.splice(index, 1);
    save(); renderHabits(); dialog.close();
    showUndo(`Deleted "${habit.name}"`, () => {
      habits.splice(Math.min(index, habits.length), 0, habit);
      save(); renderHabits();
    });
  });

  renderHabits();
}