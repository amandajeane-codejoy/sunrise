// The workout itself: preview, the timed session (glance mode), End workout, and Done.

let session = null;     // the workout in progress
let lastResult = null;  // what just got saved, for the Okay, Hurt, and Done screens
let previewIndex = 0;

/* ---------- Sound, voice, and keeping the screen on ---------- */

let audioCtx = null;

// Must run inside a tap, or iPhone keeps the sound off.
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = audioCtx || new AC();
  audioCtx.resume();
  tone(440, 0.01, 0, 0.0001);
}

function tone(freq, secs, delay = 0, volume = 0.3) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + secs);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + secs + 0.05);
}

const SOUNDS = {
  tick: () => tone(660, 0.12, 0, 0.2),
  go: () => { tone(880, 0.15); tone(1320, 0.3, 0.16); },
  rest: () => { tone(660, 0.2); tone(440, 0.4, 0.22); },
  done: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, i * 0.15))
};

function buzz(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

function say(text) {
  if (!state.prefs.voice || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

let wakeLock = null;
async function keepAwake() {
  try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function letSleep() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !session) return;
  if (audioCtx) audioCtx.resume();
  if (!session.paused) keepAwake();
  tick();
});

/* ---------- Preview ---------- */

function openPreview(index = 0) {
  previewIndex = index;
  renderPreview();
  openScreen('preview');
}

function renderPreview() {
  const plan = planWorkout();
  const item = plan.moves[previewIndex];
  if (!item) return;
  const { move, version, weight } = item;
  const last = previewIndex === plan.moves.length - 1;

  document.getElementById('pv-position').textContent = `Preview · ${previewIndex + 1} of ${plan.moves.length}`;
  document.getElementById('pv-num').textContent = previewIndex + 1;
  const tag = document.getElementById('pv-tag');
  tag.textContent = move.floor ? 'FLOOR' : 'STAND';
  tag.className = 'tag' + (move.floor ? ' floor' : '');
  document.getElementById('pv-desc').textContent =
    [move.floor ? 'Floor' : 'Standing', weightText(weight), move.shoulder ? 'shoulder move' : ''].filter(Boolean).join(' · ');
  document.getElementById('pv-name').textContent = move.name;
  document.getElementById('pv-version').textContent = `${VERSION_LABEL[version]}: ${versionsOf(move)[version]}`;
  document.getElementById('pv-cues').innerHTML = move.cues.map((c, i) =>
    `<div class="cue"><b>0${i + 1}</b><span>${esc(c)}</span></div>`).join('');
  document.querySelectorAll('#preview .seg').forEach(b => b.classList.toggle('selected', b.dataset.version === version));

  const watch = document.getElementById('pv-watch');
  watch.hidden = !move.video;
  if (move.video) watch.href = move.video;
  document.getElementById('pv-next').textContent = last ? 'Start workout →' : 'Next move →';
}

function setVersion(version) {
  const { move } = planWorkout().moves[previewIndex];
  todayState().versions[move.id] = version;
  saveState();
  renderPreview();
}

/* ---------- The session ---------- */

function buildPhases(plan) {
  const phases = [];
  plan.warmups.forEach((w, i) => phases.push({ kind: 'warmup', secs: 30, name: w.name, detail: w.cue, index: i }));
  for (let round = 1; round <= plan.rounds; round++) {
    plan.moves.forEach((item, index) => {
      phases.push({ kind: 'work', secs: item.secs, item, round, index });
      const lastOfAll = round === plan.rounds && index === plan.moves.length - 1;
      if (!lastOfAll) phases.push({ kind: 'rest', secs: plan.restSecs, round, index });
    });
  }
  plan.cooldown.forEach((m, i) => phases.push({ kind: 'cooldown', secs: 30, name: m.name, detail: m.cues[0], index: i }));
  return phases;
}

function phaseTitle(p) {
  if (!p) return 'All done';
  if (p.kind === 'work') return p.item.move.name;
  if (p.kind === 'rest') return 'Rest';
  return p.name;
}

function nextActive(from) {
  for (let i = from + 1; i < session.phases.length; i++) {
    if (session.phases[i].kind !== 'rest') return session.phases[i];
  }
  return null;
}

function startWorkout() {
  unlockAudio();
  const plan = planWorkout();
  if (!plan.moves.length) return toast('No moves fit your equipment for this day type. Try a swap.');
  session = { plan, phases: buildPhases(plan), i: 0, paused: false, remainingMs: 0, shownSecs: null };
  session.phaseEnd = Date.now() + session.phases[0].secs * 1000;
  keepAwake();
  openScreen('glance');
  announce();
  session.timer = setInterval(tick, 200);
}

// Round 1 rests double as the quick rating, so each move gets rated once.
function isRatingRest(p) { return session.plan.rate && p.kind === 'rest' && p.round === 1; }

function announce() {
  const p = session.phases[session.i];
  if (isRatingRest(p)) {
    showRating(p);
  } else if (document.querySelector('.screen.active').id !== 'glance') {
    openScreen('glance');
  }
  if (p.kind === 'rest') {
    SOUNDS.rest(); buzz([300]);
    say(`Rest. Up next, ${phaseTitle(nextActive(session.i))}.`);
  } else {
    SOUNDS.go(); buzz([120, 80, 120]);
    say(p.kind === 'work' ? `Go. ${p.item.move.name}.` : p.name);
  }
  renderGlance();
}

function tick() {
  if (!session || session.paused) return;
  const now = Date.now();
  let moved = false;
  // Catch up if the phone was locked or the app was in the background.
  while (now >= session.phaseEnd) {
    session.i += 1;
    if (session.i >= session.phases.length) return finishWorkout();
    session.phaseEnd += session.phases[session.i].secs * 1000;
    moved = true;
  }
  if (moved) { session.shownSecs = null; announce(); return; }

  const secs = Math.ceil((session.phaseEnd - now) / 1000);
  if (secs !== session.shownSecs) {
    session.shownSecs = secs;
    if (secs <= 3 && secs > 0) SOUNDS.tick();
    renderTimer(secs);
  }
}

function renderTimer(secs) {
  const p = session.phases[session.i];
  const ring = document.getElementById('gl-ring');
  document.getElementById('gl-time').textContent = secs;
  document.getElementById('rt-rest').textContent = `REST · 0:${String(Math.max(0, secs)).padStart(2, '0')}`;
  ring.style.setProperty('--angle', `${(secs / p.secs) * 360}deg`);
  ring.setAttribute('aria-label', `${secs} seconds left`);
}

function renderGlance() {
  const p = session.phases[session.i];
  const total = session.plan.moves.length;
  const after = nextActive(session.i);

  const round = { warmup: 'WARM-UP', cooldown: 'COOLDOWN' }[p.kind] || `ROUND ${p.round} OF ${session.plan.rounds}`;
  const position = p.kind === 'warmup' ? `${p.index + 1} OF ${session.plan.warmups.length}`
    : p.kind === 'cooldown' ? `${p.index + 1} OF ${session.plan.cooldown.length}`
    : p.kind === 'rest' ? 'REST' : `MOVE ${p.index + 1} OF ${total}`;
  document.getElementById('gl-round').textContent = round;
  document.getElementById('gl-position').textContent = position;

  const label = { warmup: 'Warm-up', work: 'You’re doing', rest: 'Rest · up next', cooldown: 'Stretch' }[p.kind];
  document.getElementById('gl-label').textContent = label;
  document.getElementById('gl-name').textContent = phaseTitle(p.kind === 'rest' ? after : p);

  let detail = p.detail || '';
  if (p.kind === 'work') detail = `${VERSION_LABEL[p.item.version]} · ${weightText(p.item.weight)}`;
  if (p.kind === 'rest' && after && after.kind === 'work') detail = `${VERSION_LABEL[after.item.version]} · ${weightText(after.item.weight)}`;
  document.getElementById('gl-detail').textContent = detail;

  document.getElementById('gl-ring').classList.toggle('rest', p.kind === 'rest');
  // During rest the big name already shows what's next, so look one further.
  const later = p.kind === 'rest' ? nextActive(session.phases.indexOf(after)) : after;
  document.getElementById('gl-next').textContent = later
    ? phaseTitle(later) + (later.kind === 'work' ? ` · ${weightText(later.item.weight)}` : '')
    : 'Done!';
  document.getElementById('gl-pause').textContent = session.paused ? 'Resume' : 'Pause';
  document.getElementById('gl-more').hidden = p.kind !== 'rest';
  renderTimer(Math.ceil((session.paused ? session.remainingMs : session.phaseEnd - Date.now()) / 1000));
}

/* ---------- Quick rating ---------- */

function showRating(p) {
  const item = session.plan.moves[p.index];
  item.rating = item.rating || 'right';
  session.ratingItem = item;
  const next = session.plan.moves[p.index + 1] || session.plan.moves[0];
  document.getElementById('rt-question').textContent = `How did ${item.move.name.toLowerCase()} feel?`;
  document.getElementById('rt-next').textContent = `Next: ${next.move.name} →`;
  document.getElementById('rt-safety').hidden = !(item.move.shoulder || session.plan.shoulderDay);
  renderRatingChoices();
  openScreen('rating');
}

function renderRatingChoices() {
  const item = session.ratingItem;
  document.querySelectorAll('#rating [data-rating]').forEach(b => b.classList.toggle('selected', b.dataset.rating === item.rating));
  const owned = item.weight ? ownedWeightsFor(item.move) : [];
  document.getElementById('rt-weights-wrap').hidden = !owned.length;
  document.getElementById('rt-weights').innerHTML = owned.map(w =>
    `<button type="button" class="chip-btn weight${w.lb === item.weight.lb ? ' selected' : ''}" data-weight="${w.lb}">${w.lb} lb</button>`).join('');
}

function chooseWeight(lb) {
  const item = session.ratingItem;
  item.weight = ownedWeightsFor(item.move).find(w => w.lb === lb) || item.weight;
  renderRatingChoices();
}

// Turns this workout's ratings into changes for next time.
function applyRatings(plan) {
  const changes = [];
  for (const item of plan.moves) {
    if (!item.rating) continue;
    const note = applyRating(item, item.rating);
    if (note) changes.push(note);
  }
  return changes;
}

// Extra time during a rest, for moving to the stairs, changing weights, and so on.
function addRestTime() {
  if (!session) return;
  const p = session.phases[session.i];
  if (p.kind !== 'rest') return;
  p.secs += 15;
  if (session.paused) session.remainingMs += 15000; else session.phaseEnd += 15000;
  session.shownSecs = null;
  tick();
  if (session.paused) renderGlance();
  toast('+15 seconds');
}

function togglePause() {
  if (!session) return;
  if (session.paused) {
    session.paused = false;
    session.phaseEnd = Date.now() + session.remainingMs;
    keepAwake();
  } else {
    session.paused = true;
    session.remainingMs = Math.max(0, session.phaseEnd - Date.now());
    if (window.speechSynthesis) speechSynthesis.cancel();
  }
  renderGlance();
}

function skipPhase() {
  if (!session) return;
  session.i += 1;
  if (session.i >= session.phases.length) return finishWorkout();
  const secs = session.phases[session.i].secs * 1000;
  session.phaseEnd = Date.now() + secs;
  session.remainingMs = secs;
  session.shownSecs = null;
  announce();
}

// Stops the timer, sounds, voice, and screen-on, all at once.
function stopSession() {
  if (!session) return null;
  clearInterval(session.timer);
  if (window.speechSynthesis) speechSynthesis.cancel();
  letSleep();
  const stopped = session;
  session = null;
  return stopped;
}

function finishWorkout() {
  const s = stopSession();
  const changes = applyRatings(s.plan);
  const entry = recordWorkout(s.plan);
  SOUNDS.done();
  say(`Done. That's workout ${entry.number}.`);
  lastResult = { entry, partial: false, changes };
  openScreen('done');
}

// Emergency stop: one tap, no confirmation. Saves the workout as partial.
function endWorkout() {
  const s = stopSession();
  if (!s) return openScreen('checkin');
  const p = s.phases[s.i];
  const current = p.kind === 'work' ? p.item.move.id
    : p.kind === 'rest' ? s.plan.moves[p.index].move.id : s.plan.moves[0].move.id;
  const changes = applyRatings(s.plan);
  const entry = recordWorkout(s.plan, { partial: true });
  todayState().nudgesPaused = true;
  saveState();
  lastResult = { entry, partial: true, plan: s.plan, currentMoveId: current, changes };
  openScreen('okay');
}

/* ---------- Are you okay? ---------- */

function openHurt() {
  const select = document.getElementById('hurt-move');
  select.innerHTML = lastResult.plan.moves.map(({ move }) =>
    `<option value="${move.id}"${move.id === lastResult.currentMoveId ? ' selected' : ''}>${esc(move.name)}</option>`).join('');
  document.querySelectorAll('#hurt-area .chip-btn').forEach(b => b.classList.remove('selected'));
  const text = 'Your wife hurt something during her workout this morning and stopped early. She is resting it today. A check-in might be nice.';
  const phone = (state.davis.phone || '').replace(/[^\d+]/g, '');
  document.getElementById('hurt-text-davis').href = `sms:${phone}&body=${encodeURIComponent(text)}`;
  document.getElementById('hurt-text-davis').textContent = `Text ${state.davis.name || 'Davis'}`;
  openScreen('hurt');
}

function saveHurt() {
  const moveId = document.getElementById('hurt-move').value;
  const chosen = document.querySelector('#hurt-area .chip-btn.selected');
  const area = chosen ? chosen.dataset.area : 'Not sure';
  state.pausedMoves[moveId] = { date: dateKey(), area };
  if (MOVE_BY_ID[moveId].shoulder || ['Shoulder', 'Neck', 'Arm or hand'].includes(area)) state.shoulderHold = true;
  lastResult.entry.injury = { moveId, area };
  saveState();
  lastResult = null;
  openScreen('checkin');
  toast(`${MOVE_BY_ID[moveId].name} is paused. Rest up.`);
}

/* ---------- Done ---------- */

const MILESTONES = [10, 21, 35, 49, 60, 70];

function renderDone() {
  if (!lastResult) return;
  const { entry, partial } = lastResult;
  document.getElementById('dn-kicker').textContent = partial ? 'Partial workout · saved' : `${entry.type} · done`;
  document.getElementById('dn-title').textContent = `Workout ${entry.number}`;
  const morning = new Date().getHours() < 9;
  document.getElementById('dn-message').textContent = partial
    ? `Saved. That's workout ${entry.number}. Every bit counts.`
    : entry.length === 'short' ? `Done. That's workout ${entry.number}. Five minutes still counts.`
    : `Done. That's workout ${entry.number}. ${morning ? 'Enjoy the rest of the episode.' : 'Nice work.'}`;
  const next = MILESTONES.find(m => m > entry.number) || 70;
  document.getElementById('dn-milestone').textContent = entry.number >= 70 ? 'Journey complete!' : `Workout ${next}`;
  const changes = lastResult.changes || [];
  document.getElementById('dn-changes-card').hidden = !changes.length;
  document.getElementById('dn-changes').innerHTML = changes.map(c => `<p class="change">${esc(c)}.</p>`).join('');
}

/* ---------- Taps ---------- */

document.addEventListener('click', event => {
  const t = event.target;
  if (t.closest('[data-preview]')) return openPreview(0);
  if (t.closest('[data-preview-next]')) {
    if (previewIndex < planWorkout().moves.length - 1) { previewIndex++; renderPreview(); window.scrollTo(0, 0); }
    else startWorkout();
    return;
  }
  if (t.closest('[data-preview-back]')) {
    if (previewIndex > 0) { previewIndex--; renderPreview(); } else openScreen('today');
    return;
  }
  const seg = t.closest('#preview [data-version]');
  if (seg) return setVersion(seg.dataset.version);

  if (t.closest('[data-start]')) return startWorkout();
  const rating = t.closest('#rating [data-rating]');
  if (rating && session) { session.ratingItem.rating = rating.dataset.rating; return renderRatingChoices(); }
  const weight = t.closest('#rating [data-weight]');
  if (weight && session) return chooseWeight(Number(weight.dataset.weight));
  if (t.closest('[data-pause]')) return togglePause();
  if (t.closest('[data-more-rest]')) return addRestTime();
  if (t.closest('[data-skip]')) return skipPhase();
  if (t.closest('[data-end]')) return endWorkout();

  const okay = t.closest('[data-okay]');
  if (okay) return okay.dataset.okay === 'fine' ? openScreen('done') : openHurt();
  const area = t.closest('#hurt-area .chip-btn');
  if (area) {
    document.querySelectorAll('#hurt-area .chip-btn').forEach(b => b.classList.toggle('selected', b === area));
    return;
  }
  if (t.closest('[data-hurt-save]')) return saveHurt();
});
