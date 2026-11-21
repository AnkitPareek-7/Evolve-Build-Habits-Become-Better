/* Daily To-Do List with per-date storage & animated progress */
import { $, COLORS, DATE_RE, HEX_RE, ID_RE, TODO_KEY, TODO_MAX, esc, keyOf, lsSet, readJSON, todayDate, uid } from './config.js';
import { paletteFor } from './theme.js';
import { showUndo, triggerAnim } from './effects.js';

const isTask = (t) => !!t && typeof t.id === 'string' && ID_RE.test(t.id) && typeof t.text === 'string' &&
  typeof t.color === 'string' && HEX_RE.test(t.color) && typeof t.done === 'boolean';
const isTaskList = (a) => Array.isArray(a) && a.every(isTask) && new Set(a.map((t) => t.id)).size === a.length;
const isTodoStore = (d) => isTaskList(d) || (!!d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).every((k) => DATE_RE.test(k) && isTaskList(d[k])));

/* Rebuilds one stored task, or returns null when it has no usable text */
function cleanTask(t, i, ids) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  const text = typeof t.text === 'string' ? t.text.trim().slice(0, TODO_MAX).trim() : '';
  if (!text) return null;
  let id = typeof t.id === 'string' && ID_RE.test(t.id) ? t.id : uid();
  while (ids.has(id)) id = uid();
  ids.add(id);
  return {
    id,
    text,
    color: typeof t.color === 'string' && HEX_RE.test(t.color) ? t.color : COLORS[i % COLORS.length],
    done: t.done === true
  };
}
const cleanList = (list) => {
  const ids = new Set();
  return (Array.isArray(list) ? list : []).map((t, i) => cleanTask(t, i, ids)).filter(Boolean);
};

/* Keeps every good task and every good day; only broken entries are dropped or fixed */
function repairTodos(data) {
  if (Array.isArray(data)) {
    const list = cleanList(data);
    return list.length ? { [keyOf(new Date())]: list } : {};
  }
  if (!data || typeof data !== 'object') return null;
  const store = {};
  for (const k of Object.keys(data)) {
    if (!DATE_RE.test(k)) continue;
    const list = cleanList(data[k]);
    if (list.length) store[k] = list;
  }
  return store;
}

function loadTodos() {
  const data = readJSON(TODO_KEY, isTodoStore, () => ({}), repairTodos);
  if (Array.isArray(data)) {
    const store = data.length ? { [keyOf(new Date())]: data } : {};
    lsSet(TODO_KEY, JSON.stringify(store));
    return store;
  }
  return data;
}

let todos = loadTodos();
let todoOffset = 0;
let prevTodoPct = null;

const viewedDate = () => { const t = todayDate(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() + todoOffset); };
const dayTasks = () => todos[keyOf(viewedDate())] || [];
const saveTodos = () => lsSet(TODO_KEY, JSON.stringify(todos));

function setDayTasks(list) {
  const key = keyOf(viewedDate());
  if (list.length) todos[key] = list; else delete todos[key];
  saveTodos();
}

function renderTodoProgress(celebrate = false) {
  const progress = $('todoProgress'), tasks = dayTasks(), isToday = todoOffset === 0;
  if (!tasks.length) {
    progress.innerHTML = `<p class="todo-progress-info">${isToday ? 'No tasks yet. Add one above.' : 'No tasks on this day.'}</p>`;
    prevTodoPct = 0;
    return;
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const percent = Math.round((doneCount / total) * 100);
  const label = `${doneCount} of ${total} completed (${percent}%)`;
  const fill = progress.querySelector('.todo-bar-fill');

  if (fill) {
    const was = prevTodoPct ?? 0;
    prevTodoPct = percent;
    progress.querySelector('.todo-progress-info').textContent = label;
    fill.style.width = `${percent}%`;
    if (celebrate && percent > was) triggerAnim(fill, 'bar-up');
    return;
  }

  prevTodoPct = percent;
  progress.innerHTML = `<p class="todo-progress-info">${label}</p><div class="todo-bar-track"><div class="todo-bar-fill" style="width:0%"></div></div>`;
  const newFill = progress.querySelector('.todo-bar-fill');
  requestAnimationFrame(() => requestAnimationFrame(() => { newFill.style.width = `${percent}%`; }));
}

export function renderTodos() {
  const list = $('todoList'), tasks = dayTasks(), isToday = todoOffset === 0;
  $('todoDateLabel').textContent = viewedDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + (isToday ? ' (Today)' : '');
  $('todoNextBtn').disabled = isToday;

  list.innerHTML = tasks.map((t, i) => {
    const p = paletteFor(t.color, i);
    return `<li class="todo-item" style="--tc:${p.color};--tcg:${p.grad}"><input type="checkbox" class="todo-check" data-todo="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark ${esc(t.text)}"><span class="todo-text ${t.done ? 'done' : ''}">${esc(t.text)}</span><button class="todo-delete" data-remove-todo="${t.id}" aria-label="Remove task: ${esc(t.text)}">Remove</button></li>`;
  }).join('');

  renderTodoProgress();
}

export function onTodosDayRollover(dayDelta) {
  if (todoOffset !== 0) todoOffset -= dayDelta;
  prevTodoPct = null;
  renderTodos();
}

export function syncTodosFromStorage() {
  todos = loadTodos();
  prevTodoPct = null;
  renderTodos();
}

export function initTodos() {
  $('todoPrevBtn').addEventListener('click', () => { todoOffset--; prevTodoPct = null; renderTodos(); });
  $('todoNextBtn').addEventListener('click', () => { if (todoOffset < 0) { todoOffset++; prevTodoPct = null; renderTodos(); } });

  $('todoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('todoInput').value.trim();
    if (!text) return;
    const tasks = dayTasks().slice();
    tasks.push({ id: uid(), text: text.slice(0, TODO_MAX), color: COLORS[tasks.length % COLORS.length], done: false });
    $('todoInput').value = '';
    setDayTasks(tasks);
    renderTodos();
  });

  $('todoList').addEventListener('change', (e) => {
    const el = e.target;
    const todo = el.dataset.todo && dayTasks().find((t) => t.id === el.dataset.todo);
    if (!todo) return;
    todo.done = el.checked;
    el.nextElementSibling.classList.toggle('done', todo.done);
    if (todo.done) {
      triggerAnim(el, 'celebrate');
      triggerAnim(el.closest('.todo-item'), 'celebrate');
    }
    saveTodos();
    renderTodoProgress(todo.done);
  });

  $('todoList').addEventListener('click', (e) => {
    const id = e.target.dataset.removeTodo;
    if (!id) return;
    const key = keyOf(viewedDate()), tasks = dayTasks(), index = tasks.findIndex((t) => t.id === id);
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

  renderTodos();
}