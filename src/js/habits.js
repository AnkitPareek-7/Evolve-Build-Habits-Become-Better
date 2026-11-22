/* Habit tracker: month grid, 2x2 progress charts, target streak, tracking day and add / edit / delete dialogs */
import {
  $, COLORS, DAY_NAMES, NAME_MAX, STORAGE_KEY, TARGET_DEFAULT, TARGET_KEY, TARGET_MAX, TRACK_KEY, WEEK, WEEK_ORDER,
  esc, fmt, isRealDate, keyOf, lsGet, lsRemove, lsSet, pad, parseKey, pct, todayDate
} from './config.js';
import { fitDays, loadHabits, loadTrackStart, makeHabit, sortDays } from './habit-data.js';
import { cellState, rangeStats, startOf, streakOf } from './stats.js';
import { paletteFor } from './theme.js';
import { showUndo, triggerAnim } from './effects.js';

const clampTarget = (v) => Math.min(TARGET_MAX, Math.max(1, v));
const loadTarget = () => { const v = parseInt(lsGet(TARGET_KEY), 10); return isNaN(v) ? TARGET_DEFAULT : clampTarget(v); };

const freqLabel = (n) => (n === 7 ? 'Every day (7 days a week)' : n === 1 ? '1 day a week' : `${n} days a week`);
const abbr = (d) => WEEK.find((w) => w.d === d).n.slice(0, 3);
const letter = (d) => WEEK.find((w) => w.d === d).l;
const longDate = (key) => parseKey(key).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

let habits = loadHabits();
let targetDays = loadTarget();
let trackStart = loadTrackStart();
let viewOffset = 0;
let weekIndex = Math.floor((new Date().getDate() - 1) / 7);

const shownHabits = () => habits.map((h, i) => {
  const p = paletteFor(h.color, i);
  return { ...h, color: p.color, grad: p.grad };
});
const save = () => lsSet(STORAGE_KEY, JSON.stringify(habits));

$('targetInput').value = targetDays;

/* ---------- "Frequency + weekday chips" picker, shared by the Add and Edit dialogs ---------- */
/* Frequency and chips always agree: choosing a frequency suggests the days, ticking days updates the frequency. */
function makePicker(box, freq, hint) {
  freq.innerHTML = [1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}">${freqLabel(n)}</option>`).join('');
  box.innerHTML = WEEK.map((w) =>
    `<label class="day-chip" title="${w.n}"><input type="checkbox" value="${w.d}"><span aria-hidden="true">${w.l}</span><span class="sr-only">${w.n}</span></label>`
  ).join('');
  const inputs = [...box.querySelectorAll('input')];
  const get = () => inputs.filter((i) => i.checked).map((i) => +i.value);
  const sync = () => {
    const days = get();
    freq.value = days.length;
    hint.textContent = days.length === 7 ? 'Boxes open on every day.' : `Boxes open on: ${days.map(abbr).join(', ')}.`;
  };
  const set = (days) => { inputs.forEach((i) => { i.checked = days.includes(+i.value); }); sync(); };
  box.addEventListener('change', (e) => { if (!get().length) e.target.checked = true; sync(); });
  freq.addEventListener('change', () => set(fitDays(get(), +freq.value)));
  return { get, set };
}
const addPicker = makePicker($('addDays'), $('addFreq'), $('addHint'));
const editPicker = makePicker($('dialogDays'), $('dialogGoal'), $('dialogHint'));

function calendar() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + viewOffset, 1);
  const y = d.getFullYear(), m = d.getMonth(), n = new Date(y, m + 1, 0).getDate();
  const t = viewOffset < 0 ? n : viewOffset === 0 ? now.getDate() : 0;
  const monthEnd = new Date(y, m, n), todayStart = todayDate();
  return { d, y, m, t, n, today: viewOffset === 0 ? now.getDate() : 0, end: monthEnd < todayStart ? monthEnd : todayStart };
}
const dayKey = (c, day) => `${c.y}-${pad(c.m + 1)}-${pad(day)}`;

const CELL_NOTE = {
  locked: 'Before your tracking day',
  future: 'Not available yet',
  rest: 'Rest day: not one of this habit’s days',
  extra: 'Not a scheduled day. Untick to remove.'
};

function renderTrackInfo() {
  const todayKey = keyOf(todayDate());
  $('trackInfo').textContent = !trackStart
    ? 'No tracking day set. Each habit counts from the day you added it.'
    : trackStart > todayKey
      ? `Tracking starts on ${longDate(trackStart)}. All boxes stay locked until then.`
      : `Tracking from ${longDate(trackStart)}. Earlier boxes are locked and every chart counts from this day.`;
}

function renderGrid(c) {
  const today = todayDate();
  const days = Array.from({ length: c.n }, (_, i) => i + 1);
  const weeks = Math.ceil(c.n / 7);
  const wstart = (d) => (d % 7 === 1 ? 'wstart' : '');

  let html = '<tr><th class="sub-heading">Habits</th>';
  for (let w = 0; w < weeks; w++) html += `<th class="wk wstart" colspan="${Math.min(7, c.n - w * 7)}">Week ${w + 1}</th>`;
  html += '</tr><tr><th></th>' + days.map((d) => {
    const name = DAY_NAMES[new Date(c.y, c.m, d).getDay()], key = dayKey(c, d);
    const cls = [wstart(d), d === c.today ? 'today' : '', trackStart && key < trackStart ? 'before' : '', key === trackStart ? 'tstart' : ''].filter(Boolean).join(' ');
    const title = key === trackStart ? `${name}: tracking starts here` : name;
    return `<th class="${cls}" title="${title}" aria-label="${title} ${d}">` +
      `<span class="dn">${d}</span><span class="dw" aria-hidden="true">${name[0]}</span></th>`;
  }).join('') + '</tr>';

  const hs = shownHabits();
  html += hs.length ? hs.map((h) => {
    const partial = h.days.length < 7;
    return `<tr style="--c:${h.color};--cg:${h.grad}"><td class="name"><div class="name-row"><span class="tag">${esc(h.name)}</span><span class="goal"${partial ? ` title="${h.days.map(abbr).join(', ')}"` : ''}>${partial ? h.days.map(letter).join(' ') : ''}</span></div></td>` +
    days.map((d) => {
      const key = dayKey(c, d);
      const state = cellState(h, new Date(c.y, c.m, d), trackStart, today);
      const off = state === 'locked' || state === 'future' || state === 'rest';
      const cls = [wstart(d), state === 'rest' ? 'rest' : '', state === 'locked' ? 'locked' : '', key === trackStart ? 'tstart' : ''].filter(Boolean).join(' ');
      return `<td class="${cls}"${CELL_NOTE[state] ? ` title="${CELL_NOTE[state]}"` : ''}><input type="checkbox" class="check" data-id="${h.id}" data-key="${key}" ${h.done[key] ? 'checked' : ''} ${off ? 'disabled' : ''} aria-label="${esc(h.name)} ${key}"></td>`;
    }).join('') + '</tr>';
  }).join('') : `<tr><td class="empty" colspan="${c.n + 1}">No habits yet. Press “Add a Habit” to create your first one.</td></tr>`;

  $('grid').innerHTML = html;
  $('monthLabel').textContent = c.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  renderTrackInfo();
}

function drawChart(id, groups, celebrate = false) {
  const el = $(id);
  const sig = JSON.stringify(groups.map((g, gi) => `${gi}:${g.label}:${g.bars.length}`));
  const flat = groups.flatMap((g) => g.bars);
  const label = (b) => b.l ?? fmt(b.v);

  if (el.dataset.sig === sig) {
    el.querySelectorAll('.bar').forEach((bar, i) => {
      const b = flat[i];
      const was = parseFloat(bar.dataset.to) || 0;
      bar.dataset.to = b.v;
      bar.title = b.t;
      bar.style.background = b.g;
      bar.style.setProperty('--bc', b.c);
      if (b.v === 0) bar.dataset.zero = 'true'; else bar.removeAttribute('data-zero');
      bar.querySelector('span').textContent = label(b);
      bar.style.height = b.v + '%';
      if (celebrate && b.v > was + 0.01) triggerAnim(bar, 'bar-up');
    });
    return;
  }

  el.dataset.sig = sig;
  el.innerHTML = groups.length ? groups.map((g) =>
    `<div class="group"><div class="bars">` +
    g.bars.map((b) =>
      `<div class="bar" data-to="${b.v}"${b.v === 0 ? ' data-zero="true"' : ''} style="height:0%;background:${b.g};--bc:${b.c}" title="${esc(b.t)}"><span>${esc(label(b))}</span></div>`
    ).join('') +
    `</div><label>${esc(g.label)}</label></div>`
  ).join('') : '<p class="chart-empty">Add a habit to see your progress here.</p>';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll('.bar').forEach((bar) => { bar.style.height = bar.dataset.to + '%'; });
  }));
}

/*
 * Weekly, Monthly and Consistency all work the same way now:
 *   score = ticked scheduled days / scheduled days, counting only days on or after the habit's start
 *   (its own start, or the tracking day if that is later). Rest days are never counted.
 */
function renderCharts(c, celebrate = false) {
  const hs = shownHabits();
  const bar = (h, v, note) => ({ v, c: h.color, g: h.grad, t: `${h.name}: ${note} (${fmt(v)})` });
  /* Nothing to measure (no scheduled days, or tracking hasn't started): an empty bar with "–" */
  const empty = (h, why) => ({ v: 0, l: '–', c: h.color, g: h.grad, t: `${h.name}: ${why}` });
  const startKey = (h) => startOf(h, trackStart);
  const why = (h, endKey) => (startKey(h) > endKey ? `counts from ${longDate(startKey(h))}` : 'no scheduled days in this period');
  const inMonth = (h, from, to) => rangeStats(h, new Date(c.y, c.m, from), new Date(c.y, c.m, to), startKey(h));
  const score = (h, k, endKey) => (k.planned
    ? bar(h, Math.min(100, pct(k.done, k.planned)), `${k.done} of ${k.planned} scheduled days`)
    : empty(h, why(h, endKey)));
  const spans = Array.from({ length: Math.ceil(c.n / 7) }, (_, w) => ({ from: w * 7 + 1, to: Math.min(w * 7 + 7, c.n) }));

  weekIndex = Math.max(0, Math.min(weekIndex, spans.length - 1));
  const span = spans[weekIndex];
  const range = span.from === span.to ? `Day ${span.from}` : `Days ${span.from}–${span.to}`;
  $('weekLabel').textContent = `Week ${weekIndex + 1} (${range})`;
  $('weekPrevBtn').disabled = weekIndex === 0;
  $('weekNextBtn').disabled = weekIndex === spans.length - 1;

  const weekEnd = dayKey(c, span.to), monthEnd = dayKey(c, c.n);
  const weekly = hs.map((h) => ({ label: h.name, bars: [score(h, inMonth(h, span.from, span.to), weekEnd)] }));
  const monthly = hs.map((h) => ({ label: h.name, bars: [score(h, inMonth(h, 1, c.n), monthEnd)] }));

  /* Consistency: everything from the habit's first day up to today (or the end of a past month). Today only counts once ticked. */
  const endKey = keyOf(c.end), todayKey = keyOf(todayDate());
  const consistency = hs.map((h) => ({
    label: h.name,
    bars: [score(h, rangeStats(h, parseKey(startKey(h)), c.end, startKey(h), todayKey), endKey)]
  }));

  drawChart('weekly', weekly, celebrate);
  drawChart('monthly', monthly, celebrate);
  drawChart('consistency', consistency, celebrate);
}

function renderTargetStreak(celebrate = false) {
  const today = todayDate();
  drawChart('targetStreak', shownHabits().map((h) => {
    const streak = streakOf(h, trackStart, today), progress = pct(streak, targetDays);
    return { label: h.name, bars: [{ v: Math.min(progress, 100), c: h.color, g: h.grad, t: `${h.name}: ${streak} of ${targetDays} days (${fmt(progress)})` }] };
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

/* ---------- Dialogs: add, edit / delete, tracking day ---------- */
const addDialog = $('addDialog');
const dialog = $('habitDialog');
const trackDialog = $('trackDialog');
let dialogMode = 'rename', dialogPick = 0;

function syncDialogFields() {
  const h = habits[dialogPick];
  $('dialogName').value = h ? h.name : '';
  if (h) editPicker.set(h.days);
}

function openDialog(mode) {
  dialogMode = mode;
  dialogPick = 0;
  const rename = mode === 'rename', empty = habits.length === 0;
  $('dialogTitle').textContent = rename ? 'Edit a habit' : 'Delete a habit';
  $('dialogEmpty').textContent = `No habits to ${rename ? 'edit' : 'delete'}.`;
  $('dialogEmpty').hidden = !empty;
  $('dialogList').hidden = empty;
  $('dialogNameWrap').hidden = $('dialogGoalWrap').hidden = $('dialogDaysWrap').hidden = empty || !rename;
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

function openAddDialog() {
  $('addName').value = '';
  addPicker.set(WEEK_ORDER);
  addDialog.showModal();
  $('addName').focus();
}

function openTrackDialog() {
  $('trackInput').value = trackStart || keyOf(todayDate());
  $('trackClear').hidden = !trackStart;
  trackDialog.showModal();
}

function setTrackStart(value) {
  trackStart = value;
  if (value) lsSet(TRACK_KEY, value); else lsRemove(TRACK_KEY);
  renderHabits();
}

export function syncHabitsFromStorage() {
  habits = loadHabits();
  targetDays = loadTarget();
  trackStart = loadTrackStart();
  $('targetInput').value = targetDays;
  [addDialog, dialog, trackDialog].forEach((d) => { if (d.open) d.close(); });
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
      /* An old tick on a day that is no longer scheduled was kept so it could be removed. Once removed, the box becomes a rest day. */
      if (cellState(h, parseKey(key), trackStart, todayDate()) === 'rest') {
        el.disabled = true;
        el.parentElement.classList.add('rest');
        el.parentElement.title = CELL_NOTE.rest;
      }
    }
    save();
    const c = calendar();
    renderCharts(c, checked);
    renderTargetStreak(checked);
  });

  /* Add a Habit */
  $('addHabitBtn').addEventListener('click', openAddDialog);
  $('addCancel').addEventListener('click', () => addDialog.close());
  $('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('addName').value.trim().slice(0, NAME_MAX).trim();
    if (!name) { $('addName').focus(); return; }
    const color = COLORS.find((c) => !habits.some((h) => h.color === c)) || COLORS[habits.length % COLORS.length];
    habits.push(makeHabit(name, color, addPicker.get()));
    save();
    renderHabits();
    addDialog.close();
  });

  /* Tracking day */
  $('trackBtn').addEventListener('click', openTrackDialog);
  $('trackCancel').addEventListener('click', () => trackDialog.close());
  $('trackToday').addEventListener('click', () => { $('trackInput').value = keyOf(todayDate()); });
  $('trackClear').addEventListener('click', () => { setTrackStart(null); trackDialog.close(); });
  $('trackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = $('trackInput').value;
    if (!isRealDate(value)) { $('trackInput').focus(); return; }
    setTrackStart(value);
    trackDialog.close();
  });

  $('targetGoBtn').addEventListener('click', () => {
    const val = parseInt($('targetInput').value, 10);
    if (isNaN(val) || val < 1) { alert('Please enter a valid target (1 or more days).'); return; }
    targetDays = clampTarget(val);
    $('targetInput').value = targetDays;
    lsSet(TARGET_KEY, targetDays);
    renderTargetStreak(true);
  });

  /* Edit / Delete */
  $('renameBtn').addEventListener('click', () => openDialog('rename'));
  $('deleteBtn').addEventListener('click', () => openDialog('delete'));
  $('dialogCancel').addEventListener('click', () => dialog.close());
  $('dialogList').addEventListener('change', (e) => { dialogPick = parseInt(e.target.value, 10); syncDialogFields(); });
  $('dialogList').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

  /* Clicking the dimmed area outside any dialog closes it */
  [addDialog, dialog, trackDialog].forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  $('dialogForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const index = dialogPick, habit = habits[index];
    if (!habit) { dialog.close(); return; }

    if (dialogMode === 'rename') {
      const name = $('dialogName').value.trim().slice(0, NAME_MAX).trim();
      if (!name) { $('dialogName').focus(); return; }
      habit.name = name;
      habit.days = sortDays(editPicker.get());
      habit.goal = habit.days.length;
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