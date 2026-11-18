/* EVOLVE – habit tracker
   A habit is saved as: { id, name, color, start: "YYYY-MM-DD", done: { "YYYY-MM-DD": true } } */

const STORAGE_KEY = 'evolve.v1';

// Every habit gets the next unused colour from this list (edit freely)
const COLORS = ['#00ffc8', '#03e7f7', '#b4ff00', '#62ff00', '#dcf905'];

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (n, total) => (n / total) * 100;
const fmt = (v) => +v.toFixed(1) + '%';                 // 71.4285 -> "71.4%"

// Today's date info: year, month, day of month (t) and days in this month (n)
function calendar() {
  const d = new Date();
  return { d, y: d.getFullYear(), m: d.getMonth(), t: d.getDate(), n: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() };
}
const dayKey = (c, day) => `${c.y}-${pad(c.m + 1)}-${pad(day)}`;

/* ---------- Data ---------- */
function makeHabit(name, color) {
  const c = calendar();
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, color, start: dayKey(c, c.t), done: {} };
}

// Default habits renamed to Habit 1, Habit 2, Habit 3
let habits = JSON.parse(localStorage.getItem(STORAGE_KEY)) ||
  ['Habit 1', 'Habit 2', 'Habit 3'].map((name, i) => makeHabit(name, COLORS[i]));

const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));

/* ---------- Month grid ---------- */
function renderGrid(c) {
  const days = Array.from({ length: c.n }, (_, i) => i + 1);
  const weeks = Math.ceil(c.n / 7);
  const wstart = (d) => (d % 7 === 1 ? 'wstart' : '');   // first day of each week

  // Sub-heading row: label for the sections
  let html = '<tr>';
  html += '<th class="sub-heading">Habits</th>';
  for (let w = 0; w < weeks; w++) {
    html += `<th class="sub-heading wstart" colspan="${Math.min(7, c.n - w * 7)}">Weeks</th>`;
  }
  html += '</tr>';

  // Row 1: week names
  html += '<tr><th></th>';
  for (let w = 0; w < weeks; w++) html += `<th class="wk wstart" colspan="${Math.min(7, c.n - w * 7)}">Week ${w + 1}</th>`;
  html += '</tr>';

  // Row 2: day numbers with "Day" label
  html += '<tr><th class="sub-heading">Day</th>' + days.map((d) => `<th class="${wstart(d)} ${d === c.t ? 'today' : ''}">${d}</th>`).join('') + '</tr>';

  // One row per habit
  html += habits.map((h) =>
    `<tr style="--c:${h.color}">
       <td class="name"><span class="tag">${esc(h.name)}</span> <button class="x" data-remove="${h.id}" title="Remove">✕</button></td>` +
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

  // Monthly: ticks this month out of all days in the month (30 or 31)
  const monthly = habits.map((h) => ({ label: h.name, bars: [bar(h, pct(count(h, 1, c.n), c.n))] }));

  // Consistency: ticks out of the days since the habit was started (4 ticks in 5 days = 80%)
  const consistency = habits.map((h) => {
    const daysUsed = Math.round((new Date(dayKey(c, c.t) + 'T00:00') - new Date(h.start + 'T00:00')) / 864e5) + 1;
    return { label: h.name, bars: [bar(h, pct(Object.keys(h.done).length, daysUsed))] };
  });

  $('legend').innerHTML = habits.map((h) => `<span><i style="background:${h.color}"></i>${esc(h.name)}</span>`).join('');
  drawChart('weekly', weekly);
  drawChart('monthly', monthly);
  drawChart('consistency', consistency);
}

/* ---------- Target Streak graph ---------- */
let targetDays = 21; // default target

function renderTargetStreak(c) {
  const bar = (h, v) => ({ v, c: h.color, t: `${h.name}: ${fmt(v)}` });
  const count = (h, from, to) => { let n = 0; for (let d = from; d <= to; d++) if (h.done[dayKey(c, d)]) n++; return n; };

  // Count total checked days for each habit, calculate progress out of targetDays
  const targetData = habits.map((h) => {
    const totalChecked = count(h, 1, c.t); // only count up to today
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

// Remove a habit
$('grid').addEventListener('click', (e) => {
  const h = habits.find((x) => x.id === e.target.dataset.remove);
  if (h && confirm(`Remove "${h.name}"?`)) {
    habits = habits.filter((x) => x !== h);
    save();
    render();
  }
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

  const newName = prompt(`Rename "${habits[index].name}" to:`, habits[index].name);
  if (!newName || !newName.trim()) return;

  habits[index].name = newName.trim();
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
  targetDays = val;
  renderTargetStreak(calendar());
});

render();
