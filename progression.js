// How ratings change the next workout (brief 4.6 and 4.7).
//
// Saved per move in state.moveProgress[moveId]:
//   lb           the weight to use next time (null = use the suggested starting weight)
//   versionStep  how many versions above or below the journey phase's default
//   extraSecs    extra work time, added before a big jump in weight (0, 5, or 10)
//   easyStreak   "too easy" ratings in a row
//   lastRating   'easy' | 'right' | 'hard'
//   history      [{ date, lb, version, rating }]

const VERSION_ORDER = ['easier', 'standard', 'harder'];
const BIG_JUMP = 0.3;          // a jump of more than 30% counts as large
const EASY_TO_STEP_UP = 2;     // "too easy" twice in a row moves a move up
const EASY_TO_STEP_UP_SHOULDER = 3; // shoulder moves progress more slowly

function progressFor(moveId) {
  if (!state.moveProgress[moveId]) {
    state.moveProgress[moveId] = { lb: null, versionStep: 0, extraSecs: 0, easyStreak: 0, lastRating: null, history: [] };
  }
  return state.moveProgress[moveId];
}

// Every weight the user owns that fits this move, lightest first.
function ownedWeightsFor(move) {
  const eq = state.equipment;
  if (move.gear === 'kb' && eq.kettlebells.length) return eq.kettlebells.map(lb => ({ lb, kind: 'kb' }));
  const byLb = new Map();
  for (const d of eq.dumbbells) {
    if (!byLb.has(d.lb) || d.pair) byLb.set(d.lb, { lb: d.lb, pair: d.pair, kind: 'db' });
  }
  return [...byLb.values()].sort((a, b) => a.lb - b.lb);
}

function ownedClosestTo(move, lb) {
  const owned = ownedWeightsFor(move);
  if (!owned.length) return null;
  return owned.reduce((best, w) => Math.abs(w.lb - lb) < Math.abs(best.lb - lb) ? w : best);
}

function neighborWeight(move, lb, direction) {
  const owned = ownedWeightsFor(move);
  return direction > 0 ? owned.find(w => w.lb > lb) || null : [...owned].reverse().find(w => w.lb < lb) || null;
}

// The version, weight, and work time for a move in a given workout.
function settingsFor(move, number, chosenVersion) {
  const prog = state.moveProgress[move.id] || {};
  const base = number <= 21 ? 0 : 1;                                  // easier, then standard
  const bonus = number >= 50 && prog.lastRating === 'right' ? 1 : 0;   // harder where "just right"
  const index = Math.max(0, Math.min(2, base + (prog.versionStep || 0) + bonus));
  const version = chosenVersion || VERSION_ORDER[index];

  let weight = suggestWeight(move, version);
  if (weight && prog.lb) weight = ownedClosestTo(move, prog.lb) || weight;
  return { version, weight, extraSecs: prog.extraSecs || 0 };
}

function stepUp(move, prog, used) {
  // Shoulder moves never add weight on their own; only a weight picked by hand.
  if (used.weight && !move.shoulder) {
    const up = neighborWeight(move, used.weight.lb, +1);
    if (up) {
      const big = (up.lb - used.weight.lb) / used.weight.lb > BIG_JUMP;
      if (big && !prog.extraSecs) { prog.extraSecs = 5; return 'adds 5 seconds'; }
      prog.lb = up.lb; prog.extraSecs = 0;
      return `goes up to ${up.lb} lb`;
    }
  }
  const index = VERSION_ORDER.indexOf(used.version);
  if (index < 2) { prog.versionStep += 1; return `moves to the ${VERSION_ORDER[index + 1]} version`; }
  if (prog.extraSecs < 10) { prog.extraSecs += 5; return 'adds 5 seconds'; }
  return null;
}

function stepDown(move, prog, used) {
  if (prog.extraSecs) { prog.extraSecs = 0; return 'goes back to normal time'; }
  if (used.weight) {
    const down = neighborWeight(move, used.weight.lb, -1);
    if (down) { prog.lb = down.lb; return `goes down to ${down.lb} lb`; }
  }
  const index = VERSION_ORDER.indexOf(used.version);
  if (index > 0) { prog.versionStep -= 1; return `moves to the ${VERSION_ORDER[index - 1]} version`; }
  return null;
}

// Applies one rating. Returns a short note about what changes next time, or null.
function applyRating(item, rating) {
  const { move } = item;
  const prog = progressFor(move.id);
  if (item.weight) prog.lb = item.weight.lb; // remember the weight actually used
  prog.lastRating = rating;
  prog.history.push({ date: dateKey(), lb: item.weight ? item.weight.lb : null, version: item.version, rating });
  if (prog.history.length > 60) prog.history.shift();

  let change = null;
  if (rating === 'easy') {
    prog.easyStreak += 1;
    const needed = move.shoulder ? EASY_TO_STEP_UP_SHOULDER : EASY_TO_STEP_UP;
    const held = move.shoulder && state.shoulderHold;
    if (prog.easyStreak >= needed && !held) {
      change = stepUp(move, prog, item);
      prog.easyStreak = 0;
    }
  } else {
    prog.easyStreak = 0;
    if (rating === 'hard') change = stepDown(move, prog, item);
  }
  return change ? `${move.name} ${change}` : null;
}

// For "Getting stronger": moves whose weight or version went up.
function strongerList() {
  const out = [];
  for (const [id, prog] of Object.entries(state.moveProgress)) {
    const move = MOVE_BY_ID[id];
    const h = prog.history || [];
    if (!move || h.length < 2) continue;
    const first = h[0], last = h[h.length - 1];
    if (first.lb && last.lb && last.lb > first.lb) out.push({ name: move.name, from: `${first.lb}`, to: `${last.lb} lb` });
    else if (VERSION_ORDER.indexOf(last.version) > VERSION_ORDER.indexOf(first.version)) {
      out.push({ name: move.name, from: first.version, to: last.version });
    }
  }
  return out;
}
