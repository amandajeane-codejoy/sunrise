const VERSION = '0.4';
const MAIN_SCREENS = ['checkin', 'today', 'progress', 'settings'];
const SETUP_SCREENS = ['welcome', 'setup-you', 'setup-gear', 'setup-davis', 'setup-ready'];
const TAB_FOR = { checkin: 'today', today: 'today', progress: 'progress', settings: 'settings' };

/* ---------- Navigation ---------- */

function openScreen(id) {
  if (!state.setupDone && !SETUP_SCREENS.includes(id)) id = 'welcome';
  if (state.setupDone && !MAIN_SCREENS.includes(id)) id = 'checkin';

  render();
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  document.getElementById('nav').classList.toggle('hidden', !MAIN_SCREENS.includes(id));
  document.querySelectorAll('#nav button').forEach(b => {
    const on = b.dataset.tab === TAB_FOR[id];
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  history.replaceState(null, '', id === 'checkin' ? './' : `?screen=${id}`);
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach(el => el.textContent = value);
}

/* ---------- Form fields bound to saved data (data-field="profile.name") ---------- */

function getPath(path) { return path.split('.').reduce((o, k) => o[k], state); }

function setPath(path, value) {
  const keys = path.split('.'), last = keys.pop();
  keys.reduce((o, k) => o[k], state)[last] = value;
}

function fillFields() {
  document.querySelectorAll('[data-field]').forEach(el => {
    if (el === document.activeElement) return;
    const value = getPath(el.dataset.field);
    if (el.type === 'checkbox') el.checked = !!value; else el.value = value ?? '';
  });
}

document.addEventListener('change', event => {
  const el = event.target.closest('[data-field]');
  if (!el) return;
  let value = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'number') value = Math.min(7, Math.max(1, Math.round(Number(value)) || 3));
  if (typeof value === 'string') value = value.trim();
  setPath(el.dataset.field, value);
  saveState();
  render();
  if (state.setupDone) toast('Saved');
});

/* ---------- Equipment editor (used in setup and Settings) ---------- */

function renderGearEditors() {
  const eq = state.equipment;
  const dumbbellChips = eq.dumbbells.map((d, i) =>
    `<span class="chip">${d.lb} lb ${d.pair ? 'pair' : 'single'}<button type="button" aria-label="Remove ${d.lb} pound dumbbell" data-gear-remove="dumbbells:${i}">×</button></span>`).join('');
  const kbChips = eq.kettlebells.map((lb, i) =>
    `<span class="chip">${lb} lb<button type="button" aria-label="Remove ${lb} pound kettlebell" data-gear-remove="kettlebells:${i}">×</button></span>`).join('');
  const otherChips = eq.other.map((name, i) =>
    `<span class="chip">${esc(name)}<button type="button" aria-label="Remove ${esc(name)}" data-gear-remove="other:${i}">×</button></span>`).join('');

  const html = `
    <label class="setting"><span>Yoga mat</span><input type="checkbox" data-field="equipment.mat"></label>
    <div class="setting stack">
      <span class="label">Dumbbells</span>
      <div class="chips">${dumbbellChips || '<span class="empty">None yet</span>'}</div>
      <div class="add-row">
        <input type="number" inputmode="decimal" min="1" max="100" step="0.5" placeholder="lb" aria-label="Dumbbell weight in pounds" data-gear-input="dumbbells">
        <select aria-label="Pair or single" data-gear-kind><option value="pair">pair</option><option value="single">single</option></select>
        <button type="button" data-gear-add="dumbbells">Add</button>
      </div>
    </div>
    <div class="setting stack">
      <span class="label">Kettlebells</span>
      <div class="chips">${kbChips || '<span class="empty">None yet</span>'}</div>
      <div class="add-row">
        <input type="number" inputmode="decimal" min="1" max="100" step="0.5" placeholder="lb" aria-label="Kettlebell weight in pounds" data-gear-input="kettlebells">
        <button type="button" data-gear-add="kettlebells">Add</button>
      </div>
    </div>
    <div class="setting stack">
      <span class="label">Other gear</span>
      <div class="chips">${otherChips || '<span class="empty">Optional, for example a resistance band</span>'}</div>
      <div class="add-row">
        <input type="text" maxlength="40" placeholder="Add gear" aria-label="Other gear" data-gear-input="other">
        <button type="button" data-gear-add="other">Add</button>
      </div>
    </div>`;
  document.querySelectorAll('[data-gear-editor]').forEach(el => el.innerHTML = html);
}

function addGear(button) {
  const kind = button.dataset.gearAdd;
  const row = button.closest('.add-row');
  const input = row.querySelector('[data-gear-input]');
  const eq = state.equipment;

  if (kind === 'other') {
    const name = input.value.trim();
    if (!name) return input.focus();
    eq.other.push(name);
  } else {
    const lb = Math.round(Number(input.value) * 2) / 2;
    if (!lb || lb <= 0 || lb > 100) { toast('Enter a weight in pounds, like 8'); return input.focus(); }
    if (kind === 'dumbbells') {
      const pair = row.querySelector('[data-gear-kind]').value === 'pair';
      if (eq.dumbbells.some(d => d.lb === lb && d.pair === pair)) return toast('Already on your list');
      eq.dumbbells.push({ lb, pair });
      eq.dumbbells.sort((a, b) => a.lb - b.lb);
    } else {
      if (eq.kettlebells.includes(lb)) return toast('Already on your list');
      eq.kettlebells.push(lb);
      eq.kettlebells.sort((a, b) => a - b);
    }
  }
  saveState();
  render();
}

function removeGear(ref) {
  const [kind, index] = ref.split(':');
  state.equipment[kind].splice(Number(index), 1);
  saveState();
  render();
}

// Pressing Return in an add box adds it.
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  const input = event.target.closest('[data-gear-input]');
  if (!input) return;
  event.preventDefault();
  addGear(input.closest('.add-row').querySelector('[data-gear-add]'));
});

/* ---------- Davis editor (used in setup and Settings) ---------- */

function renderDavisEditors() {
  const html = `
    <label class="setting"><span>His name</span><input data-field="davis.name" autocomplete="off"></label>
    <label class="setting"><span>His phone</span><input data-field="davis.phone" type="tel" inputmode="tel" autocomplete="off" placeholder="Optional"></label>
    <label class="setting"><span>Sunday summary</span><input type="checkbox" data-field="davis.weeklySummary"></label>
    <label class="setting"><span>Two-days-off alert</span><input type="checkbox" data-field="davis.twoDayAlert"></label>
    <p class="tiny gap-s">Messages always say "your wife," never your name. For example:</p>
    <p class="quote">Your wife got in 4 workouts this week, including 2 shoulder days.</p>
    <p class="quote">Your wife has had 2 days off in a row. A little encouragement might help her get moving tomorrow morning.</p>`;
  document.querySelectorAll('[data-davis-editor]').forEach(el => el.innerHTML = html);
}

/* ---------- Main screens ---------- */

// Placeholder moves until the exercise library arrives in step 3.
function sampleMoves() {
  const lb = lightestDumbbell();
  const weight = lb ? `${lb} lb` : 'no weight';
  return [
    { name: 'Wall slides', meta: 'Easier version · no weight', floor: false },
    { name: 'Dumbbell bent-over row', meta: lb ? `${lb} lb` : 'bodyweight version', floor: false },
    { name: 'Reverse fly', meta: lb ? `${weight} · light cap` : 'no weight', floor: false },
    { name: 'Prone Y-T-W raises', meta: 'Easier version · no weight', floor: true }
  ];
}

function renderDates() {
  const now = new Date();
  setText('[data-date="long"]', now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase());
  setText('[data-date="short"]', now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase().replace(',', ' ·'));
  const h = now.getHours();
  setText('[data-greeting]', h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  setText('[data-kicker]', h < 12 ? 'Your morning starts here' : 'Your day, your plan');
}

function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  document.getElementById('cal-month').textContent = now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const kindByDate = {};
  for (const e of state.log) kindByDate[e.date] = e.kind === 'workout' ? 'work' : e.kind;

  const parts = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="dow">${d}</span>`);
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  for (let i = 0; i < lead; i++) parts.push('<span></span>');
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const classes = ['day'];
    const kind = kindByDate[dateKey(new Date(year, month, d))];
    if (kind) classes.push(kind);
    if (d === today) classes.push('today');
    if (d > today) classes.push('future');
    parts.push(`<span class="${classes.join(' ')}">${d}</span>`);
  }
  document.getElementById('calendar').innerHTML = parts.join('');
}

function renderRecent() {
  const recent = workouts().slice(-3).reverse();
  document.getElementById('recent').innerHTML = recent.length
    ? recent.map(w => {
        const date = new Date(w.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<div class="move"><span class="move-num">✦</span><div class="move-body"><strong>${esc(w.type)}</strong><span class="tiny">Workout ${w.number} · ${date}</span></div></div>`;
      }).join('')
    : '<p class="empty-note">Your first workout will show up here.</p>';
}

function render() {
  const p = state.profile;
  setText('[data-name]', p.name || 'friend');
  setText('[data-why]', p.why || 'Feel strong for real life and undo desk posture.');
  renderDates();

  const done = workoutsDone();
  setText('[data-next-number]', nextWorkoutNumber());
  setText('[data-next-type]', nextDayType());
  setText('[data-gear-summary]', gearSummary());
  setText('[data-done]', done);
  document.querySelectorAll('[data-journey-fill]').forEach(el => el.style.width = `${(done / JOURNEY_LENGTH) * 100}%`);

  const lb = lightestDumbbell();
  setText('[data-gear-pill]', [state.equipment.mat ? 'Mat' : '', lb ? `${lb} lb` : ''].filter(Boolean).join(' + ') || 'No gear');
  document.getElementById('today-moves').innerHTML = sampleMoves().map((m, i) =>
    `<div class="move"><span class="move-num">${i + 1}</span><div class="move-body"><strong>${m.name}</strong><span class="tiny">${m.meta}</span></div><span class="tag${m.floor ? ' floor' : ''}">${m.floor ? 'FLOOR' : 'STAND'}</span></div>`).join('');

  const week = weekCount(), target = Number(p.weeklyTarget) || 3;
  setText('[data-week-count]', week);
  setText('[data-week-target]', target);
  setText('[data-month-count]', monthCount());
  document.querySelector('[data-week-fill]').style.width = `${Math.min(1, week / target) * 100}%`;
  const moved = movedLast7();
  setText('[data-moved]', state.log.length ? `Moved ${moved} of the last 7 days.` : 'Your journey starts today.');

  renderCalendar();
  renderRecent();
  renderGearEditors();
  renderDavisEditors();
  fillFields();
}

/* ---------- Setup flow ---------- */

function finishSetup() {
  state.setupDone = true;
  state.journey.startedOn = state.journey.startedOn || dateKey();
  saveState();
  openScreen('checkin');
  toast('Your journey has started. Workout 1 is up.');
}

/* ---------- Back up and restore ---------- */

async function backUp() {
  const file = new File([backupBlob()], `sunrise-backup-${dateKey()}.json`, { type: 'application/json' });
  // On iPhone, the share sheet offers "Save to Files".
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sunrise backup' }); }
    catch (e) { if (e.name !== 'AbortError') toast('Backup did not finish. Try again.'); }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('restore-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const { exportedAt, data } = parseBackup(await file.text());
    const when = exportedAt ? new Date(exportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'an earlier date';
    if (!confirm(`Replace what's on this phone with your backup from ${when}?`)) return;
    state = data;
    saveState();
    openScreen(state.setupDone ? 'checkin' : 'welcome');
    toast('Backup restored');
  } catch (e) {
    toast("That file isn't a Sunrise backup");
  }
});

/* ---------- Taps ---------- */

document.addEventListener('click', event => {
  const t = event.target;
  const go = t.closest('[data-go]');
  if (go) return openScreen(go.dataset.go);

  const next = t.closest('[data-next]');
  if (next && next.dataset.next === 'you') {
    const name = document.querySelector('#setup-you [data-field="profile.name"]');
    state.profile.name = name.value.trim();
    saveState();
    if (!state.profile.name) {
      document.getElementById('you-error').textContent = 'Add your name so Sunrise can greet you.';
      return name.focus();
    }
    document.getElementById('you-error').textContent = '';
    return openScreen('setup-gear');
  }

  if (t.closest('[data-finish-setup]')) return finishSetup();

  const add = t.closest('[data-gear-add]');
  if (add) return addGear(add);
  const remove = t.closest('[data-gear-remove]');
  if (remove) return removeGear(remove.dataset.gearRemove);

  if (t.closest('[data-backup]')) return backUp();
  if (t.closest('[data-restore]')) return document.getElementById('restore-file').click();

  const soon = t.closest('[data-soon]');
  if (soon) return toast(soon.dataset.soon);

  const plan = t.closest('[data-plan]');
  if (plan) {
    document.querySelectorAll('.choice').forEach(b => b.classList.toggle('selected', b === plan));
    document.getElementById('plan-status').textContent = plan.dataset.plan;
  }
});

/* ---------- Start ---------- */

document.getElementById('version').textContent = VERSION;
openScreen(new URLSearchParams(location.search).get('screen') || 'checkin');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
