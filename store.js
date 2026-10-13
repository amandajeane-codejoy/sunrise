// Everything Sunrise knows lives in one object, saved on the phone in localStorage.
const STORE_KEY = 'sunrise.v1';
const JOURNEY_LENGTH = 70;
const DAY_TYPES = ['Shoulders & Posture', 'Lower Body', 'Upper Body', 'Core', 'Mobility & Stretch'];

function defaultState() {
  return {
    schema: 1,
    setupDone: false,
    profile: { name: '', why: 'Feel strong for real life and undo desk posture.', weeklyTarget: 3 },
    equipment: { mat: true, dumbbells: [], kettlebells: [], other: [] },
    davis: { name: 'Davis', phone: '', weeklySummary: true, twoDayAlert: true },
    reminders: { checkinTime: '05:55' },
    journey: { number: 1, startedOn: null, queueIndex: 0 },
    prefs: { voice: false },
    // Today's choices: { date, typeOverride, versions: { moveId: 'easier' } }
    today: null,
    // Moves paused after "I hurt myself": { moveId: { date, area } }
    pausedMoves: {},
    // When true, shoulder moves stop progressing until turned back on in Settings.
    shoulderHold: false,
    // One entry per logged day: { date: 'YYYY-MM-DD', kind: 'workout' | 'walk' | 'rest', type, number }
    log: []
  };
}

// Fill in any fields a saved copy is missing, so older saves keep working.
function withDefaults(saved) {
  const base = defaultState();
  for (const key of Object.keys(base)) {
    if (!(key in saved)) continue;
    const isObject = base[key] && typeof base[key] === 'object' && !Array.isArray(base[key]);
    base[key] = isObject ? { ...base[key], ...saved[key] } : saved[key];
  }
  return base;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch (e) { /* fall through to a fresh start */ }
  return defaultState();
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// Ask the phone to keep our data even when storage runs low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Dates ---------- */

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d = new Date()) { // Monday
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

/* ---------- Derived numbers (never stored, so they can't drift) ---------- */

function workouts() { return state.log.filter(e => e.kind === 'workout'); }

function workoutsDone() { return workouts().length; }

function nextWorkoutNumber() { return Math.min(workoutsDone() + 1, JOURNEY_LENGTH); }

function nextDayType() { return DAY_TYPES[state.journey.queueIndex % DAY_TYPES.length]; }

function weekCount() {
  const start = dateKey(startOfWeek());
  return workouts().filter(e => e.date >= start).length;
}

function monthCount() {
  const prefix = dateKey().slice(0, 7);
  return workouts().filter(e => e.date.startsWith(prefix)).length;
}

function movedLast7() {
  const days = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.add(dateKey(d));
  }
  const moved = new Set(state.log.filter(e => (e.kind === 'workout' || e.kind === 'walk') && days.has(e.date)).map(e => e.date));
  return moved.size;
}

/* ---------- Recording ---------- */

// Saves a finished (or partly finished) workout. Partial workouts still count.
function recordWorkout(plan, { partial = false } = {}) {
  const entry = {
    date: dateKey(),
    kind: 'workout',
    type: plan.type,
    number: workoutsDone() + 1,
    partial,
    moves: plan.moves.map(m => ({ id: m.move.id, version: m.version, lb: m.weight ? m.weight.lb : null }))
  };
  state.log.push(entry);
  // The queue moves on unless today's type was swapped in by hand.
  if (!state.today || !state.today.typeOverride) state.journey.queueIndex += 1;
  if (state.today) state.today.typeOverride = null;
  saveState();
  return entry;
}

/* ---------- Equipment helpers ---------- */

function lightestDumbbell() {
  const w = state.equipment.dumbbells.map(d => d.lb);
  return w.length ? Math.min(...w) : null;
}

function gearSummary() {
  const parts = [];
  if (state.equipment.mat) parts.push('mat');
  if (state.equipment.dumbbells.length) parts.push('light dumbbells');
  return parts.length ? parts.join(' + ') : 'no gear needed';
}

/* ---------- Back up and restore ---------- */

function backupBlob() {
  const payload = { app: 'sunrise', exportedAt: new Date().toISOString(), data: state };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

function parseBackup(text) {
  const payload = JSON.parse(text);
  if (!payload || payload.app !== 'sunrise' || !payload.data) throw new Error('not a Sunrise backup');
  return { exportedAt: payload.exportedAt, data: withDefaults(payload.data) };
}
