// The exercise library (brief section 4.5) and how today's workout is picked.
//
// Each move:
//   floor     true for floor moves (they go last, so the TV stays in view longer)
//   shoulder  shoulder-flagged: capped at the lightest weight, progresses slowly
//   gear      'db' dumbbell, 'kb' kettlebell (falls back to a dumbbell), or null
//   requires  gear that must be owned for the move to be picked at all
//   weighted  which versions use a weight (default: all, when gear is set)
//   oneWeight uses a single dumbbell, even when a pair is owned
//   level     starting weight level: light, medium, heavy
//   video     "Watch how" link to a physical therapist or trainer demo (null = none yet)
// No overhead pressing in v1.

const DEFAULT_VERSIONS = { easier: 'Gentle range', standard: 'Comfortable range', harder: 'Deeper range, longer holds' };

const MOVES = [
  // ---------- Shoulders & Posture ----------
  { id: 'wall-slides', name: 'Wall slides', type: 'Shoulders & Posture', floor: false, shoulder: true, gear: null,
    versions: { easier: 'Small range, back on the wall', standard: 'Full range, back on the wall', harder: 'Slow 3-second lowering' },
    cues: ['Keep your back and head gently against the wall.', 'Slide your arms up without shrugging.', 'Lower slowly and keep breathing.'],
    video: 'https://library.theprehabguys.com/vimeo-video/multi-directional-wall-slides' },
  { id: 'chin-tucks', name: 'Chin tucks', type: 'Shoulders & Posture', floor: false, shoulder: false, gear: null,
    versions: { easier: 'Back against a wall', standard: 'Standing tall', harder: 'Hold each tuck 5 seconds' },
    cues: ['Stand tall with your eyes level.', 'Glide your chin straight back, like making a double chin.', 'Hold for a breath, then relax.'],
    video: 'https://www.ptprogress.com/chin-tuck-exercise/' },
  { id: 'scap-wall-pushups', name: 'Scapular wall push-ups', type: 'Shoulders & Posture', floor: false, shoulder: true, gear: null,
    versions: { easier: 'Close to the wall', standard: 'Arm’s length from the wall', harder: 'Hands on a counter' },
    cues: ['Arms straight, hands on the wall at shoulder height.', 'Let your chest sink between your shoulder blades.', 'Push the wall away to spread your shoulder blades.'],
    video: 'https://library.theprehabguys.com/vimeo-video/push-up-plus-wall/' },
  { id: 'db-row', name: 'Dumbbell bent-over row', type: 'Shoulders & Posture', floor: false, shoulder: false, gear: 'db', requires: 'db', level: 'medium',
    versions: { easier: 'One arm, other hand on a counter', standard: 'Both arms, hinged forward', harder: 'Both arms, 2-second hold at the top' },
    cues: ['Hinge at your hips with a long, flat back.', 'Pull your elbows toward your back pockets.', 'Lower the weights with control.'],
    video: null },
  { id: 'reverse-fly', name: 'Reverse fly', type: 'Shoulders & Posture', floor: false, shoulder: true, gear: 'db', requires: 'db', level: 'light',
    weighted: ['standard', 'harder'],
    versions: { easier: 'No weight, arms only', standard: 'Light dumbbells', harder: 'Light dumbbells, slow 3-second lowering' },
    cues: ['Hinge forward with soft elbows.', 'Open your arms wide without shrugging.', 'Squeeze your shoulder blades, then lower slowly.'],
    video: 'https://us.physitrack.com/home-exercise-video/bent-over-dumbbell-fly' },
  { id: 'prone-ytw', name: 'Prone Y-T-W raises', type: 'Shoulders & Posture', floor: true, shoulder: true, gear: null,
    versions: { easier: 'Y and T only', standard: 'Y, T, and W', harder: 'Hold each letter 3 seconds' },
    cues: ['Lie face down, forehead resting on a folded towel.', 'Lift your arms a few inches, thumbs up.', 'Keep your neck long and shoulders away from your ears.'],
    video: 'https://library.theprehabguys.com/vimeo-video/prone-ys-unsupported/' },

  // ---------- Lower Body ----------
  { id: 'squat', name: 'Squat', type: 'Lower Body', floor: false, shoulder: false, gear: 'db', oneWeight: true, level: 'medium', weighted: ['harder'],
    versions: { easier: 'Sit-to-stand from a chair', standard: 'Bodyweight squat', harder: 'Goblet squat, holding one weight' },
    cues: ['Feet hip-width, toes slightly out.', 'Sit back like you are reaching for a chair.', 'Push through your whole foot to stand.'],
    video: null },
  { id: 'reverse-lunge', name: 'Reverse lunge', type: 'Lower Body', floor: false, shoulder: false, gear: 'db', level: 'light', weighted: ['harder'],
    versions: { easier: 'Hold a counter for balance', standard: 'Hands on hips', harder: 'Holding dumbbells' },
    cues: ['Step one foot back and lower gently.', 'Keep your front knee over your ankle.', 'Push through the front heel to come back up.'],
    video: null },
  { id: 'rdl', name: 'Romanian deadlift', type: 'Lower Body', floor: false, shoulder: false, gear: 'db', requires: 'db', level: 'medium',
    versions: { easier: 'Small range', standard: 'Full range', harder: 'Single leg, holding a counter' },
    cues: ['Soft knees, push your hips back.', 'Keep the weights close to your legs.', 'Squeeze your glutes to stand tall.'],
    video: null },
  { id: 'step-ups', name: 'Step-ups', type: 'Lower Body', floor: false, shoulder: false, gear: 'db', level: 'light', weighted: ['harder'],
    versions: { easier: 'Low step, hold a rail', standard: 'Bottom stair', harder: 'Bottom stair, holding dumbbells' },
    cues: ['Place your whole foot on the step.', 'Drive through that heel to stand up.', 'Step down slowly.'],
    video: null },
  { id: 'calf-raises', name: 'Calf raises', type: 'Lower Body', floor: false, shoulder: false, gear: null,
    versions: { easier: 'Hold a counter', standard: 'Both feet, no support', harder: 'One foot at a time' },
    cues: ['Rise onto the balls of your feet.', 'Pause at the top.', 'Lower slowly all the way down.'],
    video: null },
  { id: 'glute-bridge', name: 'Glute bridge', type: 'Lower Body', floor: true, shoulder: false, gear: null,
    versions: { easier: 'Small lift', standard: 'Full bridge', harder: 'Single-leg bridge' },
    cues: ['Lie on your back, knees bent, feet flat.', 'Press through your heels to lift your hips.', 'Pause at the top, then lower slowly.'],
    video: null },

  // ---------- Upper Body (shoulder-safe) ----------
  { id: 'incline-pushup', name: 'Incline push-up', type: 'Upper Body', floor: false, shoulder: false, gear: null,
    versions: { easier: 'Wall push-up', standard: 'Counter push-up', harder: 'Knee push-up on the floor' },
    cues: ['Hands a little wider than your shoulders.', 'Keep a straight line from head to heels.', 'Lower your chest, then press away.'],
    video: null },
  { id: 'one-arm-row', name: 'Single-arm dumbbell row', type: 'Upper Body', floor: false, shoulder: false, gear: 'db', oneWeight: true, requires: 'db', level: 'medium',
    versions: { easier: 'Hand on a chair', standard: 'Hand on a counter', harder: 'Pause 2 seconds at the top' },
    cues: ['Brace one hand on a chair or counter.', 'Pull the weight toward your hip.', 'Lower with control. Switch sides each round.'],
    video: null },
  { id: 'bicep-curl', name: 'Bicep curl', type: 'Upper Body', floor: false, shoulder: false, gear: 'db', requires: 'db', level: 'light',
    versions: { easier: 'Alternating arms', standard: 'Both arms', harder: 'Slow 3-second lowering' },
    cues: ['Elbows tucked at your sides.', 'Curl up without swinging.', 'Lower slowly.'],
    video: null },
  { id: 'tricep-kickback', name: 'Tricep kickback', type: 'Upper Body', floor: false, shoulder: false, gear: 'db', requires: 'db', level: 'light',
    versions: { easier: 'One arm, hand on a counter', standard: 'Both arms, hinged forward', harder: 'Pause 1 second at the top' },
    cues: ['Hinge forward, elbows high by your ribs.', 'Straighten your arms back.', 'Only your forearms move.'],
    video: null },
  { id: 'kb-deadlift', name: 'Kettlebell deadlift', type: 'Upper Body', floor: false, shoulder: false, gear: 'kb', requires: 'any', level: 'heavy',
    versions: { easier: 'Weight on a step, small range', standard: 'Weight from the floor', harder: 'Pause at the top' },
    cues: ['Weight between your feet.', 'Hinge back with a flat back and grab the handle.', 'Stand tall by squeezing your glutes.'],
    video: null },
  { id: 'floor-press', name: 'Dumbbell floor press', type: 'Upper Body', floor: true, shoulder: false, gear: 'db', requires: 'db', level: 'medium',
    versions: { easier: 'One arm at a time', standard: 'Both arms', harder: 'Slow 3-second lowering' },
    cues: ['Lie on your back, knees bent, elbows on the floor.', 'Press the weights up over your chest.', 'Lower until your upper arms touch the floor.'],
    video: null },

  // ---------- Core ----------
  { id: 'knee-drives', name: 'Standing knee drives', type: 'Core', floor: false, shoulder: false, gear: null,
    versions: { easier: 'Slow march', standard: 'Knee toward the opposite hand', harder: 'Quicker pace' },
    cues: ['Stand tall, hands at your chest.', 'Lift one knee toward your middle.', 'Brace your stomach the whole time.'],
    video: null },
  { id: 'side-bends', name: 'Standing side bends', type: 'Core', floor: false, shoulder: false, gear: 'db', oneWeight: true, level: 'light', weighted: ['standard', 'harder'],
    versions: { easier: 'No weight', standard: 'One light dumbbell', harder: 'Slow 3-second return' },
    cues: ['Feet hip-width, weight in one hand.', 'Lean sideways toward the weight, then return.', 'Switch sides each round.'],
    video: null },
  { id: 'dead-bug', name: 'Dead bug', type: 'Core', floor: true, shoulder: false, gear: null,
    versions: { easier: 'Legs only', standard: 'Opposite arm and leg', harder: 'Slow 3-second reach' },
    cues: ['Lie on your back, arms up, knees over hips.', 'Press your lower back into the floor.', 'Reach the opposite arm and leg away, then switch.'],
    video: 'https://library.theprehabguys.com/vimeo-video/episode-689-dead-bug-form/' },
  { id: 'bird-dog', name: 'Bird dog', type: 'Core', floor: true, shoulder: false, gear: null,
    versions: { easier: 'Arms only or legs only', standard: 'Opposite arm and leg', harder: 'Hold each reach 3 seconds' },
    cues: ['Hands under shoulders, knees under hips.', 'Reach one arm and the opposite leg long.', 'Keep your hips level.'],
    video: 'https://catalystathletics.com/exercise/491/Bird-Dog' },
  { id: 'plank', name: 'Plank', type: 'Core', floor: true, shoulder: false, gear: null,
    versions: { easier: 'Incline plank, hands on a counter', standard: 'Forearm plank, knees down', harder: 'Forearm plank' },
    cues: ['Elbows under shoulders.', 'Straight line from head to knees or heels.', 'Breathe and brace.'],
    video: null },
  { id: 'side-plank', name: 'Side plank', type: 'Core', floor: true, shoulder: false, gear: null,
    versions: { easier: 'Bent knees', standard: 'Bent knees, top arm up', harder: 'Straight legs' },
    cues: ['Elbow under shoulder.', 'Lift your hips into a straight line.', 'Switch sides halfway.'],
    video: null },

  // ---------- Mobility & Stretch ----------
  { id: 'doorway-stretch', name: 'Doorway chest stretch', type: 'Mobility & Stretch', floor: false, shoulder: false, gear: null,
    cues: ['Forearms on the door frame, elbows at shoulder height.', 'Step one foot through gently.', 'Feel a stretch across your chest. Stop if you feel tingling.'],
    video: 'https://theprehabguys.com/vimeo-video/pec-minor-stretch-doorway/' },
  { id: 'neck-stretch', name: 'Upper trap and neck stretch', type: 'Mobility & Stretch', floor: false, shoulder: false, gear: null,
    cues: ['Sit or stand tall.', 'Tilt one ear toward your shoulder.', 'Keep the other shoulder relaxed. Switch sides halfway.'],
    video: null },
  { id: 'cat-cow', name: 'Cat-cow', type: 'Mobility & Stretch', floor: true, shoulder: false, gear: null,
    cues: ['Hands under shoulders, knees under hips.', 'Round your back up, then let it sag gently.', 'Move with your breath.'],
    video: null },
  { id: 'open-books', name: 'Thoracic open books', type: 'Mobility & Stretch', floor: true, shoulder: false, gear: null,
    cues: ['Lie on your side, knees bent, arms forward.', 'Open your top arm across, like opening a book.', 'Follow your hand with your eyes. Switch sides halfway.'],
    video: 'https://library.theprehabguys.com/vimeo-video/open-book/' },
  { id: 'low-lunge-reach', name: 'Low lunge with reach', type: 'Mobility & Stretch', floor: true, shoulder: false, gear: null,
    cues: ['Kneel in a lunge, back knee on the mat.', 'Shift forward gently.', 'Reach the same-side arm up and over. Switch sides halfway.'],
    video: null },
  { id: 'hip-flexor', name: 'Hip flexor stretch', type: 'Mobility & Stretch', floor: true, shoulder: false, gear: null,
    cues: ['Half-kneel with the back knee padded.', 'Tuck your tailbone under.', 'Shift forward until you feel the front of the hip. Switch sides halfway.'],
    video: null },
  { id: 'childs-pose', name: 'Child’s pose', type: 'Mobility & Stretch', floor: true, shoulder: false, gear: null,
    cues: ['Knees wide, sit back toward your heels.', 'Walk your hands forward.', 'Breathe into your back.'],
    video: null },
  { id: 'hips-9090', name: '90/90 hips', type: 'Mobility & Stretch', floor: true, shoulder: false, gear: null,
    cues: ['Sit with both knees bent at 90 degrees.', 'Sit tall over your front hip.', 'Switch sides slowly halfway.'],
    video: null }
];

const WARMUPS = [
  { name: 'March in place', cue: 'Easy pace, swing your arms.' },
  { name: 'Shoulder rolls', cue: 'Big slow circles, backward.' },
  { name: 'Small arm circles', cue: 'Arms out to the sides, small circles.' },
  { name: 'Hip circles', cue: 'Hands on hips, slow circles both ways.' },
  { name: 'Torso twists', cue: 'Gentle turns side to side.' }
];

const COOLDOWN_BY_TYPE = {
  'Shoulders & Posture': 'neck-stretch',
  'Lower Body': 'hip-flexor',
  'Upper Body': 'childs-pose',
  'Core': 'childs-pose',
  'Mobility & Stretch': 'childs-pose'
};

const MOVE_BY_ID = Object.fromEntries(MOVES.map(m => [m.id, m]));
const VERSION_LABEL = { easier: 'Easier version', standard: 'Standard version', harder: 'Harder version' };

function versionsOf(move) { return move.versions || DEFAULT_VERSIONS; }

/* ---------- Journey phase (brief 4.7) ---------- */

function phaseFor(number) {
  if (number <= 21) return { version: 'easier', workSecs: 40 };
  if (number <= 49) return { version: 'standard', workSecs: 45 };
  // Harder versions where rated "just right" arrive with ratings (step 5).
  return { version: 'standard', workSecs: 45 };
}

/* ---------- Weights (brief 4.6) ---------- */

const LEVEL_TARGET_LB = { light: 0, medium: 10, heavy: 20 };

function closest(weights, target) {
  return weights.reduce((best, w) => Math.abs(w - target) < Math.abs(best - target) ? w : best);
}

// Returns { lb, pair, kind } or null for bodyweight.
function suggestWeight(move, version) {
  if (!move.gear) return null;
  if (move.weighted && !move.weighted.includes(version)) return null;
  const eq = state.equipment;
  // Shoulder-flagged moves are capped at the lightest weight.
  const level = move.shoulder ? 'light' : (move.level || 'light');
  const target = LEVEL_TARGET_LB[level];

  if (move.gear === 'kb' && eq.kettlebells.length) {
    return { lb: closest(eq.kettlebells, target), kind: 'kb' };
  }
  if (!eq.dumbbells.length) return null;
  // Two-handed moves prefer pairs, but a single works for one-arm and goblet moves.
  const pairs = eq.dumbbells.filter(d => d.pair);
  const pool = (pairs.length ? pairs : eq.dumbbells).map(d => d.lb);
  const lb = level === 'light' ? Math.min(...pool) : closest(pool, target);
  const pair = eq.dumbbells.some(d => d.lb === lb && d.pair);
  return { lb, pair, kind: 'db' };
}

function weightText(weight) {
  if (!weight) return 'no weight';
  if (weight.kind === 'kb') return `${weight.lb} lb kettlebell`;
  return weight.pair ? `${weight.lb} lb each hand` : `${weight.lb} lb`;
}

/* ---------- What to gather before starting ---------- */

// Household things a move might need. Found in the text of today's version;
// props marked fromCues are also found in the form cues ("step" and "chair"
// are not, since cues use them loosely, like "step one foot back").
const PROPS = [
  { key: 'chair', words: ['chair'], label: 'A sturdy chair' },
  { key: 'counter', words: ['counter'], label: 'A counter or table to lean on' },
  { key: 'step', words: ['step', 'stair', 'rail'], label: 'A step or the bottom stair' },
  { key: 'wall', words: ['wall'], label: 'A clear spot on a wall', fromCues: true },
  { key: 'towel', words: ['towel', 'padded'], label: 'A small towel', fromCues: true },
  { key: 'doorway', words: ['door frame', 'doorway'], label: 'A doorway, for the chest stretch', fromCues: true }
];

function gatherList(plan) {
  const items = [];
  // Weights, lightest first. A pair is only listed when a move uses both hands.
  const weights = new Map();
  for (const { move, weight } of plan.moves) {
    if (!weight) continue;
    const key = `${weight.kind}-${weight.lb}`;
    const both = weight.kind === 'db' && weight.pair && !move.oneWeight;
    const label = weight.kind === 'kb' ? `${weight.lb} lb kettlebell`
      : both ? `Pair of ${weight.lb} lb dumbbells` : `One ${weight.lb} lb dumbbell`;
    if (!weights.has(key) || both) weights.set(key, { lb: weight.lb, label });
  }
  [...weights.entries()].sort((a, b) => a[1].lb - b[1].lb)
    .forEach(([key, w]) => items.push({ key: `weight-${key}`, label: w.label }));

  const allMoves = [...plan.moves.map(m => m.move), ...plan.cooldown];
  if (state.equipment.mat && allMoves.some(m => m.floor)) items.push({ key: 'mat', label: 'Yoga mat' });

  const versionText = plan.moves.map(({ move, version }) => versionsOf(move)[version]).join(' ').toLowerCase();
  const cueText = [...plan.moves.map(m => m.move), ...plan.cooldown].map(m => m.cues.join(' ')).join(' ').toLowerCase();
  for (const prop of PROPS) {
    const text = prop.fromCues ? versionText + ' ' + cueText : versionText;
    if (prop.words.some(w => text.includes(w))) items.push({ key: prop.key, label: prop.label });
  }

  items.push({ key: 'water', label: 'A glass of water' });
  return items;
}

/* ---------- Workout lengths ---------- */

const LENGTHS = {
  // restSecs: null means use the Rest between moves setting.
  full:    { label: '15 min', name: 'Full workout', warmups: 4, rounds: 3, restSecs: null, cooldown: 2, rate: true },
  restart: { label: '10 min', name: '10-minute restart', warmups: 2, rounds: 2, restSecs: null, cooldown: 1, rate: true },
  // Short day: quick 5-second switches, so no ratings.
  short:   { label: '5 min', name: '5-minute workout', warmups: 1, rounds: 2, restSecs: 5, cooldown: 1, rate: false, workSecs: 25 }
};

// Today's length: picked on the Today screen, else from the check-in, else full.
function todayLength() {
  const chosen = todayState().length;
  if (chosen) return chosen;
  const plan = state.dayPlans[dateKey()];
  if (plan && plan.choice === 'short') return 'short';
  if (missedBeforeToday() === 2) return 'restart';
  return 'full';
}

/* ---------- Picking today's workout ---------- */

function hasGear(move) {
  const eq = state.equipment;
  if (move.requires === 'db') return eq.dumbbells.length > 0;
  if (move.requires === 'any') return eq.dumbbells.length > 0 || eq.kettlebells.length > 0;
  return true;
}

function todayState() {
  if (!state.today || state.today.date !== dateKey()) {
    state.today = { date: dateKey(), typeOverride: null, versions: {} };
  }
  return state.today;
}

function todayType() { return todayState().typeOverride || nextDayType(); }

function planWorkout(length = todayLength()) {
  const shape = LENGTHS[length];
  const type = todayType();
  const number = nextWorkoutNumber();
  const phase = phaseFor(number);
  const paused = state.pausedMoves || {};

  const eligible = MOVES.filter(m => m.type === type && !paused[m.id] && hasGear(m));
  // Rotate through the moves across visits to this day type, two moves at a time.
  const visits = workouts().filter(w => w.type === type).length;
  const start = eligible.length ? (visits * 2) % eligible.length : 0;
  const picked = [];
  for (let i = 0; i < Math.min(4, eligible.length); i++) picked.push(eligible[(start + i) % eligible.length]);
  // TV-friendly order: standing moves first, floor moves last.
  picked.sort((a, b) => a.floor - b.floor);

  const overrides = todayState().versions;
  const moves = picked.map(move => {
    // A version picked in Preview wins for today.
    const set = settingsFor(move, number, overrides[move.id]);
    return { move, version: set.version, weight: set.weight, secs: shape.workSecs || phase.workSecs + set.extraSecs };
  });

  const cooldown = [MOVE_BY_ID['doorway-stretch'], MOVE_BY_ID[COOLDOWN_BY_TYPE[type]]].slice(0, shape.cooldown);
  const warmups = Array.from({ length: shape.warmups }, (_, i) => WARMUPS[(number + i) % WARMUPS.length]);

  return { type, number, length, lengthLabel: shape.label, rounds: shape.rounds, rate: shape.rate,
           workSecs: shape.workSecs || phase.workSecs, restSecs: shape.restSecs || Number(state.prefs.restSecs) || 30, moves, warmups, cooldown,
           shoulderDay: moves.some(m => m.move.shoulder) || type === 'Shoulders & Posture' };
}
