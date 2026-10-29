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
    // restSecs: rest between moves in full and restart workouts.
    prefs: { voice: false, restSecs: 30 },
    // Today's choices: { date, typeOverride, versions: { moveId: 'easier' }, length }
    today: null,
    // Check-in answers by date: { 'YYYY-MM-DD': { choice: 'now'|'later'|'walk'|'short'|'rest', time, reason } }
    dayPlans: {},
    // Moves paused after "I hurt myself": { moveId: { date, area } }
    pausedMoves: {},
    // When true, shoulder moves stop progressing until turned back on in Settings.
    shoulderHold: false,
    // Per-move weights and versions, shaped by ratings (see progression.js).
    moveProgress: {},
    // Earlier journeys, kept when restarting so nothing is truly lost.
    archive: [],
    // Logged activity: { date: 'YYYY-MM-DD', kind: 'workout' | 'walk', type, number, length }
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

function addDays(key, n) {
  const d = new Date(key + 'T12:00');
  d.setDate(d.getDate() + n);
  return dateKey(d);
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

/* ---------- Days: what happened on each date ---------- */

// 'work', 'walk', 'rest', or null. Planned walks count as active rest.
function dayStatus(key) {
  if (state.log.some(e => e.date === key && e.kind === 'workout')) return 'work';
  const plan = state.dayPlans[key];
  if (state.log.some(e => e.date === key && e.kind === 'walk') || (plan && plan.choice === 'walk')) return 'walk';
  if (plan && plan.choice === 'rest') return 'rest';
  return null;
}

// A missed day: a past day in the journey with no workout, walk, or planned rest.
function isMissed(key) {
  const start = state.journey.startedOn;
  return !!start && key >= start && key < dateKey() && dayStatus(key) === null;
}

// "Never two in a row": 0, 1, or 2 missed days right before today.
function missedBeforeToday() {
  const yesterday = addDays(dateKey(), -1);
  if (!isMissed(yesterday)) return 0;
  return isMissed(addDays(yesterday, -1)) ? 2 : 1;
}

function setDayPlan(key, plan) {
  if (plan) state.dayPlans[key] = plan; else delete state.dayPlans[key];
  saveState();
}

function logWalk(key = dateKey()) {
  if (!state.log.some(e => e.date === key && e.kind === 'walk')) state.log.push({ date: key, kind: 'walk' });
  saveState();
}

/* ---------- Recording ---------- */

// Saves a finished (or partly finished) workout. Partial workouts still count.
function recordWorkout(plan, { partial = false } = {}) {
  const entry = {
    date: dateKey(),
    kind: 'workout',
    type: plan.type,
    number: workoutsDone() + 1,
    length: plan.length,
    partial,
    moves: plan.moves.map(m => ({ id: m.move.id, version: m.version, lb: m.weight ? m.weight.lb : null, rating: m.rating || null }))
  };
  state.log.push(entry);
  // The queue moves on unless today's type was swapped in by hand.
  if (!state.today || !state.today.typeOverride) state.journey.queueIndex += 1;
  if (state.today) state.today.typeOverride = null;
  saveState();
  return entry;
}

// Starts the journey over at Workout 1. Setup and paused moves stay.
// The old workouts are kept in the archive, in case of a mistake.
function restartJourney() {
  state.archive.push({ restartedOn: dateKey(), journey: state.journey, log: state.log, moveProgress: state.moveProgress });
  state.log = [];
  state.moveProgress = {};
  state.journey = { number: state.journey.number, startedOn: dateKey(), queueIndex: 0 };
  state.today = null;
  saveState();
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
